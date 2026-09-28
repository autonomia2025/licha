#!/usr/bin/env node
// Inventario COMPLETO de solo lectura: recorre todas las lecciones accesibles y registra
// estructura, texto, recursos, proveedor de video y, para video nativo (Mux), calidades y
// pistas de subtítulos leyendo SOLO playlists .m3u8 (texto). No descarga video, audio,
// subtítulos ni adjuntos. No guarda tokens ni URLs firmadas.
//
// Uso: node inventory.mjs --url https://www.skool.com/<grupo>/classroom [--course <slug>] [--limit N]
//      [--include-locked] [--refresh] [--delay 3000]
// Es reanudable: las lecciones ya inventariadas en out/full-inventory.json se saltan (salvo --refresh).

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeShouldBlock } from './lib/safety.mjs';
import { jwtLifetime, redactUrl } from './lib/redact.mjs';
import { parseMaster, parseMediaPlaylist } from './lib/hls.mjs';
import { findCourseList, findCourseTree, flattenCourse, describeText } from './lib/tree.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
if (!args.url) {
  console.error('Falta --url https://www.skool.com/<grupo>/classroom');
  process.exit(1);
}
const START = new URL(args.url);
const ORIGIN = START.origin;
const GROUP = START.pathname.split('/').filter(Boolean)[0];
const OUT = path.resolve(here, args.out ?? 'out');
const FILE = path.join(OUT, 'full-inventory.json');
const PROFILE = path.resolve(here, args.profile ?? '../../.skool-profile');
const STREAM_BASE = args['stream-base'] ?? 'https://stream.video.skool.com';
const DELAY = Number(args.delay ?? 3000);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

async function readNextData(page) {
  const txt = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent ?? null);
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

async function safeGoto(page, url) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
      return null;
    } catch (e) {
      if (i === 2) return e.message.split('\n')[0].slice(0, 160);
      await sleep(5000 * (i + 1));
    }
  }
}

/** Busca el texto enriquecido de la lección en todo el JSON de la página (no solo en el árbol). */
function findLessonText(json, lessonId) {
  const hits = [];
  const seen = new Set();
  (function walk(v, p, ownerId) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    const id = typeof v.id === 'string' ? v.id : ownerId;
    for (const [k, c] of Object.entries(v)) {
      if (typeof c === 'string' && /^(desc|description|content|body|text)$/i.test(k) && c.length > 20) {
        hits.push({ path: `${p}.${k}`.replace(/\.\d+\./g, '.[i].'), owner_id: id, value: c });
      } else walk(c, `${p}.${k}`, id);
    }
  })(json?.props?.pageProps ?? {}, '$.props.pageProps', null);
  // Preferimos el texto asociado al id de la lección; si no, cualquiera fuera del árbol del curso.
  return hits.find((h) => h.owner_id === lessonId) ?? hits.find((h) => !h.path.includes('.course.')) ?? null;
}

/** Lee un .m3u8 desde el propio contexto de la página de Skool (como lo haría el reproductor). */
async function fetchText(page, url) {
  return page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'omit' });
    return { status: r.status, ct: r.headers.get('content-type') || '', text: r.ok ? await r.text() : '' };
  }, url);
}

async function nativeVideo(page, video) {
  const out = {
    playback_id: video.playbackId,
    token_present: Boolean(video.playbackToken),
    token_lifetime: video.playbackToken ? jwtLifetime(video.playbackToken) : null,
    page_video_keys: Object.keys(video).sort(),
  };
  if (!video.playbackId || !video.playbackToken) return out;
  const master = `${STREAM_BASE}/${video.playbackId}.m3u8?token=${video.playbackToken}`;
  try {
    const m = await fetchText(page, master);
    out.master_status = m.status;
    if (!m.text) return out;
    const parsed = parseMaster(m.text, master);
    out.qualities = parsed.qualities;
    out.variants = parsed.variants.map((v) => ({ resolution: v.resolution, bandwidth: v.bandwidth, codecs: v.codecs, frame_rate: v.frame_rate }));
    out.separate_audio = parsed.audio.length > 0;
    out.subtitles = [];
    for (const s of parsed.subtitles) {
      const track = { name: s.name, language: s.language, default: s.default, autoselect: s.autoselect };
      if (s.uri) {
        const sp = await fetchText(page, s.uri);
        track.playlist_status = sp.status;
        if (sp.text) {
          const mp = parseMediaPlaylist(sp.text, s.uri);
          track.segment_count = mp.segment_count;
          track.segment_extensions = mp.segment_extensions;
          track.duration_s = mp.total_duration_s;
        }
      }
      out.subtitles.push(track);
    }
  } catch (e) {
    out.error = String(e.message).slice(0, 160);
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let db = { generated_at: null, group: GROUP, courses: {}, lessons: {} };
  try {
    db = JSON.parse(await readFile(FILE, 'utf8'));
  } catch {}

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: args.headless === true,
    viewport: { width: 1400, height: 900 },
    ...(args.chromium || process.env.CHROMIUM_PATH ? { executablePath: args.chromium || process.env.CHROMIUM_PATH } : {}),
  });
  const shouldBlock = makeShouldBlock(START.host);
  let blockedCount = 0;
  let mediaBytes = 0;
  await ctx.route('**/*', (route) => {
    if (shouldBlock(route.request())) {
      blockedCount++;
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  ctx.on('response', (r) => {
    const h = r.headers();
    if (/^(video|audio)\//.test(h['content-type'] || '')) mediaBytes += Number(h['content-length'] || 0);
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  // Classroom + sesión
  let courses = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    await safeGoto(page, `${ORIGIN}/${GROUP}/classroom`);
    await sleep(3000);
    const nd = await readNextData(page);
    courses = nd ? findCourseList(nd) : [];
    if (courses.length) break;
    if (args.headless === true || attempt === 3) throw new Error('No se ven cursos: inicia sesión (ejecuta sin --headless).');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('>>> Inicia sesión en la ventana de Chromium, entra al classroom y presiona Enter… ');
    rl.close();
  }
  if (args.course) courses = courses.filter((c) => c.name === args.course);
  console.log(`Cursos: ${courses.length}`);

  const save = async () => {
    db.generated_at = new Date().toISOString();
    db.safety = { media_bytes_received: mediaBytes, blocked_requests: blockedCount };
    await writeFile(FILE, JSON.stringify(db, null, 2));
    await writeFile(path.join(OUT, 'full-inventory-summary.md'), summarize(db));
  };

  let processed = 0;
  for (const c of courses) {
    const err = await safeGoto(page, `${ORIGIN}/${GROUP}/classroom/${c.name}`);
    if (err) {
      console.log(`Curso ${c.name}: error ${err}`);
      continue;
    }
    await sleep(2000);
    const nd = await readNextData(page);
    const tree = nd ? findCourseTree(nd) : null;
    if (!tree) {
      console.log(`Curso ${c.name}: sin árbol`);
      continue;
    }
    const flat = flattenCourse(tree.node);
    db.courses[c.name] = {
      id: tree.node.id,
      slug: c.name,
      title: tree.node.title,
      position: courses.indexOf(c) + 1,
      access: c.access_flags,
      cover_image: tree.node.metadata.coverImage ?? null,
      modules: flat.modules.map((m) => ({ id: m.id, position: m.position, title: m.title, access: m.access_flags, lesson_ids: m.lessons.map((l) => l.id) })),
    };
    console.log(`\nCurso ${c.name} — ${tree.node.title}: ${flat.modules.length} módulos`);

    for (const m of flat.modules) {
      for (const l of m.lessons) {
        const base = {
          id: l.id,
          course: c.name,
          module_id: m.id,
          module_position: m.position,
          position: l.position,
          title: l.title,
          lesson_url: `${ORIGIN}/${GROUP}/classroom/${c.name}?md=${l.id}`,
          access: l.access_flags,
          video_len_ms: tree.node && l.video.fields.videoLenMs ? Number(l.video.fields.videoLenMs) : null,
          thumbnail: l.video.fields.videoThumbnail ?? null,
        };
        const locked = l.access_flags.hasAccess === false || l.metadata_keys.every((k) => k === 'title' || k === 'videoThumbnail');
        if (locked && !args['include-locked']) {
          db.lessons[l.id] = { ...base, accessible: false, skipped: 'sin-acceso' };
          continue;
        }
        if (db.lessons[l.id]?.done && !args.refresh) continue;
        if (processed >= LIMIT) continue;
        processed++;
        process.stdout.write(`  ${m.position}.${l.position} ${l.title}… `);
        try {
          const e = await safeGoto(page, base.lesson_url);
          if (e) throw new Error(e);
          await sleep(1500);
          const json = await readNextData(page);
          const pp = json?.props?.pageProps ?? {};
          // Nodo de la lección dentro del JSON de su propia página (puede traer más campos que el árbol).
          let node = null;
          const t = json ? findCourseTree(json) : null;
          (function walk(n) {
            if (!n || node) return;
            if (n.id === l.id) node = n;
            n.children?.forEach(walk);
          })(t?.node);
          const md = node?.metadata ?? {};
          const text = findLessonText(json, l.id);
          const videoLink = typeof md.videoLink === 'string' && md.videoLink ? md.videoLink : null;
          const video = isObj(pp.video) && pp.video.playbackId ? pp.video : isObj(pp.renderData?.video) && pp.renderData.video.playbackId ? pp.renderData.video : null;
          const rec = {
            ...base,
            accessible: true,
            metadata_keys: Object.keys(md).sort(),
            skool_video_id: md.videoId ?? null,
            text: text ? { source_path: text.path, ...describeText({ desc: text.value }), raw: text.value } : null,
            resources: l.attachments,
            video_provider: video ? 'skool-mux' : l.video.video_link_provider,
            external_video_url: !video && videoLink ? videoLink : null,
            native: video ? await nativeVideo(page, video) : null,
            done: true,
          };
          db.lessons[l.id] = rec;
          const n = rec.native;
          console.log(
            n
              ? `Mux ${n.qualities?.join('/') ?? '?'} · subs: ${n.subtitles?.map((s) => s.language).join(',') || 'no'}${rec.text ? ' · texto' : ''}`
              : `${rec.video_provider ?? 'sin video'}${rec.text ? ' · texto' : ''}${rec.resources.length ? ` · ${rec.resources.length} recursos` : ''}`,
          );
        } catch (e) {
          db.lessons[l.id] = { ...base, accessible: true, error: String(e.message).slice(0, 200) };
          console.log(`error: ${String(e.message).slice(0, 100)}`);
        }
        await save();
        await sleep(DELAY + Math.random() * 1500);
      }
    }
    await save();
  }
  await save();
  await ctx.close();
  console.log(`\nListo: ${FILE}\nResumen: ${path.join(OUT, 'full-inventory-summary.md')}`);
  if (mediaBytes > 0) console.warn(`ATENCIÓN: ${mediaBytes} bytes de video/audio recibidos.`);
}

function summarize(db) {
  const ls = Object.values(db.lessons);
  const acc = ls.filter((l) => l.accessible);
  const done = acc.filter((l) => l.done);
  const nat = done.filter((l) => l.native);
  const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  const L = [
    `# Inventario completo — ${db.group}`,
    '',
    `Generado: ${db.generated_at} · bytes de video/audio recibidos: **${db.safety?.media_bytes_received ?? 0}**`,
    '',
    `- Cursos: ${Object.keys(db.courses).length} · lecciones: ${ls.length} · accesibles: ${acc.length} · inventariadas: ${done.length} · con error: ${acc.filter((l) => l.error).length} · sin acceso: ${ls.length - acc.length}`,
    `- Proveedor de video: ${JSON.stringify(count(done, (l) => l.video_provider ?? 'ninguno'))}`,
    `- Video nativo (Mux): ${nat.length} · con subtítulos: ${nat.filter((l) => l.native.subtitles?.length).length} · idiomas: ${JSON.stringify(count(nat.flatMap((l) => l.native.subtitles ?? []), (s) => s.language ?? '?'))}`,
    `- Calidad máxima: ${JSON.stringify(count(nat, (l) => l.native.qualities?.[0] ?? '?'))}`,
    `- Duración total nativa (según videoLenMs): ${Math.round(nat.reduce((s, l) => s + (l.video_len_ms ?? 0), 0) / 3600000)} h`,
    `- Lecciones con texto: ${done.filter((l) => l.text).length} (origen: ${JSON.stringify(count(done.filter((l) => l.text), (l) => l.text.source_path))})`,
    `- Lecciones con recursos: ${done.filter((l) => l.resources?.length).length} · recursos: ${done.reduce((s, l) => s + (l.resources?.length ?? 0), 0)} (${JSON.stringify(count(done.flatMap((l) => l.resources ?? []), (r) => r.kind))})`,
    '',
    '## Por curso',
    '',
    '| Curso | Lecciones | Accesibles | Mux | Con subs | Externos | Sin video | Con texto | Recursos | Errores |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const [slug, c] of Object.entries(db.courses)) {
    const cl = ls.filter((l) => l.course === slug);
    const cd = cl.filter((l) => l.done);
    L.push(
      `| ${slug} ${c.title} | ${cl.length} | ${cl.filter((l) => l.accessible).length} | ${cd.filter((l) => l.native).length} | ${cd.filter((l) => l.native?.subtitles?.length).length} | ${cd.filter((l) => !l.native && l.video_provider).length} | ${cd.filter((l) => !l.video_provider).length} | ${cd.filter((l) => l.text).length} | ${cd.reduce((s, l) => s + (l.resources?.length ?? 0), 0)} | ${cl.filter((l) => l.error).length} |`,
    );
  }
  const odd = nat.filter((l) => l.native.master_status !== 200 || !l.native.subtitles?.length);
  if (odd.length) {
    L.push('', '## Videos nativos a revisar (master ≠ 200 o sin subtítulos)', '');
    for (const l of odd) L.push(`- ${l.course} ${l.module_position}.${l.position} ${l.title} · master: ${l.native.master_status} · subs: ${l.native.subtitles?.length ?? 0}`);
  }
  const ext = done.filter((l) => l.external_video_url);
  if (ext.length) {
    L.push('', '## Videos externos', '');
    for (const l of ext) L.push(`- ${l.course} ${l.module_position}.${l.position} ${l.title} · ${l.video_provider} · ${redactUrl(l.external_video_url)}`);
  }
  return L.join('\n');
}

main().catch((e) => {
  if (/has been closed|Target closed/i.test(String(e?.message))) {
    console.error('\nSe cerró el navegador. Vuelve a ejecutar: el inventario continúa donde quedó.');
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});

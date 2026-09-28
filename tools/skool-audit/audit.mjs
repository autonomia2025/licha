#!/usr/bin/env node
// Sonda de auditoría de SOLO LECTURA para un curso de Skool al que el usuario tiene acceso.
//
// Qué hace:
//   - Abre un navegador con un perfil local donde TÚ inicias sesión manualmente.
//   - Lee la estructura que la propia página entrega al navegador (JSON embebido + DOM).
//   - Visita una MUESTRA pequeña de lecciones y registra metadatos de red.
//   - Lee manifests HLS (.m3u8, texto) y cabeceras WebVTT de subtítulos.
//
// Qué NO hace (garantizado por bloqueo de red):
//   - No descarga segmentos de video/audio (.ts, .m4s, .mp4, …): se abortan.
//   - No descarga adjuntos.
//   - No guarda cookies, tokens ni URLs firmadas completas (todo se redacta).
//   - No evade autenticación ni controles de acceso: solo ve lo que tu sesión ve.
//
// Uso:  node audit.mjs --url https://www.skool.com/<grupo>/classroom[/<curso>] [--modules 2] [--lessons 5]

import { chromium, request as pwRequest } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactUrl, redactString, pathPattern, signatureInfo, shapeOf } from './lib/redact.mjs';
import { isMasterPlaylist, parseMaster, parseMediaPlaylist, inspectVtt } from './lib/hls.mjs';
import { findCourseTree, findCourseList, flattenCourse, keyFrequency, normalizeNode } from './lib/tree.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- argumentos
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
if (!args.url) {
  console.error('Falta --url https://www.skool.com/<grupo>/classroom[/<curso>]');
  process.exit(1);
}
const START = new URL(args.url);
const GROUP = START.pathname.split('/').filter(Boolean)[0];
const ORIGIN = START.origin;
const N_MODULES = Number(args.modules ?? 2);
const N_LESSONS = Number(args.lessons ?? 5);
const MAX_COURSES = Number(args['max-courses'] ?? 50);
const OUT = path.resolve(here, args.out ?? 'out');
const PROFILE = path.resolve(here, args.profile ?? '../../.skool-profile');
const PLAY = args['no-play'] !== true;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
};
const isSkoolHost = (u) => /(^|\.)skool\.com$/.test(hostOf(u)) || hostOf(u) === START.host;

// ---------------------------------------------------------------- red: bloqueo + registro
const MEDIA_EXT = /\.(ts|m4s|mp4|m4v|m4a|aac|mp3|webm|mov|mkv|cmfv|cmfa|mpd)(\?|$)/i;
const TEXT_OK = /\.(m3u8|vtt|webvtt|json|jpe?g|png|webp|gif|svg|css|js|woff2?)(\?|$)/i;
const SEGMENT_HINT = /\/(chunk|segment|frag|seg-|range)/i;
const VIDEO_CDN = /mux\.com|googlevideo\.com|vimeocdn\.com|akamaized\.net|cloudfront\.net|b-cdn\.net|wistia\.(com|net)|loom\.com|fastly/i;
const EXTERNAL_PLAYER = /(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|loom\.com|wistia\.(com|net)|vidyard\.com)/i;

const net = []; // resumen de cada respuesta (redactado)
const blocked = []; // peticiones abortadas
const bodies = new Map(); // SOLO en memoria: cuerpos de texto de m3u8 / JSON / HTML para análisis; nunca se escriben
let mediaBytes = 0;

function shouldBlock(req) {
  const url = req.url();
  const rt = req.resourceType();
  if (rt === 'media') return 'media';
  if (MEDIA_EXT.test(new URL(url).pathname)) return 'extension-de-video/audio';
  if (VIDEO_CDN.test(hostOf(url)) && !TEXT_OK.test(new URL(url).pathname) && (rt === 'xhr' || rt === 'fetch' || rt === 'other'))
    return 'cdn-de-video-sin-extension-de-texto';
  if ((rt === 'xhr' || rt === 'fetch') && SEGMENT_HINT.test(new URL(url).pathname) && !TEXT_OK.test(new URL(url).pathname))
    return 'posible-segmento';
  // Reproductores externos (YouTube/Vimeo/Loom/Wistia…): basta con la URL del iframe, no se carga.
  if (EXTERNAL_PLAYER.test(hostOf(url)) && hostOf(url) !== START.host) return 'reproductor-externo';
  return null;
}

async function onResponse(resp) {
  const req = resp.request();
  const url = resp.url();
  const headers = resp.headers();
  const ct = (headers['content-type'] || '').split(';')[0].trim();
  const len = Number(headers['content-length'] || 0);
  if (/^(video|audio)\//.test(ct)) mediaBytes += len;
  const entry = {
    t: Date.now(),
    method: req.method(),
    type: req.resourceType(),
    status: resp.status(),
    content_type: ct,
    url: redactUrl(url),
    pattern: pathPattern(url),
    skool: isSkoolHost(url),
  };
  if (entry.skool && (entry.type === 'xhr' || entry.type === 'fetch' || entry.type === 'document')) {
    try {
      const h = await req.allHeaders();
      entry.request_header_names = Object.keys(h).filter((k) => !/^(accept|user-agent|sec-|referer|origin|content-length|accept-)/.test(k)).sort();
    } catch {}
  }
  const wantBody = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(url) || ((ct.includes('json') || ct.includes('html')) && entry.skool);
  if (wantBody && resp.status() < 400) {
    try {
      const text = await resp.text();
      bodies.set(url, { text, ct, t: entry.t });
      if (ct.includes('json')) {
        try {
          entry.json_shape = shapeOf(JSON.parse(text), 0, 4);
        } catch {}
      }
    } catch {}
  }
  net.push(entry);
}

// ---------------------------------------------------------------- utilidades de página
async function readNextData(page) {
  return page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    return {
      next_data: el ? el.textContent : null,
      has_app_router_flight: Array.isArray(self.__next_f),
      title: document.title,
    };
  });
}

async function looksLoggedOut(page) {
  const u = page.url();
  if (/\/(login|signup)/.test(u)) return true;
  return page.evaluate(() =>
    Boolean(document.querySelector('input[type="password"]')) ||
    [...document.querySelectorAll('a,button')].some((e) => /^(log ?in|iniciar sesi[oó]n|sign up|join group)$/i.test((e.textContent || '').trim())),
  );
}

async function domInventory(page) {
  return page.evaluate(() => {
    const abs = (u) => {
      try {
        return new URL(u, location.href).toString();
      } catch {
        return null;
      }
    };
    const lessonLinks = [...document.querySelectorAll('a[href*="md="]')].map((a) => ({
      text: (a.textContent || '').trim().slice(0, 120),
      md: new URL(a.href, location.href).searchParams.get('md'),
    }));
    const iframes = [...document.querySelectorAll('iframe')].map((f) => abs(f.src)).filter(Boolean);
    const videos = [...document.querySelectorAll('video')].map((v) => ({
      has_src: Boolean(v.currentSrc || v.src),
      src_scheme: (v.currentSrc || v.src || '').split(':')[0] || null,
      tracks: [...v.querySelectorAll('track')].map((t) => ({ kind: t.kind, srclang: t.srclang, label: t.label })),
      text_tracks: [...(v.textTracks || [])].map((t) => ({ kind: t.kind, language: t.language, label: t.label })),
    }));
    const customPlayers = [...new Set([...document.querySelectorAll('*')].map((e) => e.tagName.toLowerCase()).filter((t) => t.includes('-') && /player|mux|video|hls/.test(t)))];
    const FILE_EXT = /\.(pdf|zip|rar|7z|docx?|xlsx?|pptx?|csv|txt|key|numbers|pages|psd|ai|fig|sketch|epub|mp3|wav)(\?|$)/i;
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => ({ text: (a.textContent || '').trim().slice(0, 120), href: abs(a.getAttribute('href')), download: a.hasAttribute('download') }))
      .filter((l) => l.href && !l.href.startsWith('javascript:'));
    const fileLinks = links.filter((l) => l.download || FILE_EXT.test(new URL(l.href).pathname) || /file|attachment|download|assets/i.test(new URL(l.href).host + new URL(l.href).pathname));
    const externalLinks = links.filter((l) => !/(^|\.)skool\.com$/.test(new URL(l.href).host));
    const images = [...document.querySelectorAll('img')]
      .filter((i) => (i.naturalWidth || i.width) >= 200)
      .map((i) => abs(i.currentSrc || i.src))
      .filter(Boolean);
    const h1 = [...document.querySelectorAll('h1,h2')].map((h) => (h.textContent || '').trim()).filter(Boolean).slice(0, 5);
    return { lessonLinks, iframes, videos, customPlayers, fileLinks, externalLinks, images, headings: h1 };
  });
}

/** Busca en un JSON rutas cuyos valores parezcan video/manifest/subtítulos. Devuelve rutas + URLs redactadas. */
function findMediaRefs(obj) {
  const hits = [];
  const seen = new Set();
  (function walk(v, p) {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return;
      seen.add(v);
      for (const [k, c] of Object.entries(v)) walk(c, `${p}.${k}`);
    } else if (typeof v === 'string' && /\.m3u8|\.vtt|mux\.com|stream\.|playback|\/video|captions|subtitle/i.test(v) && v.length < 2000) {
      hits.push({ path: p.replace(/\.\d+\./g, '.[i].'), value: /^https?:/.test(v) ? redactUrl(v) : redactString(v.slice(0, 80)) });
    }
  })(obj, '$');
  return hits;
}

async function tryClickPlay(page) {
  // a) Reproductores conocidos
  for (const sel of ['mux-player', 'media-play-button', 'button[aria-label*="play" i]', '[data-testid*="play" i]']) {
    const el = page.locator(sel).first();
    try {
      if (await el.isVisible({ timeout: 300 })) {
        await el.click({ timeout: 2000, force: true });
        return sel;
      }
    } catch {}
  }
  // b) El elemento visible más grande con proporción ~16:9 (miniatura del video) → clic en su centro.
  const box = await page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('video, img, div, button, [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 320 || r.height < 150 || r.top < 0 || r.top > window.innerHeight) continue;
      const ratio = r.width / r.height;
      if (ratio < 1.5 || ratio > 1.95) continue;
      const area = r.width * r.height;
      if (!best || area > best.area) best = { x: r.left + r.width / 2, y: r.top + r.height / 2, area, tag: el.tagName.toLowerCase() };
    }
    return best;
  });
  if (box) {
    await page.mouse.click(box.x, box.y);
    return `centro-de-${box.tag}-16:9`;
  }
  return null;
}

async function safeGoto(page, url) {
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
      return null;
    } catch (e) {
      if (i === 1) return e.message.split('\n')[0].slice(0, 160);
      await sleep(5000);
    }
  }
}

const NOISE_HOSTS = /stripe\.com|stripe\.network|google|gstatic|facebook|doubleclick|intercom|segment|sentry|hotjar|clarity|tiktok|twitter|linkedin|amplitude|mixpanel|posthog|datadog|cloudflareinsights/i;

// ---------------------------------------------------------------- análisis HLS de una lección
async function analyzeHls(ctx, anon, windowStart, metadata, nextData, page) {
  const m3u8 = [...bodies.entries()].filter(([u, b]) => b.t >= windowStart && (/mpegurl/i.test(b.ct) || /\.m3u8/i.test(u)));
  const masters = m3u8.filter(([, b]) => isMasterPlaylist(b.text));
  if (!masters.length) return { found: false, m3u8_seen: m3u8.length };
  const [masterUrl, master] = masters[0];
  const parsed = parseMaster(master.text, masterUrl);

  // ¿De dónde salen el ID de reproducción y el token? Se buscan en HTML/JSON capturados y en __NEXT_DATA__.
  const playbackId = new URL(masterUrl).pathname.split('/').filter(Boolean)[0]?.replace(/\.m3u8$/i, '') ?? '';
  const token = new URL(masterUrl).searchParams.get('token') ?? '';
  const bare = masterUrl.split('?')[0];
  const sources = [...bodies.entries()]
    .filter(([u, b]) => b.t >= windowStart && u !== masterUrl && !/mpegurl/i.test(b.ct) && (b.text.includes(bare) || (playbackId && b.text.includes(playbackId)) || (token && b.text.includes(token))))
    .map(([u, b]) => ({ pattern: pathPattern(u), content_type: b.ct, has_url: b.text.includes(bare), has_playback_id: b.text.includes(playbackId), has_token: Boolean(token) && b.text.includes(token) }));
  const nextDataPaths = [];
  if (nextData && playbackId) {
    const seen = new Set();
    (function walk(v, p) {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return;
        seen.add(v);
        for (const [k, c] of Object.entries(v)) walk(c, `${p}.${k}`);
      } else if (typeof v === 'string' && (v.includes(playbackId) || (token && v.includes(token)))) {
        nextDataPaths.push({ path: p.replace(/\.\d+\./g, '.[i].'), has_playback_id: v.includes(playbackId), has_token: Boolean(token) && v.includes(token) });
      }
    })(nextData, '$');
  }
  let playerAttrs = null;
  try {
    playerAttrs = await page.evaluate((pid) => {
      const el = document.querySelector('mux-player');
      if (!el) return null;
      return {
        attribute_names: el.getAttributeNames().sort(),
        playback_id_matches: el.getAttribute('playback-id') === pid,
        has_playback_token_attr: el.hasAttribute('playback-token') || Boolean(el.tokens?.playback),
      };
    }, playbackId);
  } catch {}

  // ¿Qué campo de metadata de la lección contiene el ID de reproducción?
  const idMatches = Object.entries(metadata || {})
    .filter(([, v]) => typeof v === 'string' && playbackId && v.includes(playbackId))
    .map(([k]) => k);

  // ¿Qué necesita la URL firmada para responder? (solo el master, texto de pocos KB)
  const statusOf = async (fn) => {
    try {
      const r = await fn();
      const st = r.status();
      await r.dispose();
      return st;
    } catch (e) {
      return `error:${e.message.slice(0, 60)}`;
    }
  };
  const ref = { referer: `${ORIGIN}/`, origin: ORIGIN };
  const anonStatus = {
    sin_cookies_sin_referer: await statusOf(() => anon.get(masterUrl, { maxRedirects: 0 })),
    sin_cookies_con_referer_skool: await statusOf(() => anon.get(masterUrl, { maxRedirects: 0, headers: ref })),
    con_sesion_con_referer_skool: await statusOf(() => ctx.request.get(masterUrl, { maxRedirects: 0, headers: ref })),
  };

  const subtitles = [];
  for (const s of parsed.subtitles) {
    const sub = {
      name: s.name,
      language: s.language,
      default: s.default,
      autoselect: s.autoselect,
      forced: s.forced,
      characteristics: s.characteristics,
      playlist: s.uri ? redactUrl(s.uri) : null,
      playlist_signature: s.uri ? signatureInfo(s.uri) : null,
    };
    if (s.uri) {
      try {
        const r = await ctx.request.get(s.uri);
        const text = await r.text();
        sub.playlist_status = r.status();
        const mp = parseMediaPlaylist(text, s.uri);
        sub.segments = { ...mp, first_segment: mp.first_segment ? redactUrl(mp.first_segment) : null };
        if (mp.first_segment && /^(vtt|webvtt|\(sin-extensión\))$/.test(mp.segment_extensions[0])) {
          const r2 = await ctx.request.get(mp.first_segment);
          const ct = r2.headers()['content-type'] || '';
          if (!/^(video|audio)\//.test(ct)) {
            sub.first_segment_content_type = ct;
            sub.first_segment_check = inspectVtt((await r2.text()).slice(0, 20000));
          }
          sub.segment_signature = signatureInfo(mp.first_segment);
        }
      } catch (e) {
        sub.error = e.message.slice(0, 120);
      }
    }
    subtitles.push(sub);
  }

  return {
    found: true,
    master: redactUrl(masterUrl),
    master_host: hostOf(masterUrl),
    master_path_pattern: pathPattern(masterUrl),
    master_path_id_hash: sha(new URL(masterUrl).pathname),
    master_signature: signatureInfo(masterUrl),
    master_status_without_cookies: anonStatus,
    manifest_url_source: sources,
    playback_id_in_next_data: nextDataPaths.slice(0, 10),
    mux_player: playerAttrs,
    manifest_id_matches_metadata_keys: idMatches,
    qualities: parsed.qualities,
    variants: parsed.variants.map((v) => ({ ...v, uri: v.uri ? pathPattern(v.uri) : null })),
    audio: parsed.audio.map((a) => ({ ...a, uri: a.uri ? pathPattern(a.uri) : null })),
    closed_captions_608: parsed.closed_captions.map((c) => ({ name: c.name, language: c.language })),
    subtitles,
    other_m3u8_seen: m3u8.length - 1,
  };
}

// ---------------------------------------------------------------- main
async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Perfil de navegador: ${PROFILE}\nSalida: ${OUT}\n`);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: args.headless === true,
    viewport: { width: 1400, height: 900 },
    ...(args.chromium || process.env.CHROMIUM_PATH ? { executablePath: args.chromium || process.env.CHROMIUM_PATH } : {}),
  });
  const anon = await pwRequest.newContext(); // sin cookies: solo para comprobar si las URLs firmadas bastan
  await ctx.route('**/*', (route) => {
    const why = shouldBlock(route.request());
    if (why) {
      blocked.push({ t: Date.now(), reason: why, pattern: pathPattern(route.request().url()), type: route.request().resourceType() });
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  ctx.on('response', (r) => onResponse(r).catch(() => {}));
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  // 1) Sesión + 2) listado de cursos. Si no se ven cursos, se asume que falta iniciar sesión
  //    (Skool puede mostrar la página pública del grupo sin formulario de login).
  const readClassroom = async () => {
    await safeGoto(page, `${ORIGIN}/${GROUP}/classroom`);
    await sleep(3500);
    const nd = await readNextData(page);
    let json = null;
    try {
      json = nd.next_data ? JSON.parse(nd.next_data) : null;
    } catch {}
    const list = json ? findCourseList(json) : [];
    const dom = await page.evaluate((g) => [...new Set([...document.querySelectorAll(`a[href*="/${g}/classroom/"]`)].map((a) => new URL(a.href).pathname))], GROUP);
    return { nd, json, list, dom, loggedOut: await looksLoggedOut(page) };
  };

  let cr = await readClassroom();
  for (let attempt = 1; (cr.loggedOut || (!cr.list.length && !cr.dom.length)) && attempt <= 3; attempt++) {
    if (args.headless === true) throw new Error('No se ven cursos: no hay sesión en el perfil. Ejecuta sin --headless e inicia sesión.');
    console.log(`\nNo veo cursos en ${redactUrl(page.url())} (título: "${cr.nd.title}").`);
    console.log('En la ventana de Chromium que se abrió (NO la cierres):');
    console.log('  1. Inicia sesión en Skool.');
    console.log(`  2. Entra a https://www.skool.com/${GROUP}/classroom y comprueba que ves los cursos.`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question(`>>> Cuando veas los cursos, presiona Enter aquí (intento ${attempt}/3)… `);
    rl.close();
    cr = await readClassroom();
  }
  if (!cr.list.length && !cr.dom.length) {
    console.warn('\nSigo sin ver cursos. Genero el informe igualmente con datos de diagnóstico; compártelo.');
  } else {
    console.log(`\nSesión OK. Cursos detectados: JSON=${cr.list.length}, enlaces=${cr.dom.length}\n`);
  }

  const cookies = (await ctx.cookies()).filter((c) => /skool/.test(c.domain));
  const auth = {
    cookies: cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      http_only: c.httpOnly,
      secure: c.secure,
      same_site: c.sameSite,
      expires_in_days: c.expires > 0 ? Math.round((c.expires - Date.now() / 1000) / 86400) : 'session',
      looks_like_jwt: /^eyJ/.test(c.value),
    })),
  };

  const classroomND = cr.nd;
  const classroomJson = cr.json;
  const courses = cr.list;
  const classroomDom = cr.dom;
  const classroom = {
    final_url: redactUrl(page.url()),
    page_title: classroomND.title,
    logged_out_signals: cr.loggedOut,
    next_data_present: Boolean(classroomND.next_data),
    app_router_flight: classroomND.has_app_router_flight,
    build_id_present: Boolean(classroomJson?.buildId),
    page_props_keys: classroomJson ? Object.keys(classroomJson.props?.pageProps ?? {}).sort() : [],
    courses_in_json: courses.length,
    course_links_in_dom: classroomDom.length,
    courses,
  };

  // 3) Estructura de cada curso (solo carga de página, sin reproducir nada)
  const explicitCourse = START.pathname.split('/').filter(Boolean)[2] ?? null;
  const courseSlugs = explicitCourse
    ? [explicitCourse]
    : [...new Set([...courses.map((c) => c.name).filter(Boolean), ...classroomDom.map((p) => p.split('/')[3]).filter(Boolean)])].slice(0, MAX_COURSES);

  const courseReports = [];
  for (const slug of courseSlugs) {
    const url = `${ORIGIN}/${GROUP}/classroom/${slug}`;
    process.stdout.write(`Curso ${slug}… `);
    const gotoErr = await safeGoto(page, url);
    if (gotoErr) {
      courseReports.push({ slug, error: gotoErr });
      console.log(`error: ${gotoErr}`);
      continue;
    }
    await sleep(2500);
    const nd = await readNextData(page);
    let json = null;
    try {
      json = nd.next_data ? JSON.parse(nd.next_data) : null;
    } catch {}
    const found = json ? findCourseTree(json) : null;
    const dom = await domInventory(page);
    const rep = {
      slug,
      final_url: redactUrl(page.url()),
      next_data_present: Boolean(nd.next_data),
      tree_json_path: found?.path ?? null,
      course: found ? { id: found.node.id, name: found.node.name, unitType: found.node.unitType, title: found.node.title } : null,
      key_frequency: found ? keyFrequency(found.node) : null,
      dom_lesson_links: dom.lessonLinks.length,
    };
    if (found) {
      const flat = flattenCourse(found.node);
      rep.structure = flat;
      rep.counts = {
        modules: flat.modules.length,
        lessons: flat.modules.reduce((s, m) => s + m.lessons.length, 0),
        lessons_with_video_field: flat.modules.flatMap((m) => m.lessons).filter((l) => Object.keys(l.video.fields).length).length,
        lessons_with_description: flat.modules.flatMap((m) => m.lessons).filter((l) => l.description.found).length,
        lessons_with_attachments: flat.modules.flatMap((m) => m.lessons).filter((l) => l.attachments.length).length,
        // Lecciones cuya metadata trae solo título/miniatura o hasAccess=false: probablemente sin acceso (drip, pago aparte, nivel).
        lessons_probably_locked: flat.modules.flatMap((m) => m.lessons).filter((l) => l.access_flags.hasAccess === false || l.metadata_keys.every((k) => k === 'title' || k === 'videoThumbnail')).length,
        video_providers: flat.modules.flatMap((m) => m.lessons).reduce((acc, l) => {
          const p = l.video.video_link_provider ?? (l.video.has_video_id ? 'id-sin-link' : 'ninguno');
          acc[p] = (acc[p] ?? 0) + 1;
          return acc;
        }, {}),
      };
      // Orden: ¿coincide el orden del JSON con el orden de enlaces del DOM (sidebar)?
      const jsonOrder = flat.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const domOrder = dom.lessonLinks.map((l) => l.md).filter(Boolean);
      const common = domOrder.filter((id) => jsonOrder.includes(id));
      rep.order_check = {
        dom_ids: domOrder.length,
        dom_ids_in_json: common.length,
        same_relative_order: common.every((id, i) => i === 0 || jsonOrder.indexOf(id) > jsonOrder.indexOf(common[i - 1])),
      };
    }
    courseReports.push(rep);
    console.log(rep.counts ? `${rep.counts.modules} módulos / ${rep.counts.lessons} lecciones` : 'sin árbol detectado');
  }

  // 5) ¿Existe un endpoint JSON de datos (Next.js /_next/data) usable sin navegador?
  let nextDataEndpoint = null;
  const target0 = courseReports.find((c) => c.structure);
  if (classroomJson?.buildId && target0) {
    const u = `${ORIGIN}/_next/data/${classroomJson.buildId}/${GROUP}/classroom/${target0.slug}.json`;
    try {
      const r = await ctx.request.get(u);
      const withCookies = r.status();
      let hasTree = false;
      try {
        hasTree = Boolean(findCourseTree(await r.json()));
      } catch {}
      const r2 = await anon.get(u);
      let anonTree = false;
      try {
        anonTree = Boolean(findCourseTree(await r2.json()));
      } catch {}
      nextDataEndpoint = { pattern: pathPattern(u), status_with_session: withCookies, course_tree_with_session: hasTree, status_without_cookies: r2.status(), course_tree_without_cookies: anonTree };
    } catch (e) {
      nextDataEndpoint = { error: e.message.slice(0, 120) };
    }
  }

  const samples = [];
  const save = async () => {
    // 6) Resumen de red
    const byPattern = {};
    for (const e of net) {
      const k = `${e.method} ${e.pattern}`;
      byPattern[k] ??= { count: 0, types: new Set(), statuses: new Set(), content_types: new Set(), request_header_names: e.request_header_names };
      byPattern[k].count++;
      byPattern[k].types.add(e.type);
      byPattern[k].statuses.add(e.status);
      byPattern[k].content_types.add(e.content_type);
    }
    const network = Object.entries(byPattern)
      .map(([k, v]) => ({ endpoint: k, count: v.count, types: [...v.types], statuses: [...v.statuses], content_types: [...v.content_types], request_header_names: v.request_header_names }))
      .sort((a, b) => b.count - a.count);
    const blockedSummary = blocked.reduce((acc, b) => {
      const k = `${b.reason} · ${b.pattern.split('/')[0]}`;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

    const inventory = {
      generated_at: new Date().toISOString(),
      group: GROUP,
      params: { modules: N_MODULES, lessons: N_LESSONS, play_attempted: PLAY },
      safety: { media_bytes_received: mediaBytes, blocked_requests: blocked.length, blocked_summary: blockedSummary },
      auth,
      classroom,
      next_data_endpoint: nextDataEndpoint,
      courses: courseReports,
      samples,
    };

    await writeFile(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2));
    await writeFile(path.join(OUT, 'network-summary.json'), JSON.stringify(network, null, 2));
    await writeFile(path.join(OUT, 'report.md'), renderReport(inventory));
  };
  await save();

  // 4) Muestra profunda: primeros N módulos × M lecciones de un curso + (con --smart) hasta 2 lecciones
  //    de cada tipo encontrado en TODOS los cursos (adjuntos, Loom, YouTube, Vimeo, descripción, sin video).
  const main = courseReports.find((c) => c.structure && (!args.course || c.slug === args.course)) ?? courseReports.find((c) => c.structure);
  const plan = [];
  const planned = new Set();
  const addPlan = (course, mod, lesson, reason) => {
    if (planned.has(lesson.id)) return;
    planned.add(lesson.id);
    plan.push({ target: course, mod, lesson, reason });
  };
  if (main) for (const mod of main.structure.modules.slice(0, N_MODULES)) for (const lesson of mod.lessons.slice(0, N_LESSONS)) addPlan(main, mod, lesson, 'primeras');
  if (args.smart) {
    const all = courseReports.filter((c) => c.structure).flatMap((c) => c.structure.modules.flatMap((m) => m.lessons.map((l) => ({ c, m, l }))));
    const accessible = (l) => l.access_flags.hasAccess !== false && !l.metadata_keys.every((k) => k === 'title' || k === 'videoThumbnail');
    const cats = {
      adjuntos: (l) => l.attachments.length > 0,
      loom: (l) => l.video.video_link_provider === 'loom',
      youtube: (l) => l.video.video_link_provider === 'youtube',
      vimeo: (l) => l.video.video_link_provider === 'vimeo',
      descripcion: (l) => l.description.found,
      'sin-video': (l) => !l.video.has_video_id && !l.video.video_link_provider,
      'posible-sin-acceso': (l) => !accessible(l),
    };
    for (const [reason, test] of Object.entries(cats)) {
      all.filter(({ l }) => (reason === 'posible-sin-acceso' || accessible(l)) && test(l)).slice(0, reason === 'posible-sin-acceso' ? 1 : 2).forEach(({ c, m, l }) => addPlan(c, m, l, reason));
    }
  }
  console.log(`\nMuestra: ${plan.length} lecciones`);
  {
    for (const { target, mod, lesson, reason } of plan) {
      {
        const url = `${ORIGIN}/${GROUP}/classroom/${target.slug}?md=${lesson.id}`;
        process.stdout.write(`  [${reason}] ${target.slug} ${mod.position}.${lesson.position} ${lesson.title ?? lesson.id}… `);
        try {
          const windowStart = Date.now();
          const gotoErr = await safeGoto(page, url);
          if (gotoErr) throw new Error(gotoErr);
          const sawM3u8 = () => [...bodies.entries()].some(([u, b]) => b.t >= windowStart && /\.m3u8/i.test(u));
          const waitM3u8 = async (ms) => {
            for (let t = 0; t < ms && !sawM3u8(); t += 500) await sleep(500);
          };
          await waitM3u8(5000);
          let clicked = null;
          if (PLAY && !sawM3u8()) {
            clicked = await tryClickPlay(page);
            await waitM3u8(10000);
            if (!sawM3u8()) {
              await sleep(3000);
              clicked = `${clicked}+${await tryClickPlay(page)}`;
              await waitM3u8(10000);
            }
            await sleep(1500); // deja llegar la playlist de subtítulos
          }
          let screenshot = null;
          if (!sawM3u8()) {
            // Solo local (out/ está en .gitignore): para ver qué muestra una lección sin video detectado.
            await mkdir(path.join(OUT, 'screens'), { recursive: true });
            screenshot = `screens/${lesson.id}.png`;
            await page.screenshot({ path: path.join(OUT, screenshot) }).catch(() => (screenshot = null));
          }
          const dom = await domInventory(page);
          const nd = await readNextData(page);
          let json = null;
          try {
            json = nd.next_data ? JSON.parse(nd.next_data) : null;
          } catch {}
          // ¿La página de la lección trae más campos que el árbol del curso?
          let lessonNode = null;
          if (json) {
            const t = findCourseTree(json);
            (function walk(n) {
              if (!n || lessonNode) return;
              if (n.id === lesson.id) lessonNode = n;
              n.children?.forEach(walk);
            })(t?.node);
          }
          const htmlDoc = [...bodies.entries()].find(([u, b]) => b.t >= windowStart && b.ct.includes('html') && u.includes(`md=${lesson.id}`));
          const hls = await analyzeHls(ctx, anon, windowStart, lessonNode?.metadata ?? {}, json, page);
          const apiCalls = net
            .filter((e) => e.t >= windowStart && e.skool && (e.type === 'xhr' || e.type === 'fetch'))
            .map((e) => ({ method: e.method, pattern: e.pattern, status: e.status, content_type: e.content_type, request_header_names: e.request_header_names, json_shape: e.json_shape }));
          samples.push({
            module: { position: mod.position, title: mod.title, id: mod.id },
            lesson: {
              position: lesson.position,
              id: lesson.id,
              title: lesson.title,
              lesson_url: `${ORIGIN}/${GROUP}/classroom/${target.slug}?md=${lesson.id}`,
              title_visible_in_page: dom.headings.some((h) => lesson.title && h.includes(lesson.title.slice(0, 30))),
              access_flags: lesson.access_flags,
            },
            description: lesson.description,
            video_fields_in_tree: lesson.video,
            lesson_page_extra_metadata_keys: lessonNode ? Object.keys(lessonNode.metadata).filter((k) => !lesson.metadata_keys.includes(k)) : null,
            media_refs_in_next_data: json ? findMediaRefs(json.props?.pageProps ?? json) : [],
            manifest_in_initial_html: htmlDoc && hls.found ? htmlDoc[1].text.includes(hls.master.split('?')[0].replace(/<jwt>/g, '')) : false,
            play_click: clicked,
          screenshot,
            dom: {
              iframes: dom.iframes.filter((u) => !NOISE_HOSTS.test(hostOf(u))).map((u) => redactUrl(u)),
              videos: dom.videos,
              custom_player_tags: dom.customPlayers,
              file_links: dom.fileLinks.map((l) => ({ text: l.text, url: redactUrl(l.href), download_attr: l.download })),
              external_links: dom.externalLinks.slice(0, 30).map((l) => ({ text: l.text, url: redactUrl(l.href) })),
              large_images: dom.images.map((u) => redactUrl(u)),
            },
            attachments_in_tree: lesson.attachments,
            hls,
            api_calls: apiCalls,
            hosts_contacted: [...new Set(net.filter((e) => e.t >= windowStart && !e.skool).map((e) => e.pattern.split('/')[0]))].filter((h) => !NOISE_HOSTS.test(h)),
            blocked_in_lesson: blocked.filter((x) => x.t >= windowStart).map((x) => `${x.reason} · ${x.pattern}`).slice(0, 20),
          });

          const s = samples[samples.length - 1];
          s.reason = reason;
          s.course_slug = target.slug;
          console.log(hls.found ? `HLS ${hls.qualities.join('/')} · subs: ${hls.subtitles.map((x) => x.language || x.name).join(',') || 'ninguno'}` : s.dom.iframes.length ? `iframe ${s.dom.iframes.map(hostOf).join(',')}` : `sin HLS detectado (clic: ${clicked ?? 'no'}; hosts: ${s.hosts_contacted.join(',') || '—'})`);
        } catch (e) {
          samples.push({ course_slug: target.slug, reason, module: { position: mod.position, title: mod.title, id: mod.id }, lesson: { position: lesson.position, id: lesson.id, title: lesson.title }, error: String(e.message).slice(0, 200) });
          console.log(`error: ${String(e.message).slice(0, 120)} (sigo con la siguiente)`);
        }
        await save();
      }
    }
  }

  bodies.clear();
  await anon.dispose();
  await ctx.close();
  console.log(`\nListo. Revisa ${path.join(OUT, 'report.md')}`);
  if (mediaBytes > 0) console.warn(`ATENCIÓN: se recibieron ${mediaBytes} bytes con content-type video/audio. Revisa safety en inventory.json.`);
}

// ---------------------------------------------------------------- informe legible
function renderReport(inv) {
  const L = [];
  const yes = (b) => (b ? 'sí' : 'no');
  L.push(`# Auditoría Skool — ${inv.group}`, '', `Generado: ${inv.generated_at}`, '');
  L.push('## Seguridad de la sonda', '', `- Bytes de video/audio recibidos: **${inv.safety.media_bytes_received}**`, `- Peticiones bloqueadas: ${inv.safety.blocked_requests}`, '');
  for (const [k, v] of Object.entries(inv.safety.blocked_summary)) L.push(`  - ${k}: ${v}`);
  L.push('', '## Autenticación (solo nombres y atributos, sin valores)', '', '| cookie | dominio | HttpOnly | expira (días) | JWT |', '|---|---|---|---|---|');
  for (const c of inv.auth.cookies) L.push(`| ${c.name} | ${c.domain} | ${yes(c.http_only)} | ${c.expires_in_days} | ${yes(c.looks_like_jwt)} |`);
  L.push('', '## Classroom', '', `- URL final: ${inv.classroom.final_url} · título: "${inv.classroom.page_title}" · señales de sesión cerrada: ${yes(inv.classroom.logged_out_signals)}`, `- \`__NEXT_DATA__\` presente: ${yes(inv.classroom.next_data_present)}`, `- Cursos en JSON: ${inv.classroom.courses_in_json} · enlaces de curso en DOM: ${inv.classroom.course_links_in_dom}`, `- Claves de pageProps: ${inv.classroom.page_props_keys.join(', ') || '—'}`);
  if (inv.next_data_endpoint) L.push(`- Endpoint \`/_next/data\`: ${JSON.stringify(inv.next_data_endpoint)}`);
  L.push('');
  for (const c of inv.courses) {
    L.push(`### Curso \`${c.slug}\` — ${c.course?.title ?? '(sin árbol)'}`, '');
    if (!c.structure) {
      L.push('No se detectó árbol en el JSON de la página.', '');
      continue;
    }
    L.push(`- Ruta del árbol en JSON: \`${c.tree_json_path}\``, `- Módulos: ${c.counts.modules} · Lecciones: ${c.counts.lessons}`, `- Probablemente sin acceso: ${c.counts.lessons_probably_locked} · con campo de video: ${c.counts.lessons_with_video_field} · con descripción: ${c.counts.lessons_with_description} · con adjuntos: ${c.counts.lessons_with_attachments}`, `- Proveedores (por metadata): ${JSON.stringify(c.counts.video_providers)}`, `- Campos de orden explícito vistos: ${c.structure.order_fields_seen.join(', ') || 'ninguno (orden = posición en el arreglo)'}`, `- Orden JSON vs DOM: ${JSON.stringify(c.order_check)}`, '');
    L.push('Claves de metadata por unitType:', '', '```json', JSON.stringify(c.key_frequency, null, 2), '```', '');
  }
  const ok = inv.courses.filter((c) => c.counts);
  L.push('## Totales', '', `- Cursos: ${inv.courses.length} · módulos: ${ok.reduce((a, c) => a + c.counts.modules, 0)} · lecciones: ${ok.reduce((a, c) => a + c.counts.lessons, 0)}`, `- Lecciones con campo de video: ${ok.reduce((a, c) => a + c.counts.lessons_with_video_field, 0)} · con descripción: ${ok.reduce((a, c) => a + c.counts.lessons_with_description, 0)} · con adjuntos: ${ok.reduce((a, c) => a + c.counts.lessons_with_attachments, 0)} · probablemente sin acceso: ${ok.reduce((a, c) => a + c.counts.lessons_probably_locked, 0)}`, '');
  L.push('## Muestra de lecciones', '');
  let lastMod = null;
  for (const s of inv.samples) {
    if (s.module.id !== lastMod) {
      L.push(`### Curso ${s.course_slug ?? ''} · Módulo ${s.module.position}: ${s.module.title ?? '—'}`, '');
      lastMod = s.module.id;
    }
    if (s.error) {
      L.push(`${s.lesson.position}. **${s.lesson.title ?? s.lesson.id}**: error al abrir: ${s.error}`, '');
      continue;
    }
    const h = s.hls;
    L.push(
      `${s.lesson.position}. **${s.lesson.title ?? s.lesson.id}**`,
      `   - muestra: ${s.reason ?? '—'} · id: \`${s.lesson.id}\` · URL: ${s.lesson.lesson_url}`,
      `   - descripción: ${s.description.found ? `sí (${s.description.format}, ${s.description.length} chars, ${s.description.link_count} enlaces, ${s.description.image_count} imágenes)` : 'no'}`,
      `   - video (metadata): ${s.video_fields_in_tree.video_link_provider ?? (s.video_fields_in_tree.has_video_id ? 'id sin link' : 'no')} · campos: ${Object.keys(s.video_fields_in_tree.fields).join(', ') || '—'}`,
      `   - HLS: ${h.found ? `sí · ${h.master_host} · ${h.qualities.join('/')} · audio separado: ${yes(h.audio.length)}` : `no${s.screenshot ? ` (captura: out/${s.screenshot})` : ''}`}`,
    );
    if (h.found) {
      L.push(
        `   - firma master: ${JSON.stringify(h.master_signature)}`,
        `   - respuesta del master: ${JSON.stringify(h.master_status_without_cookies)}`,
        `   - origen del ID/token: ${h.manifest_url_source.map((x) => `${x.pattern} (url:${yes(x.has_url)} id:${yes(x.has_playback_id)} token:${yes(x.has_token)})`).join(', ') || 'no encontrado en respuestas capturadas'}`,
        `   - ID en __NEXT_DATA__: ${h.playback_id_in_next_data.map((x) => `${x.path} (token:${yes(x.has_token)})`).join(', ') || 'no'} · campo de metadata con el ID: ${h.manifest_id_matches_metadata_keys.join(', ') || 'ninguno'}`,
        `   - mux-player: ${h.mux_player ? `attrs=[${h.mux_player.attribute_names.join(', ')}] playback-id coincide: ${yes(h.mux_player.playback_id_matches)} token en atributo: ${yes(h.mux_player.has_playback_token_attr)}` : '—'}`,
      );
      for (const sub of h.subtitles)
        L.push(`   - subtítulos: ${sub.name} [${sub.language}] · segmentos ${sub.segments?.segment_count ?? '?'} (${sub.segments?.segment_extensions?.join(',') ?? '?'}) · WebVTT: ${yes(sub.first_segment_check?.is_webvtt)}`);
      if (!h.subtitles.length) L.push('   - subtítulos: ninguno en el master');
    }
    for (const a of s.attachments_in_tree) L.push(`   - adjunto: ${a.kind} · "${a.title ?? '—'}" · archivo: ${a.file_name ?? '—'} · tipo: ${a.content_type ?? '—'} · file_id: ${yes(a.has_file_id)} · host: ${a.link_host ?? '—'} · claves: ${a.keys.join(',')}`);
    L.push(
      `   - iframes: ${s.dom.iframes.map(hostOf).join(', ') || '—'} · player tags: ${s.dom.custom_player_tags.join(', ') || '—'}`,
      `   - adjuntos (metadata): ${s.attachments_in_tree.length} · enlaces a archivo (DOM): ${s.dom.file_links.length} · enlaces externos: ${s.dom.external_links.length} · imágenes grandes: ${s.dom.large_images.length}`,
      `   - clic de play: ${s.play_click ?? 'no'} · hosts externos: ${s.hosts_contacted.join(', ') || '—'} · bloqueado: ${s.blocked_in_lesson.length}`,
      `   - APIs Skool llamadas: ${[...new Set(s.api_calls.map((a) => a.pattern))].join(', ') || '—'}`,
      '',
    );
  }
  return L.join('\n');
}

main().catch((e) => {
  if (/has been closed|Target closed/i.test(String(e?.message))) {
    console.error('\nSe cerró la ventana del navegador antes de terminar. Vuelve a ejecutar el comando y deja la ventana abierta.');
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});

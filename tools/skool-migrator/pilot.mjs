#!/usr/bin/env node
// PILOTO de migración autorizada Skool → Supabase para POCAS lecciones (máx. 5).
//
// Por lección:
//   1. Abre la lección con la sesión del usuario (perfil local) y lee pageProps.video (playbackId + token).
//   2. Descarga la mejor variante de video + su audio y la pista de subtítulos, con la misma sesión
//      y el mismo Referer que usa la página de la lección.
//   3. Remux sin recodificar a MP4 (ffmpeg -c copy, faststart) y une los .vtt en un único archivo.
//   4. Verifica (duración vs videoLenMs, subtítulos dentro de la duración).
//   5. Sube a Supabase Storage (bucket privado course-media) y guarda la metadata en las tablas.
//   6. Borra el temporal.
//
// Uso (en el Mac, desde tools/skool-migrator):
//   node --env-file=.env pilot.mjs --url https://www.skool.com/<grupo>/classroom [--lessons id1,id2] [--auto 3]
//   Opciones: --no-upload (deja los archivos en out/ sin tocar Supabase), --keep-temp, --headless
// Requiere haber ejecutado antes tools/skool-audit/inventory.mjs (usa out/full-inventory.json).

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { downloadRendition, parseMaster, pickAudio, pickBest, playlistDuration } from './lib/hls.mjs';
import { mergeSegments } from './lib/vtt.mjs';

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
const UPLOAD = args['no-upload'] !== true;
const MAX_LESSONS = 5;
// Límite por archivo del plan de Supabase (Free = 50 MB). Con plan Pro: --max-file-mb 0 (sin límite) o el que configures.
const MAX_FILE_BYTES = Number(args['max-file-mb'] ?? 50) * 1048576;
const BUCKET = 'course-media';
const STREAM_BASE = args['stream-base'] ?? 'https://stream.video.skool.com';
const INVENTORY = path.resolve(here, args.inventory ?? '../skool-audit/out/full-inventory.json');
const PROFILE = path.resolve(here, args.profile ?? '../../.skool-profile');
const TMP = path.resolve(here, 'tmp');
const OUT = path.resolve(here, args.out ?? 'out');
// ffmpeg/ffprobe: variables de entorno > binario del sistema (p. ej. Homebrew) > paquetes npm estáticos.
const which = (bin) => {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const f = path.join(dir, bin);
    if (dir && existsSync(f)) return f;
  }
  return null;
};
const ffmpegPath = process.env.FFMPEG_PATH || which('ffmpeg') || ffmpegStatic;
const ffprobePath = process.env.FFPROBE_PATH || which('ffprobe') || ffprobeStatic.path;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

async function run(bin, argv) {
  try {
    return await runOnce(bin, argv);
  } catch (e) {
    if (!/SIGKILL|ENOEXEC|EAGAIN/.test(e.message)) throw e;
    await sleep(2000);
    return runOnce(bin, argv); // un reintento ante cierres transitorios del proceso
  }
}

function runOnce(bin, argv) {
  return new Promise((resolve, reject) => {
    let p;
    try {
      p = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return reject(e);
    }
    p.on('error', reject);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code, signal) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} salió con ${code ?? signal}: ${err.slice(-600)}`))));
  });
}

async function probe(file) {
  const hls = file.endsWith('.m3u8') ? ['-allowed_extensions', 'ALL'] : [];
  const j = JSON.parse(await run(ffprobePath, ['-v', 'error', ...hls, '-print_format', 'json', '-show_format', '-show_streams', file]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    duration_s: Number(j.format.duration),
    start_s: Number(j.format.start_time ?? 0),
    width: v?.width ?? null,
    height: v?.height ?? null,
    video_codec: v?.codec_name ?? null,
    audio_codec: a?.codec_name ?? null,
  };
}

async function sha256(file) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}

/** Todas las lecciones con video nativo, en el orden del classroom: curso → módulo → lección. */
function orderedNative(db) {
  const coursePos = Object.fromEntries(Object.values(db.courses).map((c) => [c.slug, c.position]));
  return Object.values(db.lessons)
    .filter((l) => l.native?.token_present)
    .sort((a, b) => (coursePos[a.course] ?? 99) - (coursePos[b.course] ?? 99) || (a.module_position ?? 0) - (b.module_position ?? 0) || a.position - b.position);
}

function pickLessons(db) {
  const all = Object.values(db.lessons);
  if (args.lessons) return String(args.lessons).split(',').map((id) => db.lessons[id.trim()]).filter(Boolean);
  const n = Math.min(Number(args.auto ?? 3), MAX_LESSONS);
  const ok = all.filter((l) => l.native?.token_present && l.native.master_status === 200 && l.native.subtitles?.length && l.video_len_ms);
  ok.sort((a, b) => a.video_len_ms - b.video_len_ms);
  // Variedad: la más corta en ≥1060p, la más corta en 720p y la más corta de otro curso.
  const picks = [];
  const add = (l) => l && !picks.includes(l) && picks.push(l);
  add(ok.find((l) => parseInt(l.native.qualities?.[0]) >= 1060));
  add(ok.find((l) => l.native.qualities?.[0] === '720p'));
  add(ok.find((l) => picks.length && l.course !== picks[0].course));
  for (const l of ok) if (picks.length < n) add(l);
  return picks.slice(0, n);
}

// ------------------------------------------------------------------ Supabase
const TRANSIENT = /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|50[234]/i;
/** Ejecuta una llamada de supabase-js ({ data, error }) con reintentos ante fallos de red transitorios. */
async function sbRetry(fn, what) {
  let r;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      r = await fn();
    } catch (e) {
      r = { error: e };
    }
    if (!r.error || !TRANSIENT.test(String(r.error.message ?? r.error))) return r;
    await sleep(1500 * 2 ** attempt);
  }
  console.log(`      (reintentos agotados en ${what})`);
  return r;
}
async function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  // Clave secreta nueva (sb_secret_…) o, por compatibilidad, la service_role (JWT) antigua.
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env (ver README).');
  if (!/^(sb_secret_[A-Za-z0-9_-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)$/.test(key)) {
    throw new Error(`La clave en .env no tiene un formato válido (empieza por "${key.slice(0, 6)}…", largo ${key.length}). Vuelve a crear .env (ver README).`);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  // Falla temprano (antes de descargar nada) si la clave o las tablas no están bien.
  const withTimeout = (p, what) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`Supabase no respondió en 20 s (${what}). Revisa tu conexión y SUPABASE_URL.`)), 20000))]);
  console.log('Comprobando conexión con Supabase…');
  const probeDb = await withTimeout(sb.from('courses').select('id').limit(1), 'tablas');
  if (probeDb.error) throw new Error(`Supabase rechazó la conexión: ${probeDb.error.message}`);
  const probeBucket = await withTimeout(sb.storage.from(BUCKET).list('', { limit: 1 }), 'storage');
  if (probeBucket.error) throw new Error(`No puedo acceder al bucket ${BUCKET}: ${probeBucket.error.message}`);
  console.log('Supabase OK ✓');
  return { sb, url, key };
}

/** Comprueba que ffmpeg y ffprobe se pueden ejecutar; si no, explica cómo arreglarlo. */
async function checkFfmpeg() {
  for (const [name, bin] of [['ffmpeg', ffmpegPath], ['ffprobe', ffprobePath]]) {
    try {
      await run(bin, ['-version']);
    } catch (e) {
      throw new Error(`${name} no funciona en este equipo (${bin}): ${e.message.slice(0, 120)}\nInstálalo con: brew install ffmpeg   (y vuelve a ejecutar; el script usa el del sistema automáticamente)`);
    }
  }
  console.log(`ffmpeg: ${ffmpegPath}\nffprobe: ${ffprobePath}`);
}

async function tusUpload({ url, key }, file, objectName, contentType) {
  const tus = await import('tus-js-client');
  const size = (await stat(file)).size;
  // Endpoint de almacenamiento directo recomendado para archivos grandes.
  const ref = new URL(url).hostname.split('.')[0];
  const endpoint = /\.supabase\.co$/.test(new URL(url).hostname) ? `https://${ref}.storage.supabase.co/storage/v1/upload/resumable` : `${url}/storage/v1/upload/resumable`;
  await new Promise((resolve, reject) => {
    const up = new tus.Upload(createReadStream(file), {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      // Las claves nuevas (sb_secret_) van solo en "apikey"; la service_role antigua (JWT) también en Authorization.
      headers: { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}), 'x-upsert': 'true' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // Supabase exige exactamente 6 MB
      uploadSize: size,
      metadata: { bucketName: BUCKET, objectName, contentType, cacheControl: '3600' },
      onError: reject,
      onProgress: (sent, total) => process.stdout.write(`\r      subiendo ${mb(sent)} / ${mb(total)}   `),
      onSuccess: () => {
        process.stdout.write('\n');
        resolve();
      },
    });
    up.start();
  });
}

async function upsertStructure(sb, db, l) {
  const c = db.courses[l.course];
  const mod = c.modules.find((m) => m.lesson_ids.includes(l.id));
  const moduleId = mod.id ?? `${c.id}:root`;
  const must = (r, what) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
  };
  must(await sbRetry(() => sb.from('courses').upsert({ id: c.id, slug: c.slug, title: c.title, cover_image_url: c.cover_image, position: c.position, source: c.access ?? {} }), 'courses'), 'courses');
  must(await sbRetry(() => sb.from('course_modules').upsert({ id: moduleId, course_id: c.id, position: mod.position ?? 0, title: mod.title ?? '(sin módulo)', is_implicit: !mod.id }), 'course_modules'), 'course_modules');
  must(
    await sbRetry(() => sb.from('lessons').upsert({
      id: l.id,
      course_id: c.id,
      module_id: moduleId,
      position: l.position,
      title: l.title,
      body_raw: l.text?.raw ?? null,
      body_format: l.text?.format ?? null,
      source_url: l.lesson_url,
      accessible: true,
    }), 'lessons'),
    'lessons',
  );
  return { courseId: c.id, moduleId };
}

// ------------------------------------------------------------------ una lección
/** Video que no cabe en el límite por archivo del plan: se salta (no es un error). */
class TooBigError extends Error {
  constructor(bytes, exact) {
    super(`${exact ? '' : '≈ '}${mb(bytes)} supera el límite de ${mb(MAX_FILE_BYTES)} por archivo del plan`);
    this.bytes = bytes;
  }
}

// Envoltorio: los temporales se borran SIEMPRE, también cuando la lección falla (si no, el disco se llena).
async function migrateLesson(ctx, page, l, supa, db) {
  const dir = path.join(TMP, l.id);
  try {
    return await migrateLessonInner(ctx, page, l, supa, db, dir);
  } finally {
    if (!args['keep-temp']) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function migrateLessonInner(ctx, page, l, supa, db, dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const t0 = Date.now();

  // 1) Token fresco desde la página de la lección (la misma que ve el usuario). Reintenta si Skool tarda.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(l.lesson_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`    (Skool no respondió, reintento ${attempt + 1}/3…)`);
      await sleep(5000 * attempt);
    }
  }
  await sleep(1500);
  const video = await page.evaluate(() => {
    try {
      const pp = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
      const v = pp.video?.playbackId ? pp.video : pp.renderData?.video;
      return v?.playbackId && v?.playbackToken ? { playbackId: v.playbackId, playbackToken: v.playbackToken } : null;
    } catch {
      return null;
    }
  });
  if (!video) throw new Error('La página no entregó playbackId/token (¿sin acceso?)');

  // Peticiones con la sesión del navegador y el Referer de la propia lección, como el reproductor.
  const get = async (u) => {
    const r = await ctx.request.get(u, { headers: { referer: l.lesson_url }, timeout: 120000 });
    if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
    return r.body();
  };
  const masterUrl = `${STREAM_BASE}/${video.playbackId}.m3u8?token=${video.playbackToken}`;
  const master = parseMaster((await get(masterUrl)).toString('utf8'), masterUrl);
  const best = pickBest(master.variants);
  const audio = pickAudio(master.media, best.audio);
  const subs = master.media.filter((m) => m.type === 'SUBTITLES' && m.uri);
  console.log(`    variante ${best.width}x${best.height} · audio ${audio ? 'separado' : 'incluido'} · subtítulos: ${subs.map((s) => s.language).join(',') || 'no'}`);

  // 2) Descarga de video y audio (segmentos a disco temporal).
  const progress = (label) => (d, t, b) => process.stdout.write(`\r      ${label}: ${d}/${t} segmentos · ${mb(b)}   `);
  const vText = (await get(best.uri)).toString('utf8');
  // Duración real del video (suma de segmentos) y tamaño estimado ANTES de descargar nada.
  const srcDuration = playlistDuration(vText);
  if (MAX_FILE_BYTES && best.bandwidth && srcDuration) {
    const est = (best.bandwidth / 8) * srcDuration;
    // BANDWIDTH es el pico: solo se salta sin descargar cuando es claramente demasiado grande.
    if (est * 0.6 > MAX_FILE_BYTES) throw new TooBigError(est * 0.6, false);
  }
  const v = await downloadRendition({ text: vText, baseUrl: best.uri, dir: path.join(dir, 'video'), get, onProgress: progress('video') });
  process.stdout.write('\n');
  let a = null;
  if (audio) {
    const aText = (await get(audio.uri)).toString('utf8');
    a = await downloadRendition({ text: aText, baseUrl: audio.uri, dir: path.join(dir, 'audio'), get, onProgress: progress('audio') });
    process.stdout.write('\n');
  }

  // 3) Remux sin recodificar.
  const mp4 = path.join(dir, 'video.mp4');
  const inputs = ['-allowed_extensions', 'ALL', '-protocol_whitelist', 'file', '-i', v.playlistPath];
  if (a) inputs.push('-allowed_extensions', 'ALL', '-protocol_whitelist', 'file', '-i', a.playlistPath);
  await run(ffmpegPath, ['-y', '-v', 'error', ...inputs, '-map', '0:v:0', '-map', a ? '1:a:0' : '0:a:0?', '-c', 'copy', '-movflags', '+faststart', mp4]);
  const info = await probe(mp4);
  const srcStart = (await probe(v.playlistPath)).start_s; // inicio del video HLS, para alinear subtítulos
  const size = (await stat(mp4)).size;
  // La referencia es el propio stream (suma de segmentos). El videoLenMs de Skool a veces es de una
  // versión anterior del video: si no coincide solo se avisa.
  const close = (a, b) => Math.abs(a - b) <= Math.max(3, b * 0.02);
  const expected = srcDuration || (l.video_len_ms ? l.video_len_ms / 1000 : null);
  const durationOk = expected == null || close(info.duration_s, expected);
  console.log(`    MP4 ${info.width}x${info.height} ${info.video_codec}/${info.audio_codec} · ${mb(size)} · ${info.duration_s.toFixed(1)} s (stream ${expected?.toFixed(1) ?? '?'} s) ${durationOk ? '✓' : '✗'}`);
  if (!durationOk) throw new Error('La duración del MP4 no coincide con la del stream');
  if (l.video_len_ms && !close(info.duration_s, l.video_len_ms / 1000))
    console.log(`    (aviso: Skool indica ${(l.video_len_ms / 1000).toFixed(1)} s; se usa la duración real del stream)`);
  if (MAX_FILE_BYTES && size > MAX_FILE_BYTES) throw new TooBigError(size, true);

  // 4) Subtítulos: todos los segmentos .vtt → un archivo por idioma.
  const tracks = [];
  for (const s of subs) {
    const pl = (await get(s.uri)).toString('utf8');
    const uris = pl.split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#')).map((x) => new URL(x, s.uri).toString());
    const texts = [];
    for (const u of uris) texts.push((await get(u)).toString('utf8'));
    const merged = mergeSegments(texts, srcStart);
    const lang = s.language || 'und';
    const file = path.join(dir, `${lang}.vtt`);
    await writeFile(file, merged.vtt);
    const inRange = merged.lastEnd <= info.duration_s + 2 && merged.firstStart >= -0.5;
    console.log(`    subtítulos ${lang}: ${merged.cueCount} cues · ${merged.firstStart.toFixed(1)}–${merged.lastEnd.toFixed(1)} s ${inRange ? '✓' : '✗ fuera de rango'}`);
    if (!merged.cueCount || !inRange) throw new Error(`Subtítulos ${lang} inválidos`);
    tracks.push({ lang, label: s.name || lang, isDefault: s.default, file, cueCount: merged.cueCount });
  }

  // Miniatura propia: un cuadro del video (al 15 %, evitando la pantalla negra inicial).
  const thumb = path.join(dir, 'thumb.jpg');
  let thumbOk = false;
  try {
    const at = Math.max(1, Math.min(info.duration_s * 0.15, 30)).toFixed(1);
    await run(ffmpegPath, ['-y', '-v', 'error', '-ss', at, '-i', mp4, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', thumb]);
    thumbOk = true;
  } catch {
    /* sin miniatura: la app usa un degradado */
  }

  const checksum = await sha256(mp4);
  const base = `courses/${l.course}/lessons/${l.id}`;
  const result = { lesson: l, info, size, checksum, tracks, videoPath: `${base}/video.mp4`, seconds: Math.round((Date.now() - t0) / 1000) };

  // 5) Subida + metadata.
  if (supa) {
    await upsertStructure(supa.sb, db, l);
    await sbRetry(() => supa.sb.from('lesson_videos').upsert({ lesson_id: l.id, provider: 'skool-mux', source_video_id: l.skool_video_id, playback_id: video.playbackId, status: 'processing', updated_at: new Date().toISOString() }), 'lesson_videos');
    if (MAX_FILE_BYTES && size > MAX_FILE_BYTES) throw new Error(`pendiente: el MP4 pesa ${mb(size)} y el plan admite ${mb(MAX_FILE_BYTES)} por archivo`);
    await tusUpload(supa, mp4, result.videoPath, 'video/mp4');
    for (const t of tracks) {
      const p = `${base}/subtitles/${t.lang}.vtt`;
      const body = await readFile(t.file);
      const up = await sbRetry(() => supa.sb.storage.from(BUCKET).upload(p, body, { contentType: 'text/vtt', upsert: true }), 'subtítulos');
      if (up.error) throw new Error(`subida ${p}: ${up.error.message}`);
      const r = await sbRetry(() => supa.sb.from('lesson_subtitles').upsert(
        { lesson_id: l.id, language: t.lang, label: t.label, is_default: t.isDefault, cue_count: t.cueCount, storage_path: p, status: 'stored', updated_at: new Date().toISOString() },
        { onConflict: 'lesson_id,language' },
      ), 'lesson_subtitles');
      if (r.error) throw new Error(`lesson_subtitles: ${r.error.message}`);
      t.storagePath = p;
    }
    const r = await sbRetry(() => supa.sb.from('lesson_videos').upsert({
      lesson_id: l.id,
      provider: 'skool-mux',
      source_video_id: l.skool_video_id,
      playback_id: video.playbackId,
      duration_ms: Math.round(info.duration_s * 1000),
      width: info.width,
      height: info.height,
      video_codec: info.video_codec,
      audio_codec: info.audio_codec,
      size_bytes: size,
      checksum_sha256: checksum,
      storage_path: result.videoPath,
      status: 'stored',
      error: null,
      migrated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }), 'lesson_videos');
    if (r.error) throw new Error(`lesson_videos: ${r.error.message}`);
    // Verificación: el objeto existe en Storage con el tamaño esperado.
    const folder = await sbRetry(() => supa.sb.storage.from(BUCKET).list(base, { search: 'video.mp4' }), 'verificación');
    const obj = folder.data?.find((o) => o.name === 'video.mp4');
    if (!obj || Number(obj.metadata?.size) !== size) throw new Error('Verificación de Storage falló (tamaño distinto o no existe)');
    if (thumbOk) {
      const tp = `thumbs/${l.id}.jpg`;
      const tb = await readFile(thumb);
      const up = await sbRetry(() => supa.sb.storage.from(BUCKET).upload(tp, tb, { contentType: 'image/jpeg', upsert: true, cacheControl: '604800' }), 'miniatura');
      if (!up.error) await sbRetry(() => supa.sb.from('lessons').update({ thumbnail_path: tp, duration_ms: Math.round(info.duration_s * 1000) }).eq('id', l.id), 'miniatura en lessons');
    }
    console.log('    Supabase: video, subtítulos y metadata guardados ✓');
  } else {
    // Sin subida: se conservan los archivos en out/ para revisarlos localmente.
    const keep = path.join(OUT, l.id);
    await mkdir(keep, { recursive: true });
    await run(ffmpegPath, ['-y', '-v', 'error', '-i', mp4, '-c', 'copy', path.join(keep, 'video.mp4')]);
    for (const t of tracks) await writeFile(path.join(keep, `${t.lang}.vtt`), await readFile(t.file));
    result.localDir = keep;
  }

  return result;
}

// ------------------------------------------------------------------ player de prueba
async function writePlayer(results, supa) {
  const rows = [];
  for (const r of results) {
    let videoSrc;
    const trackSrcs = [];
    if (supa) {
      videoSrc = (await supa.sb.storage.from(BUCKET).createSignedUrl(r.videoPath, 3600)).data?.signedUrl;
      for (const t of r.tracks) trackSrcs.push({ ...t, src: (await supa.sb.storage.from(BUCKET).createSignedUrl(t.storagePath, 3600)).data?.signedUrl });
    } else {
      videoSrc = `${r.lesson.id}/video.mp4`;
      for (const t of r.tracks) trackSrcs.push({ ...t, src: `${r.lesson.id}/${t.lang}.vtt` });
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    rows.push(`<section><h2>${esc(r.lesson.title)}</h2><p>${r.info.width}x${r.info.height} · ${mb(r.size)} · ${r.info.duration_s.toFixed(0)} s</p>
<video controls preload="metadata" crossorigin="anonymous" src="${esc(videoSrc)}">
${trackSrcs.map((t) => `  <track kind="subtitles" srclang="${esc(t.lang)}" label="${esc(t.label)}" src="${esc(t.src)}">`).join('\n')}
</video></section>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Piloto migración</title>
<style>body{font:16px system-ui;max-width:900px;margin:24px auto;padding:0 16px}video{width:100%;background:#000}section{margin-bottom:40px}</style>
<h1>Piloto de migración</h1><p>Enlaces firmados válidos 1 hora. Usa el botón CC del reproductor para activar/desactivar subtítulos.</p>
${rows.join('\n')}`;
  const file = path.join(OUT, 'pilot-player.html');
  await mkdir(OUT, { recursive: true });
  await writeFile(file, html);
  return file;
}

// ------------------------------------------------------------------ main
async function main() {
  const db = JSON.parse(await readFile(INVENTORY, 'utf8'));
  const ALL = args.all === true;
  // Restos de ejecuciones anteriores (pueden ocupar varios GB).
  if (!args['keep-temp']) await rm(TMP, { recursive: true, force: true });
  await checkFfmpeg();
  const supa = UPLOAD ? await supabaseClient() : null;
  let lessons;
  let knownBig = new Set();
  // Presupuesto de almacenamiento (modo --all): se detiene ANTES de pasarse.
  const budgetBytes = Number(args['budget-gb'] ?? 0.95) * 1073741824;
  let usedBytes = 0;
  if (ALL) {
    if (!supa) throw new Error('--all requiere subir a Supabase (no uses --no-upload).');
    const done = await sbRetry(() => supa.sb.from('lesson_videos').select('lesson_id,size_bytes,status').eq('status', 'stored'), 'lesson_videos');
    // Ya sabemos que estos no caben en el plan actual: no se vuelven a descargar.
    const big = MAX_FILE_BYTES
      ? await sbRetry(() => supa.sb.from('lesson_videos').select('lesson_id,size_bytes').eq('status', 'skipped').gt('size_bytes', MAX_FILE_BYTES), 'lesson_videos')
      : { data: [] };
    knownBig = new Set(big.data.map((r) => r.lesson_id));
    if (done.error) throw new Error(done.error.message);
    const stored = new Set(done.data.map((r) => r.lesson_id));
    usedBytes = done.data.reduce((s, r) => s + Number(r.size_bytes ?? 0), 0) + 50 * 1048576; // + margen para miniaturas y subtítulos
    lessons = orderedNative(db).filter((l) => !stored.has(l.id));
    console.log(`Migración en orden: ${stored.size} ya subidas · ${lessons.length} pendientes · usado ≈ ${mb(usedBytes)} de ${mb(budgetBytes)}`);
  } else {
    lessons = pickLessons(db);
    if (lessons.length > MAX_LESSONS) throw new Error(`El piloto admite como máximo ${MAX_LESSONS} lecciones (usa --all para migrar en orden).`);
  }
  if (!lessons.length) throw new Error(ALL ? 'No quedan videos pendientes. ✓' : 'No encontré lecciones válidas en el inventario.');
  console.log(`${ALL ? 'Migración' : 'Piloto'}: ${lessons.length} lecciones · subida a Supabase: ${UPLOAD ? 'sí' : 'no'}`);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: args.headless === true,
    viewport: { width: 1280, height: 800 },
    ...(args.chromium || process.env.CHROMIUM_PATH ? { executablePath: args.chromium || process.env.CHROMIUM_PATH } : {}),
  });
  // La página no reproduce nada: el reproductor no descarga segmentos por su cuenta.
  await ctx.route('**/*', (route) => (route.request().resourceType() === 'media' ? route.abort() : route.continue()));
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  const results = [];
  let stoppedByBudget = false;
  let skippedBig = 0;
  for (const l of lessons) {
    // Estimación prudente con el bitrate real observado (hasta ~0,13 MB/s).
    const estimate = ((l.video_len_ms ?? 600000) / 1000) * 0.13 * 1048576;
    if (ALL && knownBig.has(l.id)) {
      skippedBig++;
      continue;
    }
    if (ALL && MAX_FILE_BYTES && l.video_len_ms && estimate > MAX_FILE_BYTES) {
      skippedBig++;
      console.log(`\n· ${l.course} ${l.module_position}.${l.position} ${l.title}: se salta (≈ ${mb(estimate)} > límite de ${mb(MAX_FILE_BYTES)} por archivo del plan)`);
      continue;
    }
    if (ALL && usedBytes + estimate > budgetBytes) {
      // No cabe este, pero quizá sí uno más corto de los siguientes: se sigue hasta que quede muy poco espacio.
      stoppedByBudget = true;
      if (budgetBytes - usedBytes < 8 * 1048576) {
        console.log(`\n■ Presupuesto agotado: usado ≈ ${mb(usedBytes)} de ${mb(budgetBytes)}.`);
        break;
      }
      continue;
    }
    console.log(`\n▶ ${l.course} ${l.module_position}.${l.position} ${l.title}`);
    try {
      const r = await migrateLesson(ctx, page, l, supa, db);
      results.push(r);
      usedBytes += r.size;
      console.log(`    listo en ${r.seconds} s${ALL ? ` · usado ≈ ${mb(usedBytes)}` : ''}`);
    } catch (e) {
      if (e instanceof TooBigError) {
        skippedBig++;
        console.log(`    · se salta: ${e.message} (se subirá con el plan Pro)`);
        if (supa) await supa.sb.from('lesson_videos').upsert({ lesson_id: l.id, provider: 'skool-mux', status: 'skipped', size_bytes: Math.round(e.bytes), error: e.message, updated_at: new Date().toISOString() });
        continue;
      }
      console.log(`    ✗ ${e.message}`);
      if (supa) await supa.sb.from('lesson_videos').upsert({ lesson_id: l.id, provider: 'skool-mux', status: 'failed', error: String(e.message).slice(0, 500), updated_at: new Date().toISOString() });
    }
  }
  await ctx.close();
  if (ALL) {
    console.log(`\nResumen: ${results.length} videos subidos en esta pasada · ${skippedBig} saltados por tamaño · usado ≈ ${mb(usedBytes)} de ${mb(budgetBytes)}${stoppedByBudget ? ' · el resto no cabe en el presupuesto (sube el plan y vuelve a ejecutar para continuar)' : ''}`);
    if (results.length < lessons.length && !stoppedByBudget) process.exitCode = 1;
    return;
  }
  if (results.length) {
    const player = await writePlayer(results, supa);
    const total = results.reduce((s, r) => s + r.size, 0);
    const secs = results.reduce((s, r) => s + r.info.duration_s, 0);
    console.log(`\nResumen: ${results.length}/${lessons.length} lecciones · ${mb(total)} para ${(secs / 60).toFixed(1)} min de video (≈ ${((total / secs) * 3600 / 1073741824).toFixed(2)} GB por hora)`);
    console.log(`Abre el reproductor de prueba: open "${player}"`);
  }
  if (results.length < lessons.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

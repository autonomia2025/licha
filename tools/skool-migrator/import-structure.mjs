#!/usr/bin/env node
// Importa a Supabase la ESTRUCTURA COMPLETA del classroom (sin videos):
//   cursos, módulos y lecciones en su orden, texto de cada lección, tipo (video / texto / externo),
//   enlaces de Loom/YouTube/Vimeo, duración, y copia portadas y miniaturas a Storage (son livianas).
//
// Los videos se migran aparte con pilot.mjs --all (respetando el presupuesto de almacenamiento).
//
// Uso (en el Mac, desde tools/skool-migrator):
//   node --env-file=.env import-structure.mjs --url https://www.skool.com/<grupo>/classroom [--no-images]
// Requiere ../skool-audit/out/full-inventory.json y la sesión de Skool en .skool-profile/.

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { findCourseTree } from '../skool-audit/lib/tree.mjs';

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
const GROUP = START.pathname.split('/').filter(Boolean)[0];
const BUCKET = 'course-media';
const INVENTORY = path.resolve(here, args.inventory ?? '../skool-audit/out/full-inventory.json');
const PROFILE = path.resolve(here, args.profile ?? '../../.skool-profile');
const IMAGES = args['no-images'] !== true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = process.env.SUPABASE_URL;
const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env (ver README).');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function retry(fn, what) {
  let r;
  for (let i = 0; i < 5; i++) {
    try {
      r = await fn();
    } catch (e) {
      r = { error: e };
    }
    if (!r.error) return r;
    if (!/fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|50[234]/i.test(String(r.error.message ?? r.error))) break;
    await sleep(1500 * 2 ** i);
  }
  throw new Error(`${what}: ${r.error.message ?? r.error}`);
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const kindOf = (l) => (l.native?.token_present ? 'video' : l.external_video_url || ['loom', 'youtube', 'vimeo'].includes(l.video_provider) ? 'externo' : 'texto');

/** Copia una imagen pública de Skool a Storage. Devuelve la ruta o null. */
async function copyImage(ctx, src, dest) {
  if (!IMAGES || !src || !/^https?:/.test(src)) return null;
  try {
    const r = await ctx.request.get(src, { timeout: 30000 });
    if (!r.ok()) return null;
    const type = (r.headers()['content-type'] || 'image/jpeg').split(';')[0];
    if (!type.startsWith('image/')) return null;
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type] ?? 'jpg';
    const p = `${dest}.${ext}`;
    const buf = await r.body();
    await retry(() => sb.storage.from(BUCKET).upload(p, buf, { contentType: type, upsert: true, cacheControl: '604800' }), `imagen ${p}`);
    return p;
  } catch {
    return null;
  }
}

async function main() {
  const db = JSON.parse(await readFile(INVENTORY, 'utf8'));
  const courses = Object.values(db.courses).sort((a, b) => a.position - b.position);
  console.log(`Importando ${courses.length} cursos · ${Object.keys(db.lessons).length} lecciones · imágenes: ${IMAGES ? 'sí' : 'no'}`);

  const probe = await sb.from('courses').select('id').limit(1);
  if (probe.error) throw new Error(`Supabase rechazó la conexión: ${probe.error.message}`);

  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: args.headless === true, viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', (route) => (['media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue()));
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  let totals = { courses: 0, modules: 0, lessons: 0, images: 0 };
  for (const c of courses) {
    process.stdout.write(`\n▶ ${c.slug} ${c.title}\n`);
    // Metadatos originales del árbol (portada y miniaturas sin redactar).
    await page.goto(`${START.origin}/${GROUP}/classroom/${c.slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);
    const nd = await page.evaluate(() => {
      try {
        return JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
      } catch {
        return null;
      }
    });
    const tree = nd ? findCourseTree(nd) : null;
    const meta = new Map();
    (function walk(n) {
      if (!n) return;
      meta.set(n.id, n.metadata ?? {});
      n.children?.forEach(walk);
    })(tree?.node);
    const courseMeta = meta.get(c.id) ?? {};

    const coverPath = await copyImage(ctx, courseMeta.coverImage, `covers/${c.id}`);
    if (coverPath) totals.images++;
    await retry(
      () =>
        sb.from('courses').upsert({
          id: c.id,
          slug: c.slug,
          title: c.title,
          description: typeof courseMeta.desc === 'string' ? courseMeta.desc : null,
          cover_image_url: courseMeta.coverImage || null,
          ...(coverPath ? { cover_path: coverPath } : {}),
          position: c.position,
          source: c.access ?? {},
          updated_at: new Date().toISOString(),
        }),
      'courses',
    );
    totals.courses++;

    const modules = c.modules.map((m) => ({
      id: m.id ?? `${c.id}:root`,
      course_id: c.id,
      position: m.position ?? 0,
      title: m.title ?? c.title,
      is_implicit: !m.id,
      updated_at: new Date().toISOString(),
    }));
    await retry(() => sb.from('course_modules').upsert(modules), 'course_modules');
    totals.modules += modules.length;

    const rows = [];
    const videos = [];
    for (const m of c.modules) {
      for (const id of m.lesson_ids) {
        const l = db.lessons[id];
        if (!l) continue;
        const md = meta.get(id) ?? {};
        const thumb = md.videoThumbnail || null;
        const thumbPath = l.accessible !== false ? await copyImage(ctx, thumb, `thumbs/${id}`) : null;
        if (thumbPath) totals.images++;
        const kind = kindOf(l);
        rows.push({
          id,
          course_id: c.id,
          module_id: m.id ?? `${c.id}:root`,
          position: l.position,
          title: l.title,
          body_raw: l.text?.raw ?? null,
          body_format: l.text?.format ?? null,
          source_url: l.lesson_url,
          accessible: Boolean(l.accessible) && !(l.native && !l.native.token_present),
          kind,
          duration_ms: l.video_len_ms ?? (md.videoLenMs ? Number(md.videoLenMs) : null),
          ...(thumbPath ? { thumbnail_path: thumbPath } : {}),
          updated_at: new Date().toISOString(),
        });
        if (kind === 'video') {
          videos.push({ lesson_id: id, provider: 'skool-mux', source_video_id: l.skool_video_id ?? null, duration_ms: l.video_len_ms ?? null, status: 'discovered' });
        } else if (kind === 'externo') {
          const provider = ['loom', 'youtube', 'vimeo'].includes(l.video_provider) ? l.video_provider : 'other';
          videos.push({ lesson_id: id, provider, external_url: l.external_video_url ?? null, duration_ms: l.video_len_ms ?? null, status: 'skipped' });
        }
      }
    }
    for (const part of chunks(rows, 100)) await retry(() => sb.from('lessons').upsert(part), 'lessons');
    // No pisa videos ya migrados: solo inserta los que faltan.
    for (const part of chunks(videos, 100)) await retry(() => sb.from('lesson_videos').upsert(part, { onConflict: 'lesson_id', ignoreDuplicates: true }), 'lesson_videos');
    // Los externos sí se actualizan (URL/proveedor pueden cambiar).
    const ext = videos.filter((v) => v.status === 'skipped');
    for (const part of chunks(ext, 100)) await retry(() => sb.from('lesson_videos').upsert(part), 'lesson_videos externos');
    totals.lessons += rows.length;
    console.log(`  ${modules.length} módulos · ${rows.length} lecciones (${rows.filter((r) => r.accessible).length} accesibles)`);
  }
  await ctx.close();
  console.log(`\nListo: ${totals.courses} cursos · ${totals.modules} módulos · ${totals.lessons} lecciones · ${totals.images} imágenes copiadas`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

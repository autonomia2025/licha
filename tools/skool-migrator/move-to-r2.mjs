#!/usr/bin/env node
// Copia a Cloudflare R2 todos los archivos que la app usa desde Supabase Storage
// (videos, subtítulos, miniaturas y portadas), con las MISMAS rutas, y verifica cada uno.
// Se puede ejecutar varias veces: salta lo que ya está en R2 con el mismo tamaño.
//
//   node --env-file=.env move-to-r2.mjs            copia y verifica (no borra nada)
//   node --env-file=.env move-to-r2.mjs --delete   además borra de Supabase lo ya verificado en R2
//
// Requiere en .env: SUPABASE_URL, SUPABASE_SECRET_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { createClient } from '@supabase/supabase-js';
import { r2FromEnv } from './lib/r2.mjs';

const BUCKET = 'course-media';
const DELETE = process.argv.includes('--delete');
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

const url = process.env.SUPABASE_URL;
const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env.');
const r2 = r2FromEnv();
if (!r2) throw new Error('Faltan las variables R2_* en .env (ver README).');
const sb = createClient(url, key, { auth: { persistSession: false } });

const typeOf = (p, fallback) =>
  p.endsWith('.mp4') ? 'video/mp4' : p.endsWith('.vtt') ? 'text/vtt; charset=utf-8' : p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : fallback || 'image/jpeg';

async function all(table, cols, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function main() {
  console.log('Comprobando Supabase y R2…');
  await r2.check();
  // CORS: el reproductor (crossOrigin) y la transcripción leen desde el navegador en estos dominios.
  const origins = (process.env.R2_CORS_ORIGINS || 'https://estudio-de-licha.vercel.app,https://evolve-alumnos.vercel.app,http://localhost:3000').split(',').map((s) => s.trim());
  try {
    await r2.setCors(origins);
    console.log(`CORS del bucket configurado para: ${origins.join(', ')} ✓`);
  } catch (e) {
    console.log(`(aviso) No pude configurar CORS con esta clave: ${e.message.slice(0, 120)}. Se configura aparte (ver README).`);
  }
  const [videos, subs, lessons, courses] = await Promise.all([
    all('lesson_videos', 'storage_path', (q) => q.eq('status', 'stored').not('storage_path', 'is', null)),
    all('lesson_subtitles', 'storage_path', (q) => q.eq('status', 'stored').not('storage_path', 'is', null)),
    all('lessons', 'thumbnail_path', (q) => q.not('thumbnail_path', 'is', null)),
    all('courses', 'cover_path', (q) => q.not('cover_path', 'is', null)),
  ]);
  const paths = [...new Set([...videos.map((r) => r.storage_path), ...subs.map((r) => r.storage_path), ...lessons.map((r) => r.thumbnail_path), ...courses.map((r) => r.cover_path)])].filter(
    (p) => p && !p.startsWith('/'),
  );
  console.log(`Archivos a copiar: ${paths.length} (${videos.length} videos, ${subs.length} subtítulos, ${lessons.length} miniaturas, ${courses.length} portadas)\n`);

  const verified = [];
  const failed = [];
  let copiedBytes = 0;
  for (const [i, p] of paths.entries()) {
    const tag = `[${i + 1}/${paths.length}] ${p}`;
    try {
      const { data: blob, error } = await sb.storage.from(BUCKET).download(p);
      if (error || !blob) {
        // Puede que ya no esté en Supabase (borrado en una pasada anterior): basta con que exista en R2.
        if ((await r2.size(p)) !== null) {
          verified.push(p);
          console.log(`${tag} · ya estaba en R2 ✓`);
          continue;
        }
        throw new Error(`no se pudo descargar de Supabase: ${error?.message ?? 'vacío'}`);
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      if ((await r2.size(p)) === buf.length) {
        verified.push(p);
        console.log(`${tag} · ya estaba en R2 ✓`);
        continue;
      }
      await r2.putBuffer(p, buf, typeOf(p, blob.type), p.endsWith('.mp4') || p.endsWith('.vtt') ? undefined : 'public, max-age=604800');
      const got = await r2.size(p);
      if (got !== buf.length) throw new Error(`verificación: R2 tiene ${got} bytes y Supabase ${buf.length}`);
      verified.push(p);
      copiedBytes += buf.length;
      console.log(`${tag} · ${mb(buf.length)} ✓`);
    } catch (e) {
      failed.push(p);
      console.log(`${tag} · ✗ ${e.message}`);
    }
  }

  console.log(`\nCopiados ${mb(copiedBytes)} · verificados en R2: ${verified.length}/${paths.length}${failed.length ? ` · fallidos: ${failed.length} (vuelve a ejecutar)` : ''}`);
  if (!DELETE) {
    console.log('Nada se borró de Supabase. Cuando la app ya use R2 y todo se vea bien, ejecuta con --delete para liberar espacio.');
    return;
  }
  if (failed.length) {
    console.log('No borro nada de Supabase porque hubo archivos que fallaron. Vuelve a ejecutar hasta que no haya fallos.');
    process.exitCode = 1;
    return;
  }
  for (let i = 0; i < verified.length; i += 100) {
    const batch = verified.slice(i, i + 100);
    const { error } = await sb.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`borrado en Supabase: ${error.message}`);
  }
  console.log(`Borrados de Supabase Storage: ${verified.length} archivos ✓ (siguen en R2)`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});

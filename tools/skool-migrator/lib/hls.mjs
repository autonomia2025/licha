// Descarga de una rendición HLS (media playlist) a disco y reescritura de la playlist con rutas locales.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const resolve = (u, base) => new URL(u, base).toString();

/** Variantes y renditions del master (solo lo necesario para elegir). */
export function parseMaster(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const attrs = (l) => {
    const o = {};
    const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
    let m;
    const body = l.slice(l.indexOf(':') + 1);
    while ((m = re.exec(body))) o[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
    return o;
  };
  const variants = [];
  const media = [];
  lines.forEach((l, i) => {
    if (l.startsWith('#EXT-X-STREAM-INF')) {
      const a = attrs(l);
      const uri = lines.slice(i + 1).find((x) => x && !x.startsWith('#'));
      const [w, h] = (a.RESOLUTION ?? '0x0').split('x').map(Number);
      variants.push({ width: w, height: h, bandwidth: Number(a.BANDWIDTH ?? 0), codecs: a.CODECS, audio: a.AUDIO, subtitles: a.SUBTITLES, uri: resolve(uri, baseUrl) });
    } else if (l.startsWith('#EXT-X-MEDIA')) {
      const a = attrs(l);
      media.push({ type: a.TYPE, group: a['GROUP-ID'], name: a.NAME, language: a.LANGUAGE, default: a.DEFAULT === 'YES', uri: a.URI ? resolve(a.URI, baseUrl) : null });
    }
  });
  return { variants, media };
}

/** Mejor variante: mayor altura y, a igualdad, mayor bitrate. */
export function pickBest(variants) {
  return [...variants].sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth)[0];
}

/** Rendición de audio del grupo de la variante (la DEFAULT si hay varias). */
export function pickAudio(media, group) {
  const g = media.filter((m) => m.type === 'AUDIO' && m.group === group && m.uri);
  return g.find((m) => m.default) ?? g[0] ?? null;
}

/** Lista de URIs (init + segmentos) de una media playlist, y la playlist reescrita con nombres locales. */
export function planMediaPlaylist(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const files = [];
  const out = [];
  let n = 0;
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('#EXT-X-MAP')) {
      const uri = l.match(/URI="([^"]+)"/)?.[1];
      if (uri) {
        const ext = path.extname(new URL(uri, baseUrl).pathname) || '.mp4';
        const name = `init${ext}`;
        files.push({ url: resolve(uri, baseUrl), name });
        out.push(l.replace(/URI="[^"]+"/, `URI="${name}"`));
        continue;
      }
    }
    if (l.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(l)) throw new Error('Segmentos cifrados (EXT-X-KEY): no soportado en el piloto');
    if (l && !l.startsWith('#')) {
      const ext = path.extname(new URL(l, baseUrl).pathname) || '.ts';
      const name = `${String(n++).padStart(5, '0')}${ext}`;
      files.push({ url: resolve(l, baseUrl), name });
      out.push(name);
      continue;
    }
    out.push(raw);
  }
  return { files, localPlaylist: out.join('\n') };
}

/**
 * Descarga los archivos de una media playlist. `get(url)` devuelve un Buffer (lo provee el llamador,
 * usando la sesión autorizada). Concurrencia limitada y reintentos.
 */
export async function downloadRendition({ text, baseUrl, dir, get, concurrency = 4, onProgress }) {
  await mkdir(dir, { recursive: true });
  const { files, localPlaylist } = planMediaPlaylist(text, baseUrl);
  let done = 0;
  let bytes = 0;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const buf = await get(f.url);
          await writeFile(path.join(dir, f.name), buf);
          bytes += buf.length;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      if (lastErr) throw new Error(`Falló ${f.name}: ${lastErr.message}`);
      onProgress?.(++done, files.length, bytes);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  const playlistPath = path.join(dir, 'index.m3u8');
  await writeFile(playlistPath, localPlaylist);
  return { playlistPath, count: files.length, bytes };
}

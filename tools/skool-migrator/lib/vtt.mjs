// Une los segmentos WebVTT de una playlist HLS en un único archivo .vtt alineado con el MP4 final.
//
// En HLS cada segmento .vtt puede traer `X-TIMESTAMP-MAP=MPEGTS:<pts>,LOCAL:<hh:mm:ss.mmm>`:
// el instante LOCAL del cue corresponde al PTS (reloj de 90 kHz) del video. Al remuxear a MP4,
// ffmpeg desplaza el video para que empiece en 0, así que:
//   t_mp4 = t_cue - LOCAL + MPEGTS/90000 - videoStart

export function parseTimestamp(s) {
  const m = s.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

export function formatTimestamp(t) {
  const v = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(v / 3600000);
  const m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const ms = v % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}.${p(ms, 3)}`;
}

/** Devuelve los cues de un segmento con tiempos ya desplazados a la línea de tiempo del MP4. */
export function parseSegment(text, videoStart = 0) {
  const lines = text.replace(/\r/g, '').split('\n');
  let offset = 0;
  const map = lines.find((l) => l.startsWith('X-TIMESTAMP-MAP'));
  if (map) {
    const mpegts = Number(map.match(/MPEGTS:(\d+)/)?.[1] ?? 0);
    const local = parseTimestamp(map.match(/LOCAL:([\d:.]+)/)?.[1] ?? '00:00.000') ?? 0;
    offset = mpegts / 90000 - local - videoStart;
  }
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([\d:.]+)\s+-->\s+([\d:.]+)(.*)$/);
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    if (start == null || end == null) continue;
    const body = [];
    for (i = i + 1; i < lines.length && lines[i].trim() !== ''; i++) body.push(lines[i]);
    cues.push({ start: start + offset, end: end + offset, settings: m[3].trim(), text: body.join('\n') });
  }
  return cues;
}

/**
 * Une segmentos, elimina cues duplicados entre segmentos y ordena.
 * Con `maxEnd` (duración del video) recorta: descarta cues que empiezan después y acorta el último.
 */
export function mergeSegments(texts, videoStart = 0, maxEnd = Infinity) {
  const seen = new Set();
  const cues = [];
  for (const t of texts) {
    for (const c of parseSegment(t, videoStart)) {
      const key = `${c.start.toFixed(3)}|${c.end.toFixed(3)}|${c.text}`;
      if (seen.has(key) || !c.text.trim()) continue;
      seen.add(key);
      cues.push(c);
    }
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  const rawLastEnd = cues.reduce((m, c) => Math.max(m, c.end), 0);
  let clipped = 0;
  for (let i = cues.length - 1; i >= 0; i--) {
    if (cues[i].end <= maxEnd) continue;
    if (cues[i].start >= maxEnd - 0.05) {
      cues.splice(i, 1);
      clipped++;
    } else cues[i].end = maxEnd;
  }
  const out = ['WEBVTT', ''];
  for (const c of cues) {
    out.push(`${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}${c.settings ? ` ${c.settings}` : ''}`, c.text, '');
  }
  return { vtt: out.join('\n'), cueCount: cues.length, lastEnd: cues.length ? cues[cues.length - 1].end : 0, firstStart: cues.length ? cues[0].start : 0, rawLastEnd, clipped };
}

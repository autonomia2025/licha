// Parseo de playlists HLS (solo texto: master y media playlists). Nunca segmentos de video.

function parseAttrs(line) {
  const attrs = {};
  const body = line.slice(line.indexOf(':') + 1);
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let m;
  while ((m = re.exec(body))) attrs[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
  return attrs;
}

export function isMasterPlaylist(text) {
  return /#EXT-X-STREAM-INF/.test(text);
}

/** Devuelve variantes, audio y subtítulos declarados en un master playlist. */
export function parseMaster(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const variants = [];
  const media = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('#EXT-X-STREAM-INF')) {
      const a = parseAttrs(l);
      const uri = lines.slice(i + 1).find((x) => x && !x.startsWith('#'));
      const height = a.RESOLUTION ? Number(a.RESOLUTION.split('x')[1]) : null;
      variants.push({
        resolution: a.RESOLUTION ?? null,
        label: height ? `${height}p` : null,
        bandwidth: a.BANDWIDTH ? Number(a.BANDWIDTH) : null,
        codecs: a.CODECS ?? null,
        frame_rate: a['FRAME-RATE'] ? Number(a['FRAME-RATE']) : null,
        audio_group: a.AUDIO ?? null,
        subtitles_group: a.SUBTITLES ?? null,
        uri: uri ? resolve(uri, baseUrl) : null,
      });
    } else if (l.startsWith('#EXT-X-MEDIA')) {
      const a = parseAttrs(l);
      media.push({
        type: a.TYPE,
        group_id: a['GROUP-ID'] ?? null,
        name: a.NAME ?? null,
        language: a.LANGUAGE ?? null,
        default: a.DEFAULT === 'YES',
        autoselect: a.AUTOSELECT === 'YES',
        forced: a.FORCED === 'YES',
        characteristics: a.CHARACTERISTICS ?? null,
        uri: a.URI ? resolve(a.URI, baseUrl) : null,
      });
    }
  }
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    variants,
    qualities: uniq(variants.map((v) => v.label)).sort((a, b) => parseInt(b) - parseInt(a)),
    audio: media.filter((m) => m.type === 'AUDIO'),
    subtitles: media.filter((m) => m.type === 'SUBTITLES'),
    closed_captions: media.filter((m) => m.type === 'CLOSED-CAPTIONS'),
    independent_segments: lines.includes('#EXT-X-INDEPENDENT-SEGMENTS'),
  };
}

/** Resumen de un media playlist (p.ej. subtitles.m3u8) sin descargar segmentos. */
export function parseMediaPlaylist(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const segments = [];
  let duration = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      duration += parseFloat(lines[i].slice(8)) || 0;
      const uri = lines.slice(i + 1).find((x) => x && !x.startsWith('#'));
      if (uri) segments.push(resolve(uri, baseUrl));
    }
  }
  const ext = (u) => {
    try {
      const m = new URL(u).pathname.match(/\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : '(sin-extensión)';
    } catch {
      return '?';
    }
  };
  return {
    segment_count: segments.length,
    segment_extensions: [...new Set(segments.map(ext))],
    total_duration_s: Math.round(duration),
    endlist: lines.includes('#EXT-X-ENDLIST'),
    playlist_type: (lines.find((l) => l.startsWith('#EXT-X-PLAYLIST-TYPE')) || '').split(':')[1] ?? null,
    has_init_map: lines.some((l) => l.startsWith('#EXT-X-MAP')),
    encrypted: lines.some((l) => l.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(l)),
    first_segment: segments[0] ?? null,
  };
}

/** Inspecciona la cabecera de un segmento WebVTT (solo metadatos, no el texto de los cues). */
export function inspectVtt(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return {
    is_webvtt: firstLine.startsWith('WEBVTT'),
    has_timestamp_map: /X-TIMESTAMP-MAP/.test(text),
    cue_count: (text.match(/-->/g) || []).length,
  };
}

function resolve(uri, base) {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

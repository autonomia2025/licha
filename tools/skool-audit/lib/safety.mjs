// Bloqueo de red compartido por las sondas: ningún segmento de video/audio sale del navegador.

export const MEDIA_EXT = /\.(ts|m4s|mp4|m4v|m4a|aac|mp3|webm|mov|mkv|cmfv|cmfa|mpd)(\?|$)/i;
export const TEXT_OK = /\.(m3u8|vtt|webvtt|json|jpe?g|png|webp|gif|svg|css|js|woff2?)(\?|$)/i;
const SEGMENT_HINT = /\/(chunk|segment|frag|seg-|range)/i;
const VIDEO_CDN = /mux\.com|googlevideo\.com|vimeocdn\.com|akamaized\.net|cloudfront\.net|b-cdn\.net|wistia\.(com|net)|loom\.com|fastly/i;
const EXTERNAL_PLAYER = /(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|loom\.com|wistia\.(com|net)|vidyard\.com)/i;

const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return '';
  }
};

/** Devuelve el motivo de bloqueo de una petición de Playwright, o null si puede salir. */
export function makeShouldBlock(startHost) {
  return (req) => {
    const url = req.url();
    const rt = req.resourceType();
    const pathname = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return '';
      }
    })();
    if (rt === 'media') return 'media';
    if (MEDIA_EXT.test(pathname)) return 'extension-de-video/audio';
    if (VIDEO_CDN.test(hostOf(url)) && !TEXT_OK.test(pathname) && (rt === 'xhr' || rt === 'fetch' || rt === 'other')) return 'cdn-de-video-sin-extension-de-texto';
    if ((rt === 'xhr' || rt === 'fetch') && SEGMENT_HINT.test(pathname) && !TEXT_OK.test(pathname)) return 'posible-segmento';
    // Reproductores externos (YouTube/Vimeo/Loom/Wistia…): basta con la URL del iframe, no se carga.
    if (EXTERNAL_PLAYER.test(hostOf(url)) && hostOf(url) !== startHost) return 'reproductor-externo';
    return null;
  };
}

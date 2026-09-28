// Servidor local que imita (de forma simplificada e HIPOTÉTICA) la forma de un classroom
// para probar la sonda de punta a punta sin tocar Skool. NO representa la API real de Skool.
import http from 'node:http';
import { readFileSync } from 'node:fs';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const courseND = JSON.parse(fx('course-next-data.json'));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const hits = { segments: 0, iframes: 0 };

const page = (nd, body) =>
  `<!doctype html><html><head><title>mock</title></head><body>${body}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script></body></html>`;

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, ct, body) => (res.writeHead(code, { 'content-type': ct }), res.end(body));
    const origin = `http://${req.headers.host}`;
    if (u.pathname === '/grp/classroom') {
      const nd = { buildId: 'test-build', props: { pageProps: { allCourses: [courseND.props.pageProps.course.course] } } };
      return send(200, 'text/html; charset=utf-8', page(nd, '<a href="/grp/classroom/abc12345">Curso Demo</a>'));
    }
    if (u.pathname === '/grp/classroom/abc12345') {
      const md = u.searchParams.get('md');
      const links = ['l1', 'l2', 'l3', 'l4'].map((id) => `<a href="/grp/classroom/abc12345?md=${id}">${id}</a>`).join('');
      let player = '';
      if (md === 'l1' || md === 'l2' || md === 'l3')
        player = `<div id="thumb" style="width:640px;height:360px;background:#000"></div><video id="v"></video><script>
          const go = async () => {
            const j = await (await fetch('/api/lessons/${md}/video', {headers:{'x-mock':'1'}})).json();
            const m = await (await fetch(j.playback.url)).text();
            const variant = new URL(m.split('\\n').find(l => l.startsWith('720/')), j.playback.url);
            const v = await (await fetch(variant)).text();
            fetch(new URL('0.ts', variant)).catch(() => {});
          };
          // l3 imita un reproductor que solo carga el video al hacer clic en la miniatura
          if ('${md}' === 'l3') document.getElementById('thumb').onclick = go; else go();</script>`;
      if (md === 'l4') player = '<iframe src="https://www.youtube.com/embed/xyz"></iframe>';
      const title = md ? `<h1>${{ l1: 'Bienvenida', l2: 'Instalación', l3: 'Primer proyecto', l4: 'Extra' }[md]}</h1>` : '';
      const now = Math.floor(Date.now() / 1000);
      const tok = `${b64({ alg: 'RS256' })}.${b64({ sub: 'PB' + md, aud: 'v', exp: now + 86400, kid: 'k', playback_restriction_id: 'r' })}.c2ln`;
      const nd = JSON.parse(JSON.stringify(courseND));
      if (md === 'l1' || md === 'l2') nd.props.pageProps.video = { playbackId: 'PB' + md, playbackToken: tok };
      if (md === 'l2') nd.props.pageProps.selectedModule = { id: 'l2', metadata: { desc: '[v2][{"type":"paragraph","children":[{"text":"Prompts: texto de la lección"}]}]' } };
      return send(200, 'text/html; charset=utf-8', page(nd, links + title + player + '<a href="https://files.example.com/guia.pdf">Guía PDF</a>'));
    }
    if (u.pathname.startsWith('/api/lessons/')) {
      const now = Math.floor(Date.now() / 1000);
      const jwt = `${b64({ alg: 'RS256' })}.${b64({ sub: 'PLAYBACKID0001', aud: 'v', exp: now + 21600, iat: now })}.c2lnbmF0dXJl`;
      return send(200, 'application/json', JSON.stringify({ playback: { url: `${origin}/video/PLAYBACKID0001/master.m3u8?token=${jwt}` } }));
    }
    if (u.pathname.startsWith('/stream/')) {
      // Imita la restricción por dominio: sin Referer del sitio → 403.
      if (!(req.headers.referer || '').startsWith(origin)) return send(403, 'text/plain', 'forbidden');
      if (u.pathname.endsWith('subtitles.m3u8')) return send(200, 'application/vnd.apple.mpegurl', fx('subtitles.m3u8'));
      return send(200, 'application/vnd.apple.mpegurl', fx('master.m3u8'));
    }
    if (u.pathname.startsWith('/video/')) {
      if (!u.searchParams.get('token') && !u.pathname.endsWith('.vtt') && !u.pathname.includes('/subs/')) return send(403, 'text/plain', 'forbidden');
      if (u.pathname.endsWith('master.m3u8')) return send(200, 'application/vnd.apple.mpegurl', fx('master.m3u8'));
      if (u.pathname.endsWith('subtitles.m3u8')) return send(200, 'application/vnd.apple.mpegurl', fx('subtitles.m3u8'));
      if (u.pathname.endsWith('rendition.m3u8')) return send(200, 'application/vnd.apple.mpegurl', '#EXTM3U\n#EXTINF:4,\n0.ts\n#EXT-X-ENDLIST\n');
      if (u.pathname.endsWith('.vtt')) return send(200, 'text/vtt', 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n00:00.000 --> 00:02.000\nhola\n');
      if (u.pathname.endsWith('.ts')) {
        hits.segments++;
        return send(200, 'video/mp2t', Buffer.alloc(1024));
      }
    }
    send(404, 'text/plain', 'nf');
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start(Number(process.argv[2] ?? 4599));
  console.log(`mock en http://127.0.0.1:${s.address().port}`);
  process.on('SIGTERM', () => {
    console.log(`segment hits: ${hits.segments}`);
    process.exit(0);
  });
}

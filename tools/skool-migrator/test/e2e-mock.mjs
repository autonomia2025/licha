// Prueba de punta a punta del piloto SIN Skool ni Supabase:
// genera un HLS parecido al de Mux (video y audio separados, PTS desde 10 s, subtítulos WebVTT
// segmentados con X-TIMESTAMP-MAP), lo sirve con restricción de Referer y ejecuta pilot.mjs --no-upload.
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
const ffprobe = { path: process.env.FFPROBE_PATH || ffprobeStatic.path };

const root = path.join(os.tmpdir(), `pilot-e2e-${process.pid}`);
const hls = path.join(root, 'hls');
for (const d of ['v', 'a', 's']) mkdirSync(path.join(hls, d), { recursive: true });
const ff = (a) => {
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', ...a]);
  if (r.status) throw new Error(r.stderr.toString());
};
// 20 s de video 1280x720 y audio, segmentos de 4 s, timestamps desde 10 s.
ff(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-t', '20', '-c:v', 'libx264', '-g', '50', '-an', '-output_ts_offset', '10', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(hls, 'v', '%d.ts'), path.join(hls, 'v', 'index.m3u8')]);
ff(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '20', '-c:a', 'aac', '-vn', '-output_ts_offset', '10', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(hls, 'a', '%d.ts'), path.join(hls, 'a', 'index.m3u8')]);
const cue = (a, b, t) => `00:00:${String(a).padStart(2, '0')}.000 --> 00:00:${String(b).padStart(2, '0')}.000\n${t}\n`;
writeFileSync(path.join(hls, 's', '0.vtt'), `WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n${cue(1, 3, 'Hola')}\n${cue(9, 11, 'Cruza')}`);
writeFileSync(path.join(hls, 's', '1.vtt'), `WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n${cue(9, 11, 'Cruza')}\n${cue(17, 19, 'Chao')}`);
writeFileSync(path.join(hls, 's', 'index.m3u8'), '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:10,\n0.vtt\n#EXTINF:10,\n1.vtt\n#EXT-X-ENDLIST\n');
const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Default",DEFAULT=YES,AUTOSELECT=YES,URI="a/index.m3u8?token=x"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English CC",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=YES,URI="s/index.m3u8?token=x"
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=640x360,AUDIO="aud",SUBTITLES="subs"
v/index.m3u8?token=x&low=1
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,AUDIO="aud",SUBTITLES="subs"
v/index.m3u8?token=x
`;

let port;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (c, ct, b) => (res.writeHead(c, { 'content-type': ct }), res.end(b));
  if (u.pathname === '/grp/classroom/abc12345') {
    const nd = { props: { pageProps: { video: { playbackId: 'PB1', playbackToken: 'tok' } } } };
    return send(200, 'text/html; charset=utf-8', `<!doctype html><h1>L</h1><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script>`);
  }
  if (u.pathname.startsWith('/stream/')) {
    if (!(req.headers.referer || '').startsWith(`http://127.0.0.1:${port}/grp/`)) return send(403, 'text/plain', 'referer');
    if (u.pathname === '/stream/PB1.m3u8') return send(200, 'application/vnd.apple.mpegurl', master);
    const f = path.join(hls, u.pathname.replace('/stream/', ''));
    if (existsSync(f)) return send(200, f.endsWith('.ts') ? 'video/mp2t' : f.endsWith('.vtt') ? 'text/vtt' : 'application/vnd.apple.mpegurl', readFileSync(f));
  }
  send(404, 'text/plain', 'nf');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
port = server.address().port;

const inv = {
  courses: { abc12345: { id: 'c1', slug: 'abc12345', title: 'Curso', position: 1, modules: [{ id: 'm1', position: 1, title: 'M1', lesson_ids: ['l1'] }] } },
  lessons: { l1: { id: 'l1', course: 'abc12345', module_position: 1, position: 1, title: 'Lección de prueba', lesson_url: `http://127.0.0.1:${port}/grp/classroom/abc12345?md=l1`, video_len_ms: 20000, native: { token_present: true, master_status: 200, subtitles: [{ language: 'en' }], qualities: ['720p'] } } },
};
writeFileSync(path.join(root, 'inv.json'), JSON.stringify(inv));

const argv = ['pilot.mjs', '--url', `http://127.0.0.1:${port}/grp/classroom`, '--lessons', 'l1', '--no-upload', '--headless', '--inventory', path.join(root, 'inv.json'), '--stream-base', `http://127.0.0.1:${port}/stream`, '--profile', path.join(root, 'profile'), '--out', path.join(root, 'out')];
if (process.env.CHROMIUM_PATH) argv.push('--chromium', process.env.CHROMIUM_PATH);
const code = await new Promise((r) => {
  const p = spawn(process.execPath, argv, { stdio: 'inherit', env: { ...process.env, NO_PROXY: '127.0.0.1,localhost' } });
  p.on('close', r);
});
server.close();
if (code) throw new Error(`pilot.mjs salió con ${code}`);

const mp4 = path.join(root, 'out', 'l1', 'video.mp4');
const j = JSON.parse(spawnSync(ffprobe.path, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', mp4]).stdout.toString());
const v = j.streams.find((s) => s.codec_type === 'video');
const a = j.streams.find((s) => s.codec_type === 'audio');
const vtt = readFileSync(path.join(root, 'out', 'l1', 'en.vtt'), 'utf8');
const checks = {
  'mp4 1280x720 (mejor variante)': v?.width === 1280 && v?.height === 720,
  'mp4 con audio aac': a?.codec_name === 'aac',
  'duración ≈ 20 s': Math.abs(Number(j.format.duration) - 20) < 0.5,
  'vtt con 3 cues (sin duplicado)': (vtt.match(/-->/g) || []).length === 3,
  'vtt alineado (primer cue a 1 s)': vtt.includes('00:00:01.000 --> 00:00:03.000'),
  'player generado': existsSync(path.join(root, 'out', 'pilot-player.html')),
  'temporal borrado': !existsSync(path.join('tmp', 'l1')),
};
console.log(checks);
rmSync(root, { recursive: true, force: true });
if (Object.values(checks).some((x) => !x)) process.exit(1);
console.log('E2E OK');

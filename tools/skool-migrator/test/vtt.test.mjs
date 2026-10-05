import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSegments, parseTimestamp, formatTimestamp } from '../lib/vtt.mjs';
import { parseMaster, pickBest, pickAudio, planMediaPlaylist } from '../lib/hls.mjs';

test('timestamps', () => {
  assert.equal(parseTimestamp('01:02:03.500'), 3723.5);
  assert.equal(parseTimestamp('02:03.500'), 123.5);
  assert.equal(formatTimestamp(3723.5), '01:02:03.500');
});

test('une segmentos, aplica X-TIMESTAMP-MAP y quita duplicados', () => {
  const seg1 = 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n00:00:01.000 --> 00:00:03.000\nHola\n\n00:00:05.000 --> 00:00:07.000\nCruza\n';
  const seg2 = 'WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n00:00:05.000 --> 00:00:07.000\nCruza\n\n00:00:08.000 --> 00:00:09.000\nChao\n';
  // Video HLS que empieza en PTS 10 s (como MPEGTS 900000): los cues quedan igual.
  const a = mergeSegments([seg1, seg2], 10);
  assert.equal(a.cueCount, 3);
  assert.match(a.vtt, /^WEBVTT\n\n00:00:01\.000 --> 00:00:03\.000\nHola/);
  // Video que empieza en 0: los cues se desplazan +10 s.
  const b = mergeSegments([seg1], 0);
  assert.match(b.vtt, /00:00:11\.000 --> 00:00:13\.000/);
});

test('elige la mejor variante y su audio', () => {
  const m = parseMaster(
    '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="x",DEFAULT=YES,URI="a.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=640x360,AUDIO="a"\nlo.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=9,RESOLUTION=1920x1078,AUDIO="a"\nhi.m3u8\n',
    'https://h/p/master.m3u8',
  );
  const best = pickBest(m.variants);
  assert.equal(best.height, 1078);
  assert.equal(pickAudio(m.media, best.audio).uri, 'https://h/p/a.m3u8');
});

test('playlist fMP4 con EXT-X-MAP se reescribe a nombres locales', () => {
  const p = planMediaPlaylist('#EXTM3U\n#EXT-X-MAP:URI="init.mp4?t=1"\n#EXTINF:4,\nseg0.m4s?t=1\n#EXTINF:4,\nseg1.m4s?t=1\n#EXT-X-ENDLIST\n', 'https://h/v/index.m3u8');
  assert.deepEqual(p.files.map((f) => f.name), ['init.mp4', '00000.m4s', '00001.m4s']);
  assert.match(p.localPlaylist, /URI="init\.mp4"/);
  assert.ok(!p.localPlaylist.includes('?t='));
  assert.throws(() => planMediaPlaylist('#EXT-X-KEY:METHOD=AES-128,URI="k"\nx.ts', 'https://h/'));
});

test('mergeSegments recorta cues que pasan del final del video', async () => {
  const { mergeSegments } = await import('../lib/vtt.mjs');
  const seg = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhola\n\n00:00:09.000 --> 00:00:12.000\nfin\n\n00:00:10.500 --> 00:00:11.000\nsobra\n';
  const m = mergeSegments([seg], 0, 10);
  assert.equal(m.rawLastEnd, 12);
  assert.equal(m.lastEnd, 10);
  assert.equal(m.cueCount, 2);
  assert.equal(m.clipped, 1);
  assert.match(m.vtt, /00:00:09.000 --> 00:00:10.000/);
});

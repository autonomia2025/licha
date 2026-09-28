import test from 'node:test';
import assert from 'node:assert/strict';
import { playlistDuration } from '../lib/hls.mjs';

test('playlistDuration suma los #EXTINF', () => {
  const pl = '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\na.ts\n#EXTINF:5.5,\nb.ts\n#EXTINF:0.25,\nc.ts\n#EXT-X-ENDLIST\n';
  assert.equal(playlistDuration(pl), 11.75);
  assert.equal(playlistDuration('#EXTM3U\n'), 0);
});

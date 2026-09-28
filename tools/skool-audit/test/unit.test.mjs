import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMaster, parseMediaPlaylist, inspectVtt, isMasterPlaylist } from '../lib/hls.mjs';
import { redactUrl, signatureInfo, pathPattern } from '../lib/redact.mjs';
import { findCourseTree, flattenCourse, classifyVideoLink, extractAttachments, describeText } from '../lib/tree.mjs';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

test('master playlist: calidades, audio separado y subtítulos', () => {
  const t = fx('master.m3u8');
  assert.ok(isMasterPlaylist(t));
  const m = parseMaster(t, 'https://cdn.example.com/abc/master.m3u8?token=x');
  assert.deepEqual(m.qualities, ['1080p', '720p', '480p', '270p']);
  assert.equal(m.audio.length, 1);
  assert.equal(m.subtitles[0].name, 'English CC');
  assert.equal(m.subtitles[0].language, 'en');
  assert.equal(m.subtitles[0].uri, 'https://cdn.example.com/abc/subtitles.m3u8?token=abc');
});

test('subtitle media playlist: segmentos WebVTT', () => {
  const p = parseMediaPlaylist(fx('subtitles.m3u8'), 'https://cdn.example.com/abc/subtitles.m3u8');
  assert.equal(p.segment_count, 2);
  assert.deepEqual(p.segment_extensions, ['vtt']);
  assert.equal(p.total_duration_s, 913);
  assert.ok(p.endlist);
  const v = inspectVtt('WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000\n\n00:00.000 --> 00:02.000\nhola\n');
  assert.deepEqual(v, { is_webvtt: true, has_timestamp_map: true, cue_count: 1 });
});

test('redacción: nunca expone valores de query ni JWT', () => {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'RS256' })}.${b64({ sub: 'x', aud: 'v', exp: now + 3600, iat: now })}.c2lnbmF0dXJlc2ln`;
  const url = `https://stream.example.com/PLAYBACKID123456.m3u8?token=${jwt}&foo=bar`;
  const r = redactUrl(url);
  assert.ok(!r.includes(jwt) && !r.includes('bar'));
  assert.match(r, /token=<redacted>&foo=<redacted>/);
  const s = signatureInfo(url);
  assert.equal(s['jwt:token'].aud, 'v');
  assert.equal(s['jwt:token'].ttl_s, 3600);
  assert.ok(!JSON.stringify(s).includes(jwt));
  assert.equal(pathPattern('https://api.example.com/courses/0123456789abcdef0123456789abcdef'), 'api.example.com/courses/:hex32');
});

test('árbol: curso → sets → lecciones, orden por arreglo, adjuntos y descripción', () => {
  const nd = JSON.parse(fx('course-next-data.json'));
  const found = findCourseTree(nd);
  assert.equal(found.node.unitType, 'course');
  const flat = flattenCourse(found.node);
  assert.equal(flat.modules.length, 2);
  assert.deepEqual(flat.modules[0].lessons.map((l) => l.title), ['Bienvenida', 'Instalación', 'Primer proyecto']);
  const l1 = flat.modules[0].lessons[0];
  assert.equal(l1.attachments.length, 1);
  assert.equal(l1.attachments[0].file_name, 'guia.pdf');
  assert.equal(l1.description.found, true);
  assert.equal(flat.modules[1].lessons[0].video.video_link_provider, 'youtube');
});

test('proveedores de video', () => {
  assert.equal(classifyVideoLink('https://www.loom.com/share/x'), 'loom');
  assert.equal(classifyVideoLink('https://vimeo.com/1'), 'vimeo');
  assert.equal(classifyVideoLink(null), null);
  assert.equal(extractAttachments({ resources: 'no-json' }).length, 0);
  assert.equal(describeText({}).found, false);
});

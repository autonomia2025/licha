import test from 'node:test';
import assert from 'node:assert/strict';
import { presign, signHeaders } from '../lib/r2.mjs';

// Vectores oficiales de la documentación de AWS SigV4 para S3.
const cred = { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
const date = new Date('2013-05-24T00:00:00Z');

test('URL prefirmada coincide con el ejemplo de AWS', () => {
  const url = presign({ method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1', expires: 86400, date, ...cred });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test('firma en cabeceras coincide con el ejemplo GET Object de AWS', () => {
  const h = signHeaders({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    headers: { range: 'bytes=0-9' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    region: 'us-east-1',
    date,
    ...cred,
  });
  assert.match(h.authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
  assert.match(h.authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,/);
});

test('firma con query (ejemplo GET Bucket lifecycle de AWS)', () => {
  const h = signHeaders({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/',
    query: { lifecycle: '' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    region: 'us-east-1',
    date,
    ...cred,
  });
  assert.match(h.authorization, /Signature=fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543$/);
});

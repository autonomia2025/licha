// Cliente mínimo para Cloudflare R2 (API compatible con S3) sin dependencias: firma AWS SigV4
// con node:crypto y peticiones con fetch. Sube archivos grandes en partes (multipart) con reintentos.
import { createHash, createHmac } from 'node:crypto';
import { open, stat } from 'node:fs/promises';

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (p) => p.split('/').map(enc).join('/');
const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
export const UNSIGNED = 'UNSIGNED-PAYLOAD';
const amzDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function signingKey(secret, day, region, service) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), 'aws4_request');
}
function canonicalQuery(q) {
  return Object.keys(q)
    .sort()
    .map((k) => `${enc(k)}=${enc(String(q[k]))}`)
    .join('&');
}

/**
 * Firma SigV4 en cabeceras. Devuelve las cabeceras a enviar (incluida Authorization).
 * `path` ya codificado (p. ej. /bucket/clave). Probado contra los ejemplos oficiales de AWS.
 */
export function signHeaders({ method, host, path, query = {}, headers = {}, payloadHash = UNSIGNED, region, service = 's3', accessKeyId, secret, date = new Date() }) {
  const t = amzDate(date);
  const day = t.slice(0, 8);
  const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': t };
  const names = Object.keys(all).sort();
  const canonical = [method, path, canonicalQuery(query), names.map((n) => `${n}:${all[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', t, scope, sha256hex(canonical)].join('\n');
  const sig = createHmac('sha256', signingKey(secret, day, region, service)).update(toSign).digest('hex');
  const out = { ...all, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}` };
  delete out.host; // fetch la pone sola
  return out;
}

/** URL prefirmada (firma en la query). Probado contra el ejemplo oficial de AWS. */
export function presign({ method = 'GET', host, path, region, service = 's3', accessKeyId, secret, expires = 3600, date = new Date(), protocol = 'https' }) {
  const t = amzDate(date);
  const day = t.slice(0, 8);
  const scope = `${day}/${region}/${service}/aws4_request`;
  const q = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${accessKeyId}/${scope}`, 'X-Amz-Date': t, 'X-Amz-Expires': expires, 'X-Amz-SignedHeaders': 'host' };
  const canonical = [method, path, canonicalQuery(q), `host:${host}\n`, 'host', UNSIGNED].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', t, scope, sha256hex(canonical)].join('\n');
  const sig = createHmac('sha256', signingKey(secret, day, region, service)).update(toSign).digest('hex');
  return `${protocol}://${host}${path}?${canonicalQuery(q)}&X-Amz-Signature=${sig}`;
}

/** Configuración desde variables de entorno (null si R2 no está configurado). */
export function r2FromEnv(env = process.env) {
  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secret = (env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (env.R2_BUCKET || '').trim();
  if (!accountId && !accessKeyId && !secret && !bucket) return null;
  const missing = [['R2_ACCOUNT_ID', accountId], ['R2_ACCESS_KEY_ID', accessKeyId], ['R2_SECRET_ACCESS_KEY', secret], ['R2_BUCKET', bucket]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Configuración de R2 incompleta en .env: falta ${missing.join(', ')}`);
  return new R2({ accountId, accessKeyId, secret, bucket });
}

export class R2 {
  constructor({ accountId, accessKeyId, secret, bucket, host }) {
    this.host = host ?? `${accountId}.r2.cloudflarestorage.com`;
    this.cred = { accessKeyId, secret };
    this.bucket = bucket;
  }

  async request(method, key, { query = {}, headers = {}, body, tries = 5 } = {}) {
    const path = `/${enc(this.bucket)}${key ? `/${encPath(key)}` : ''}`;
    const qs = canonicalQuery(query);
    for (let attempt = 0; ; attempt++) {
      const h = signHeaders({ method, host: this.host, path, query, headers, region: 'auto', ...this.cred });
      try {
        const res = await fetch(`https://${this.host}${path}${qs ? `?${qs}` : ''}`, { method, headers: h, body });
        if (res.ok || res.status === 404 || (res.status < 500 && res.status !== 429)) return res;
        if (attempt >= tries - 1) return res;
      } catch (e) {
        if (attempt >= tries - 1) throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  /** URL prefirmada de lectura (por defecto 1 hora). */
  url(key, expires = 3600) {
    return presign({ host: this.host, path: `/${enc(this.bucket)}/${encPath(key)}`, region: 'auto', expires, ...this.cred });
  }

  async check() {
    const res = await this.request('GET', '', { query: { 'list-type': '2', 'max-keys': '1' } });
    if (!res.ok) throw new Error(`R2 rechazó el acceso al bucket "${this.bucket}" (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  /** Tamaño del objeto en bytes, o null si no existe. */
  async size(key) {
    const res = await this.request('HEAD', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HEAD ${key}: HTTP ${res.status}`);
    return Number(res.headers.get('content-length'));
  }

  async putBuffer(key, buf, contentType, cacheControl) {
    const res = await this.request('PUT', key, { body: buf, headers: { 'content-type': contentType, ...(cacheControl ? { 'cache-control': cacheControl } : {}) } });
    if (!res.ok) throw new Error(`Subida a R2 de ${key} falló (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  /** Sube un archivo del disco. Hasta 64 MB de una vez; más grande, en partes de 32 MB con reintentos. */
  async putFile(file, key, contentType, { onProgress, cacheControl } = {}) {
    const size = (await stat(file)).size;
    const fh = await open(file, 'r');
    try {
      if (size <= 64 * 1048576) {
        const buf = Buffer.alloc(size);
        await fh.read(buf, 0, size, 0);
        await this.putBuffer(key, buf, contentType, cacheControl);
        onProgress?.(size, size);
        return size;
      }
      const PART = 32 * 1048576;
      const created = await this.request('POST', key, { query: { uploads: '' }, headers: { 'content-type': contentType, ...(cacheControl ? { 'cache-control': cacheControl } : {}) } });
      const createdText = await created.text();
      const uploadId = createdText.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!created.ok || !uploadId) throw new Error(`No pude iniciar la subida por partes de ${key} (HTTP ${created.status}): ${createdText.slice(0, 200)}`);
      const parts = [];
      try {
        for (let n = 1, off = 0; off < size; n++, off += PART) {
          const len = Math.min(PART, size - off);
          const buf = Buffer.alloc(len);
          await fh.read(buf, 0, len, off);
          const res = await this.request('PUT', key, { query: { partNumber: String(n), uploadId }, body: buf });
          if (!res.ok) throw new Error(`Parte ${n} de ${key} falló (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
          parts.push(`<Part><PartNumber>${n}</PartNumber><ETag>${res.headers.get('etag')}</ETag></Part>`);
          onProgress?.(off + len, size);
        }
        const done = await this.request('POST', key, {
          query: { uploadId },
          headers: { 'content-type': 'application/xml' },
          body: `<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`,
        });
        const doneText = await done.text();
        if (!done.ok || /<Error>/.test(doneText)) throw new Error(`No pude completar la subida de ${key} (HTTP ${done.status}): ${doneText.slice(0, 200)}`);
      } catch (e) {
        await this.request('DELETE', key, { query: { uploadId }, tries: 2 }).catch(() => {});
        throw e;
      }
      return size;
    } finally {
      await fh.close();
    }
  }

  /** Configura CORS del bucket (necesario para subtítulos y para el reproductor con crossOrigin). */
  async setCors(origins) {
    const rules = `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}<AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>Content-Range</ExposeHeader><ExposeHeader>Accept-Ranges</ExposeHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
    const md5 = createHash('md5').update(rules).digest('base64');
    const res = await this.request('PUT', '', { query: { cors: '' }, body: rules, headers: { 'content-type': 'application/xml', 'content-md5': md5 } });
    if (!res.ok) throw new Error(`No pude configurar CORS (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

/**
 * Credenciales S3 de R2 a partir de un token de API de Cloudflare con permiso de R2:
 * Access Key ID = id del token; Secret = SHA-256 (hex) del valor del token.
 */
export function s3CredentialsFromApiToken(tokenId, tokenValue) {
  return { accessKeyId: tokenId, secret: sha256hex(tokenValue) };
}

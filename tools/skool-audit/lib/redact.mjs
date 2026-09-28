// Redacción: nada de cookies, tokens ni signed URLs completas sale de aquí.

const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;

/** URL sin valores de query: conserva host, path y NOMBRES de parámetros. */
export function redactUrl(raw, base) {
  let u;
  try {
    u = new URL(raw, base);
  } catch {
    return '<url-invalida>';
  }
  const names = [...new Set([...u.searchParams.keys()])];
  const q = names.length ? '?' + names.map((n) => `${n}=<redacted>`).join('&') : '';
  return `${u.protocol}//${u.host}${u.pathname.replace(JWT_RE, '<jwt>')}${q}`;
}

/** Reemplaza cualquier JWT embebido en un string. */
export function redactString(s) {
  return typeof s === 'string' ? s.replace(JWT_RE, '<jwt>') : s;
}

/** Normaliza un path para agrupar endpoints: ids -> :id */
export function pathPattern(raw) {
  try {
    const u = new URL(raw);
    const p = u.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        if (/^[0-9a-f]{32}$/i.test(seg)) return ':hex32';
        if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg)) return ':uuid';
        if (/^\d+$/.test(seg)) return ':n';
        if (/^[A-Za-z0-9_-]{20,}$/.test(seg)) return ':token';
        return seg;
      })
      .join('/');
    return `${u.host}${p}`;
  } catch {
    return '<url-invalida>';
  }
}

/**
 * Decodifica (sin verificar) el payload de un JWT y devuelve SOLO metadatos
 * no sensibles: nombres de claims y tiempo de vida. Nunca el token.
 */
export function jwtLifetime(token) {
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const out = { claims: Object.keys(json).sort() };
    if (typeof json.exp === 'number') {
      out.expires_in_s = Math.round(json.exp - Date.now() / 1000);
      if (typeof json.iat === 'number') out.ttl_s = json.exp - json.iat;
    }
    // "aud" corto (p.ej. Mux usa v/t/s/g) ayuda a identificar el proveedor y no es secreto.
    if (typeof json.aud === 'string' && json.aud.length <= 3) out.aud = json.aud;
    return out;
  } catch {
    return null;
  }
}

/** Analiza los parámetros de firma de una URL (solo nombres y caducidad). */
export function signatureInfo(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const params = [...u.searchParams.keys()];
  if (!params.length && !JWT_RE.test(u.pathname)) return null;
  JWT_RE.lastIndex = 0;
  const info = { param_names: params };
  for (const [k, v] of u.searchParams) {
    const jwt = v.match(JWT_RE);
    JWT_RE.lastIndex = 0;
    if (jwt) info[`jwt:${k}`] = jwtLifetime(jwt[0]);
    // Estilo CloudFront/S3/GCS: Expires=epoch o X-Amz-Expires=segundos
    if (/^expires$/i.test(k) && /^\d{9,}$/.test(v)) info.expires_in_s = Number(v) - Math.round(Date.now() / 1000);
    if (/^x-amz-expires$/i.test(k)) info.ttl_s = Number(v);
  }
  return info;
}

/** Forma (claves y tipos) de un JSON, sin valores. Útil para conocer APIs sin copiar datos. */
export function shapeOf(v, depth = 0, maxDepth = 6) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0], depth + 1, maxDepth), `len=${v.length}`] : [];
  if (typeof v === 'object') {
    if (depth >= maxDepth) return '{…}';
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = shapeOf(v[k], depth + 1, maxDepth);
    return o;
  }
  return typeof v;
}

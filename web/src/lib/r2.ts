import "server-only";
import { createHash, createHmac } from "node:crypto";

/*
 * URLs prefirmadas de Cloudflare R2 (API S3, firma AWS SigV4) sin dependencias.
 * Se activa cuando existen R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET.
 */

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (k: string | Buffer, s: string) => createHmac("sha256", k).update(s).digest();

interface R2Config {
  host: string;
  bucket: string;
  accessKeyId: string;
  secret: string;
}

function config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secret || !bucket) return null;
  return { host: `${accountId}.r2.cloudflarestorage.com`, bucket, accessKeyId, secret };
}

export const r2Enabled = () => config() !== null;

/** Firma una URL GET (SigV4 en la query). Exportada para pruebas con los vectores oficiales de AWS. */
export function presignUrl(o: { host: string; path: string; region: string; accessKeyId: string; secret: string; expires: number; date: Date }) {
  const t = o.date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = t.slice(0, 8);
  const scope = `${day}/${o.region}/s3/aws4_request`;
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${o.accessKeyId}/${scope}`,
    "X-Amz-Date": t,
    "X-Amz-Expires": String(o.expires),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.keys(q)
    .sort()
    .map((k) => `${enc(k)}=${enc(q[k])}`)
    .join("&");
  const canonical = ["GET", o.path, query, `host:${o.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", t, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${o.secret}`, day), o.region), "s3"), "aws4_request");
  const sig = createHmac("sha256", key).update(toSign).digest("hex");
  return `https://${o.host}${o.path}?${query}&X-Amz-Signature=${sig}`;
}

/**
 * URLs firmadas para las rutas pedidas. La fecha de firma se redondea a la hora y la validez es de
 * 2 horas: así la misma URL se repite durante la hora y el navegador puede reutilizar miniaturas en caché,
 * y cualquier URL entregada sigue sirviendo al menos 1 hora.
 */
export function r2SignPaths(paths: string[]): Record<string, string> {
  const c = config();
  if (!c) return {};
  const hour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  return Object.fromEntries(
    paths.map((p) => [
      p,
      presignUrl({ host: c.host, path: `/${enc(c.bucket)}/${p.split("/").map(enc).join("/")}`, region: "auto", accessKeyId: c.accessKeyId, secret: c.secret, expires: 7200, date: hour }),
    ]),
  );
}

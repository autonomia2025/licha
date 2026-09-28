// Extracción de la jerarquía curso → módulo → lección a partir del JSON que
// la página ya entrega al navegador (p.ej. __NEXT_DATA__). No asume un esquema
// fijo: detecta "unidades" por forma y reporta qué claves existen realmente.

import { redactUrl } from './redact.mjs';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Normaliza un nodo. Soporta { course: unit, children } y { ...unit, children }. */
export function normalizeNode(node) {
  if (!isObj(node)) return null;
  let unit = node;
  if (isObj(node.course) && (Array.isArray(node.children) || node.course.unitType || node.course.metadata)) {
    unit = node.course;
  }
  if (typeof unit.id !== 'string' && typeof unit.id !== 'number') return null;
  const metadata = isObj(unit.metadata) ? unit.metadata : {};
  const children = Array.isArray(node.children) ? node.children : Array.isArray(unit.children) ? unit.children : [];
  return {
    id: String(unit.id),
    name: unit.name ?? null,
    unitType: unit.unitType ?? unit.unit_type ?? unit.type ?? null,
    title: metadata.title ?? unit.title ?? unit.name ?? null,
    metadata,
    raw: unit,
    children: children.map(normalizeNode).filter(Boolean),
  };
}

function countDesc(n) {
  return n.children.reduce((s, c) => s + 1 + countDesc(c), 0);
}

/** Busca en el JSON el árbol de curso más plausible. */
export function findCourseTree(root) {
  const candidates = [];
  const seen = new Set();
  (function walk(v, path) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (isObj(v) && Array.isArray(v.children)) {
      const n = normalizeNode(v);
      if (n && n.children.length) candidates.push({ node: n, path, size: countDesc(n) });
    }
    for (const [k, c] of Object.entries(v)) walk(c, `${path}.${k}`);
  })(root, '$');
  candidates.sort(
    (a, b) => (b.node.unitType === 'course') - (a.node.unitType === 'course') || b.size - a.size,
  );
  return candidates[0] ?? null;
}

/** Lista de cursos (página /classroom): objetos con unitType "course" o con metadata.title. */
export function findCourseList(root) {
  const out = new Map();
  const seen = new Set();
  (function walk(v) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    const n = isObj(v) ? normalizeNode(v) : null;
    if (n && n.unitType === 'course' && !out.has(n.id)) {
      out.set(n.id, {
        id: n.id,
        name: n.name,
        title: n.title,
        metadata_keys: Object.keys(n.metadata).sort(),
        access_flags: accessFlags(n),
      });
    }
    for (const c of Object.values(v)) walk(c);
  })(root);
  return [...out.values()];
}

export function accessFlags(n) {
  const flags = {};
  for (const src of [n.raw, n.metadata]) {
    for (const [k, v] of Object.entries(src || {})) {
      if (/access|lock|tier|privacy|drip|unlock|hidden|publish|visib|level|amount|price/i.test(k) && typeof v !== 'object') {
        flags[k] = v;
      }
    }
  }
  return flags;
}

/** Claves de metadata observadas por unitType (sin valores). */
export function keyFrequency(tree) {
  const freq = {};
  (function walk(n) {
    const t = n.unitType ?? '(sin unitType)';
    freq[t] ??= { count: 0, unit_keys: {}, metadata_keys: {} };
    freq[t].count++;
    for (const k of Object.keys(n.raw)) freq[t].unit_keys[k] = (freq[t].unit_keys[k] ?? 0) + 1;
    for (const k of Object.keys(n.metadata)) freq[t].metadata_keys[k] = (freq[t].metadata_keys[k] ?? 0) + 1;
    n.children.forEach(walk);
  })(tree);
  return freq;
}

const VIDEO_HOSTS = [
  [/youtube\.com|youtu\.be/, 'youtube'],
  [/vimeo\.com/, 'vimeo'],
  [/loom\.com/, 'loom'],
  [/wistia\.(com|net)|wi\.st/, 'wistia'],
  [/mux\.com/, 'mux'],
  [/skool\.com/, 'skool-native'],
  [/drive\.google\.com/, 'google-drive'],
  [/vidyard|bunny|b-cdn|cloudflarestream|jwplayer|brightcove/, 'other-known'],
];

export function classifyVideoLink(link) {
  if (!link || typeof link !== 'string') return null;
  try {
    const host = new URL(link).host;
    for (const [re, name] of VIDEO_HOSTS) if (re.test(host)) return name;
    return `external:${host}`;
  } catch {
    return 'unparseable';
  }
}

function tryJson(v) {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!(t.startsWith('[') || t.startsWith('{'))) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

/** Adjuntos declarados en metadata (resources, attachments, files…). Solo metadatos. */
export function extractAttachments(metadata) {
  const items = [];
  for (const [k, v] of Object.entries(metadata)) {
    if (!/resource|attach|file|download|material/i.test(k)) continue;
    const parsed = tryJson(v);
    const list = Array.isArray(parsed) ? parsed : isObj(parsed) ? [parsed] : [];
    for (const it of list) {
      if (!isObj(it)) continue;
      const link = it.link ?? it.url ?? it.href ?? null;
      const fileName = it.file_name ?? it.fileName ?? it.filename ?? null;
      items.push({
        source_key: k,
        title: it.title ?? it.name ?? null,
        kind: fileName || it.file_id || it.fileId ? 'file' : link ? 'link' : 'unknown',
        file_name: fileName,
        content_type: it.file_content_type ?? it.contentType ?? it.mime ?? null,
        has_file_id: Boolean(it.file_id ?? it.fileId),
        link: link ? redactUrl(link) : null,
        link_host: link ? safeHost(link) : null,
        keys: Object.keys(it).sort(),
      });
    }
  }
  return items;
}

function safeHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

/** Resumen de la descripción/contenido textual: formato, longitud, enlaces e imágenes. */
export function describeText(metadata) {
  const key = Object.keys(metadata).find((k) => /^(desc|description|content|body|text|transcript)$/i.test(k));
  if (!key) return { found: false };
  const raw = metadata[key];
  const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const parsed = tryJson(s);
  const format =
    typeof parsed !== 'string'
      ? 'json'
      : /^\[v\d+\]/.test(s)
        ? `skool-rich:${s.match(/^\[(v\d+)\]/)[1]}`
        : /<\/?[a-z][\s\S]*>/i.test(s)
          ? 'html'
          : /(^|\n)#{1,6} |\*\*|\]\(/.test(s)
            ? 'markdown'
            : 'plain';
  const urls = s.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  const images = urls.filter((u) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u) || /image/i.test(u));
  return {
    found: true,
    source_key: key,
    format,
    length: s.length,
    link_count: urls.length,
    image_count: images.length,
    link_hosts: [...new Set(urls.map(safeHost).filter(Boolean))],
    preview: s.slice(0, 160),
  };
}

/** Resumen de campos de video presentes en metadata. */
export function describeVideoFields(metadata) {
  const fields = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (/video|media|stream|playback|mux|thumbnail|duration|len/i.test(k)) {
      fields[k] = typeof v === 'string' && /^https?:/.test(v) ? redactUrl(v) : typeof v === 'object' ? '(objeto)' : v;
    }
  }
  const link = metadata.videoLink ?? metadata.video_link ?? metadata.videoUrl ?? null;
  return {
    fields,
    video_link_provider: classifyVideoLink(link),
    has_video_id: Object.keys(metadata).some((k) => /video.?id|playback.?id|media.?id/i.test(k) && metadata[k]),
  };
}

/**
 * Aplana el árbol a módulos y lecciones, preservando el orden del arreglo
 * `children` (candidato principal a fuente de verdad del orden).
 */
export function flattenCourse(tree) {
  const modules = [];
  const orderFields = new Set();
  let maxDepth = 0;
  const loose = { id: null, title: '(lecciones sin módulo)', position: null, lessons: [] };

  const lessonOf = (n, pos, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    for (const k of Object.keys({ ...n.raw, ...n.metadata })) if (/^(position|order|index|sort|rank|seq)/i.test(k)) orderFields.add(k);
    return {
      position: pos,
      id: n.id,
      name: n.name,
      unitType: n.unitType,
      title: n.title,
      access_flags: accessFlags(n),
      description: describeText(n.metadata),
      video: describeVideoFields(n.metadata),
      attachments: extractAttachments(n.metadata),
      nested_children: n.children.length,
      metadata_keys: Object.keys(n.metadata).sort(),
    };
  };

  tree.children.forEach((child, i) => {
    const isModule = child.children.length > 0 || /set|module|section|folder|chapter/i.test(child.unitType ?? '') && child.unitType !== 'module';
    if (isModule) {
      modules.push({
        position: i + 1,
        id: child.id,
        unitType: child.unitType,
        title: child.title,
        access_flags: accessFlags(child),
        lessons: child.children.map((l, j) => lessonOf(l, j + 1, 2)),
      });
    } else {
      loose.lessons.push({ ...lessonOf(child, loose.lessons.length + 1, 1), course_position: i + 1 });
    }
  });
  if (loose.lessons.length) modules.unshift(loose);
  return { modules, order_fields_seen: [...orderFields], max_depth: maxDepth };
}

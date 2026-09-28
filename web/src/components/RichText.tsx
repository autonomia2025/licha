import type { ReactNode } from "react";

// Renderiza el texto de las lecciones de Skool: "[v2]" + JSON de TipTap/ProseMirror.
// Tipos desconocidos se degradan a su contenido, nunca se inyecta HTML.

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[]; children?: Node[] };

export function parseBody(raw: string | null): Node[] | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const json = s.replace(/^\[v\d+\]/, "");
  if (json.startsWith("[") || json.startsWith("{")) {
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : v?.content ?? [v];
    } catch {
      /* texto plano */
    }
  }
  return s.split(/\n{2,}/).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }));
}

const safeHref = (h: unknown) => (typeof h === "string" && /^(https?:|mailto:)/i.test(h) ? h : null);

function withMarks(text: string, marks: Mark[] | undefined, key: number): ReactNode {
  let node: ReactNode = text;
  for (const m of marks ?? []) {
    if (m.type === "bold" || m.type === "strong") node = <strong>{node}</strong>;
    else if (m.type === "italic" || m.type === "em") node = <em>{node}</em>;
    else if (m.type === "underline") node = <u>{node}</u>;
    else if (m.type === "strike") node = <s>{node}</s>;
    else if (m.type === "code") node = <code>{node}</code>;
    else if (m.type === "highlight") node = <mark className="rounded bg-accent-soft px-1 text-ink">{node}</mark>;
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      if (href) node = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{node}</a>;
    }
  }
  return <span key={key}>{node}</span>;
}

function render(nodes: Node[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const kids = n.content ?? n.children;
    switch (n.type) {
      case "text":
        return withMarks(n.text ?? "", n.marks, i);
      case "hardBreak":
        return <br key={i} />;
      case "paragraph":
        return <p key={i}>{render(kids)}</p>;
      case "heading": {
        const level = Math.min(3, Math.max(1, Number(n.attrs?.level ?? 2)));
        const Tag = (`h${level}` as "h1" | "h2" | "h3");
        return <Tag key={i}>{render(kids)}</Tag>;
      }
      case "bulletList":
        return <ul key={i}>{render(kids)}</ul>;
      case "orderedList":
        return <ol key={i}>{render(kids)}</ol>;
      case "listItem":
        return <li key={i}>{render(kids)}</li>;
      case "blockquote":
        return <blockquote key={i}>{render(kids)}</blockquote>;
      case "codeBlock":
        return (
          <pre key={i}>
            <code>{render(kids)}</code>
          </pre>
        );
      case "horizontalRule":
        return <hr key={i} />;
      case "image": {
        const src = safeHref(n.attrs?.src);
        // eslint-disable-next-line @next/next/no-img-element
        return src ? <img key={i} src={src} alt={String(n.attrs?.alt ?? "")} loading="lazy" /> : null;
      }
      default:
        return kids ? <div key={i}>{render(kids)}</div> : n.text ? withMarks(n.text, n.marks, i) : null;
    }
  });
}

export function RichText({ raw }: { raw: string | null }) {
  const nodes = parseBody(raw);
  if (!nodes?.length) return null;
  return <div className="prose-lesson">{render(nodes)}</div>;
}

/** ¿Hay texto real (no solo párrafos vacíos)? */
export function hasBody(raw: string | null): boolean {
  const walk = (ns: Node[] | undefined): boolean => (ns ?? []).some((n) => (n.text ?? "").trim() !== "" || n.type === "image" || walk(n.content ?? n.children));
  return walk(parseBody(raw) ?? []);
}

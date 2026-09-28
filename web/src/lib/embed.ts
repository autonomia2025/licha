/** Convierte enlaces de Loom / YouTube / Vimeo en URLs para incrustar. Devuelve null si no se reconoce. */
export function embedUrl(raw: string | null): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "loom.com") {
    const id = u.pathname.match(/\/(?:share|embed)\/([a-f0-9]+)/)?.[1];
    return id ? `https://www.loom.com/embed/${id}?hide_owner=true&hide_share=true&hide_title=true` : null;
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    const t = u.searchParams.get("t");
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0${t ? `&start=${parseInt(t)}` : ""}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/);
    if (!m) return null;
    const h = m[2] ?? u.searchParams.get("h");
    return `https://player.vimeo.com/video/${m[1]}${h ? `?h=${h}` : ""}`;
  }
  return null;
}

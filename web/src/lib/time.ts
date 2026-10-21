const TZ = "America/Santiago";

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días"… o "nunca" si no hay fecha. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "justo ahora";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `hace ${mo} ${mo === 1 ? "mes" : "meses"}` : "hace más de un año";
}

/** "21 oct · 11:55" en hora de Chile. */
export function stamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: TZ }).replace(".", "");
  const time = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
  return `${day} · ${time}`;
}

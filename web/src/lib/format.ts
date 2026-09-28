/** "1 h 23 min", "12 min", "45 s" */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const totalMin = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "4:07", "1:02:33" */
export function formatClock(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Separa un emoji inicial del título ("👣 Evolve" → ["👣", "Evolve"]) para usarlo como ícono. */
export function splitEmoji(title: string): { emoji: string | null; text: string } {
  const m = title.match(/^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic}))*)\s*/u);
  if (!m) return { emoji: null, text: title.trim() };
  return { emoji: m[1], text: title.slice(m[0].length).trim() };
}

/** Degradado estable a partir de un id (portadas y miniaturas sin imagen), dentro de la paleta de la marca. */
/** Degradado monocromo determinista (luz blanca en posiciones distintas según el id). */
export function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const x1 = 5 + (h % 45);
  const y1 = 5 + ((h >>> 4) % 40);
  const x2 = 60 + ((h >>> 8) % 40);
  const y2 = 55 + ((h >>> 12) % 45);
  const a1 = 0.22 + ((h >>> 16) % 10) / 100;
  return `radial-gradient(70% 80% at ${x1}% ${y1}%, rgb(255 255 255 / ${a1}) 0%, transparent 60%), radial-gradient(60% 70% at ${x2}% ${y2}%, rgb(255 255 255 / 0.1) 0%, transparent 60%), linear-gradient(150deg, #1a1a1a 0%, #070707 100%)`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

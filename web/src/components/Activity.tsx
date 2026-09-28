import { Flame, Target } from "lucide-react";
import type { ProgressEntry } from "@/lib/types";

const DAY = 86400000;
const WEEKS = 26;
const WEEKLY_GOAL = 5;

const key = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Días con actividad (clases vistas o completadas) → racha, mapa de calor y meta semanal. */
export function computeActivity(progress: Map<string, ProgressEntry>, now = new Date()) {
  const perDay = new Map<string, number>();
  for (const e of progress.values()) {
    const k = key(new Date(e.updatedAt));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const today = startOfDay(now);
  // Racha: días seguidos con actividad terminando hoy (o ayer, si hoy aún no estudias).
  let streak = 0;
  let cursor = perDay.has(key(today)) ? today : new Date(today.getTime() - DAY);
  while (perDay.has(key(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  // Semana actual (lunes a domingo)
  const dow = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - dow * DAY);
  const doneThisWeek = [...progress.values()].filter((e) => e.completed && new Date(e.updatedAt) >= monday).length;
  // Mapa: WEEKS columnas × 7 filas, terminando en la semana actual
  const first = new Date(monday.getTime() - (WEEKS - 1) * 7 * DAY);
  const grid = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(first.getTime() + (w * 7 + d) * DAY);
      return { date: key(date), count: perDay.get(key(date)) ?? 0, future: date > today };
    }),
  );
  const activeDays = [...perDay.keys()].filter((k) => k >= key(first)).length;
  return { streak, doneThisWeek, grid, activeDays };
}

const level = (n: number) => (n === 0 ? "bg-white/[0.06]" : n === 1 ? "bg-white/30" : n <= 3 ? "bg-white/60" : "bg-white shadow-[0_0_8px_#ffffffaa]");
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short" });

export function ActivityCard({ progress }: { progress: Map<string, ProgressEntry> }) {
  const { streak, doneThisWeek, grid, activeDays } = computeActivity(progress);
  const goalPct = Math.min(100, Math.round((doneThisWeek / WEEKLY_GOAL) * 100));
  const r = 34;
  const c = 2 * Math.PI * r;

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-full ${streak ? "bg-white text-black shadow-[0_0_24px_-4px_#fff]" : "border border-white/10 bg-white/[0.05] text-subtle"}`}>
              <Flame className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-muted">Racha</p>
              <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                {streak} <span className="serif font-normal">{streak === 1 ? "día" : "días"}</span> <span className="text-sm font-normal tracking-normal text-subtle">{streak ? "seguidos" : "· ¡empieza hoy!"}</span>
              </p>
            </div>
          </div>
          <p className="hidden text-right text-xs text-subtle sm:block">
            {activeDays} {activeDays === 1 ? "día activo" : "días activos"}
            <br />
            en las últimas {WEEKS} semanas
          </p>
        </div>
        <div
          className="mt-5 grid grid-flow-col grid-rows-7 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
          aria-label="Actividad de las últimas semanas"
        >
          {grid.flat().map((d, i) => (
            <span
              key={d.date}
              title={d.future ? "" : `${fmt(d.date)} · ${d.count ? `${d.count} ${d.count === 1 ? "clase" : "clases"}` : "sin actividad"}`}
              style={{ animationDelay: `${i * 4}ms` }}
              className={`aspect-square w-full animate-[fade_0.5s_ease_backwards] rounded-full transition duration-300 hover:scale-150 ${d.future ? "bg-transparent" : level(d.count)}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-subtle">
          Menos
          {[0, 1, 2, 4].map((n) => (
            <span key={n} className={`size-2.5 rounded-full ${level(n)}`} />
          ))}
          Más
        </div>
      </div>

      <div className="card flex items-center gap-5 p-5">
        <div className="relative size-24 shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-white/10" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-white drop-shadow-[0_0_6px_#fff] transition-[stroke-dashoffset] duration-1000"
              style={{ animation: "ring-in 1.6s var(--ease-out-expo) backwards", ["--ring-from" as string]: c }}
              strokeDasharray={c}
              strokeDashoffset={c - (goalPct / 100) * c}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <span className="serif text-3xl tabular-nums leading-none">
              {doneThisWeek}
              <span className="font-sans text-xs not-italic text-subtle">/{WEEKLY_GOAL}</span>
            </span>
          </div>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Target className="size-3.5" aria-hidden /> Meta semanal
          </p>
          <p className="mt-1 text-xl font-semibold leading-snug tracking-[-0.02em]">
            {doneThisWeek >= WEEKLY_GOAL ? (
              <>
                ¡Meta <em className="serif font-normal">cumplida</em>!
              </>
            ) : (
              <>
                Te {WEEKLY_GOAL - doneThisWeek === 1 ? "falta" : "faltan"} <em className="serif font-normal">{WEEKLY_GOAL - doneThisWeek === 1 ? "1 clase" : `${WEEKLY_GOAL - doneThisWeek} clases`}</em>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-subtle">Completa {WEEKLY_GOAL} clases por semana para avanzar a buen ritmo.</p>
        </div>
      </div>
    </div>
  );
}

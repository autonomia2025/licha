"use client";

import { scrollBehavior } from "@/lib/motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, LocateFixed, RotateCw, Search, SearchX } from "lucide-react";
import { EmptyState } from "@/components/States";
import { usePlayer } from "./PlayerContext";
import { formatClock } from "@/lib/format";

interface Cue {
  start: number;
  end: number;
  text: string;
}

function toSeconds(ts: string) {
  const p = ts.trim().split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

/** Lee un WebVTT y agrupa líneas cortas en frases de ~2 cues para que la lectura sea fluida. */
function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const lines = vtt.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([\d:.]+)\s+-->\s+([\d:.]+)/);
    if (!m) continue;
    const body: string[] = [];
    for (i = i + 1; i < lines.length && lines[i].trim() !== ""; i++) body.push(lines[i].replace(/<[^>]+>/g, "").trim());
    const text = body.join(" ").trim();
    if (text) cues.push({ start: toSeconds(m[1]), end: toSeconds(m[2]), text });
  }
  const merged: Cue[] = [];
  for (const c of cues) {
    const last = merged[merged.length - 1];
    if (last && last.text.length < 90 && !/[.!?]$/.test(last.text)) {
      last.text = `${last.text} ${c.text}`;
      last.end = c.end;
    } else merged.push({ ...c });
  }
  return merged;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function Transcript({ src }: { src: string | null }) {
  const { time, seek, hasVideo } = usePlayer();
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setCues(parseVtt(t)))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [src, attempt]);

  const activeIndex = useMemo(() => (cues ? cues.findIndex((c) => time >= c.start && time < c.end + 0.25) : -1), [cues, time]);
  const shown = useMemo(() => {
    if (!cues) return [];
    const t = norm(q.trim());
    return cues.map((c, i) => ({ ...c, i })).filter((c) => !t || norm(c.text).includes(t));
  }, [cues, q]);

  // Mantiene la frase actual a la vista mientras se reproduce.
  useEffect(() => {
    if (!follow || q || activeIndex < 0 || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(`[data-i="${activeIndex}"]`);
    if (el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 3, behavior: scrollBehavior() });
  }, [activeIndex, follow, q]);

  if (!src) return <EmptyState icon={FileText} title="Sin transcripción por ahora" className="py-10">Esta clase todavía no tiene transcripción disponible.</EmptyState>;
  if (error)
    return (
      <EmptyState
        icon={FileText}
        title="No pudimos cargar la transcripción"
        className="py-10"
        action={
          <button
            onClick={() => {
              setError(false);
              setCues(null);
              setAttempt((a) => a + 1);
            }}
            className="btn btn-ghost btn-sm"
          >
            <RotateCw className="size-3.5" aria-hidden /> Reintentar
          </button>
        }
      >
        Puede ser un problema de conexión pasajero.
      </EmptyState>
    );
  if (!cues)
    // Esqueleto con la misma forma: buscador + nota + frases con su minuto
    return (
      <div aria-busy="true" aria-label="Cargando transcripción">
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-full" />
          <div className="skeleton h-10 w-32 rounded-full" />
        </div>
        <div className="skeleton mt-3 h-3 w-64 rounded-full" />
        <div className="glass mt-3 space-y-4 rounded-2xl p-5">
          {[92, 78, 85, 64, 88, 72].map((w, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-3.5 w-9 shrink-0 rounded-full" />
              <div className="skeleton h-3.5 rounded-full" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    );

  const highlight = (text: string) => {
    const t = q.trim();
    if (!t) return text;
    const i = norm(text).indexOf(norm(t));
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="rounded bg-white px-0.5 text-black">{text.slice(i, i + t.length)}</mark>
        {text.slice(i + t.length)}
      </>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en lo que se dice en el video…"
            aria-label="Buscar en la transcripción"
            className="input h-10 rounded-full pl-9 pr-3 text-sm"
          />
        </div>
        {hasVideo ? (
          <button onClick={() => setFollow((f) => !f)} className={`chip h-10 cursor-pointer px-3 transition-colors duration-150 active:scale-95 ${follow ? "border-white/40 text-ink" : ""}`} aria-pressed={follow}>
            <LocateFixed className="size-3.5" aria-hidden /> Seguir video
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-subtle">
        {q ? `${shown.length} ${shown.length === 1 ? "coincidencia" : "coincidencias"}` : "Transcripción en inglés · haz clic en una frase para ir a ese momento"}
      </p>
      <div ref={box} className="scroll-thin relative mt-3 max-h-[28rem] overflow-y-auto glass rounded-2xl p-2">
        {q && !shown.length ? (
          <EmptyState icon={SearchX} title={`Nada para “${q}”`} className="py-8">
            Prueba con otra palabra (la transcripción está en inglés).
          </EmptyState>
        ) : null}
        {shown.map((c) => {
          const active = c.i === activeIndex;
          return (
            <button
              key={c.i}
              data-i={c.i}
              onClick={() => seek(c.start)}
              disabled={!hasVideo}
              className={`group flex w-full gap-3 rounded-xl px-3 py-2 text-left text-[15px] leading-relaxed transition-colors duration-200 active:bg-white/[0.12] ${active ? "bg-white/[0.09] text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"} disabled:cursor-default`}
            >
              <span className={`mt-0.5 shrink-0 font-mono text-xs tabular-nums ${active ? "text-ink" : "text-subtle group-hover:text-ink"}`}>{formatClock(c.start * 1000) || "0:00"}</span>
              <span>{highlight(c.text)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

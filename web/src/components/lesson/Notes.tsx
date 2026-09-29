"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AlertCircle, Check, Clock, NotebookPen, Pin, Trash2 } from "lucide-react";
import { BtnContent, SwapLabel } from "@/components/BtnContent";
import { EmptyState } from "@/components/States";
import { toast } from "@/components/Toaster";
import { addNote, deleteNote } from "@/app/actions";
import { usePlayer } from "./PlayerContext";
import { formatClock } from "@/lib/format";
import type { Note } from "@/lib/types";

export function Notes({ lessonId, initial }: { lessonId: string; initial: Note[] }) {
  const { time, seek, hasVideo } = usePlayer();
  const [notes, setNotes] = useState(initial);
  const [optimistic, apply] = useOptimistic(notes, (state, action: { type: "add"; note: Note } | { type: "del"; id: string }) =>
    action.type === "add" ? [...state, action.note] : state.filter((n) => n.id !== action.id),
  );
  const [pending, start] = useTransition();
  const [withTime, setWithTime] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false); // "Guardada ✓" durante un momento
  const [leaving, setLeaving] = useState<Set<string>>(new Set()); // notas animando su salida
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 1400);
    return () => window.clearTimeout(t);
  }, [saved]);

  const sorted = [...optimistic].sort((a, b) => (a.atS ?? 1e9) - (b.atS ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
  const stamp = hasVideo && withTime ? Math.floor(time) : null;

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const temp: Note = { id: `tmp-${Date.now()}`, atS: stamp, body, createdAt: new Date().toISOString() };
    setText("");
    setError(null);
    start(async () => {
      apply({ type: "add", note: temp });
      const saved = await addNote(lessonId, body, stamp).catch(() => null);
      if (!saved) {
        setError("No pudimos guardar la nota. Tu texto sigue aquí: inténtalo de nuevo.");
        setText(body);
        return;
      }
      setNotes((n) => [...n, saved]);
      setSaved(true);
    });
  };

  // Borrar: la nota se desliza y se desvanece (260 ms) y luego se elimina; si falla, vuelve y se avisa.
  const remove = (n: Note) => {
    setLeaving((s) => new Set(s).add(n.id));
    window.setTimeout(() => {
      start(async () => {
        apply({ type: "del", id: n.id });
        const ok = await deleteNote(n.id);
        setLeaving((s) => {
          const x = new Set(s);
          x.delete(n.id);
          return x;
        });
        if (ok) {
          setNotes((all) => all.filter((x) => x.id !== n.id));
          toast("Nota eliminada");
        } else toast.error("No pudimos borrar la nota. Inténtalo de nuevo.");
      });
    }, 240);
  };

  return (
    <div>
      <div className="card p-3 transition-[border-color,box-shadow] duration-200 focus-within:border-white/30 focus-within:shadow-[0_0_0_4px_#ffffff0d]">
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          onInput={() => error && setError(null)}
          rows={3}
          maxLength={4000}
          placeholder="Escribe una idea, un gancho que te gustó, algo para aplicar…"
          aria-label="Nueva nota"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-ink placeholder:text-subtle outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {hasVideo ? (
            <button type="button" onClick={() => setWithTime((w) => !w)} className={`chip h-8 cursor-pointer transition-colors duration-150 active:scale-95 ${withTime ? "border-white/40 text-ink" : ""}`} aria-pressed={withTime}>
              <Clock className="size-3.5" aria-hidden /> {withTime ? `En ${formatClock(Math.max(1, stamp ?? 0) * 1000)}` : "Sin minuto"}
            </button>
          ) : (
            <span className="text-xs text-subtle">Nota general de la clase</span>
          )}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-subtle sm:inline">⌘ + Enter</span>
            <button onClick={submit} disabled={!text.trim() && !pending && !saved} aria-busy={pending} className="btn btn-accent btn-sm">
              <BtnContent>
                <SwapLabel
                  active={saved ? 1 : 0}
                  labels={[
                    <>
                      <Pin className="size-4" aria-hidden /> Guardar nota
                    </>,
                    <>
                      <Check className="size-4" aria-hidden /> Guardada
                    </>,
                  ]}
                />
              </BtnContent>
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="alert alert-error mt-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}

      {sorted.length ? (
        <ul className="mt-5 space-y-2">
          {sorted.map((n) => (
            <li
              key={n.id}
              className={`group card flex items-start gap-3 p-4 transition-opacity duration-200 ${n.id.startsWith("tmp-") ? "opacity-60" : ""} ${leaving.has(n.id) ? "animate-collapse" : "animate-fade-up"}`}
            >
              {n.atS !== null ? (
                <button
                  onClick={() => seek(n.atS!)}
                  disabled={!hasVideo}
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-black transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_16px_-2px_#fff] active:scale-95 disabled:cursor-default"
                  title="Ir a este momento"
                >
                  {formatClock(Math.max(1, n.atS) * 1000)}
                </button>
              ) : (
                <span className="serif shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-sm text-muted">nota</span>
              )}
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/90">{n.body}</p>
              <button
                onClick={() => remove(n)}
                disabled={leaving.has(n.id) || n.id.startsWith("tmp-")}
                className="icon-btn size-8 shrink-0 text-subtle opacity-0 hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label="Borrar nota"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={NotebookPen} title="Aún no tienes notas en esta clase" className="py-10">
          {hasVideo ? "Escribe una idea mientras ves el video: la nota guarda el minuto para volver a ese momento." : "Anota ideas para aplicar. Solo tú puedes verlas."}
        </EmptyState>
      )}
    </div>
  );
}

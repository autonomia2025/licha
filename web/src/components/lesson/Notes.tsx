"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Clock, Loader2, Pin, Trash2 } from "lucide-react";
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
  const area = useRef<HTMLTextAreaElement>(null);

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
      const saved = await addNote(lessonId, body, stamp);
      if (!saved) {
        setError("No pudimos guardar la nota. Inténtalo de nuevo.");
        setText(body);
        return;
      }
      setNotes((n) => [...n, saved]);
    });
  };

  return (
    <div>
      <div className="card p-3 focus-within:border-accent/50">
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
          rows={3}
          maxLength={4000}
          placeholder="Escribe una idea, un gancho que te gustó, algo para aplicar…"
          aria-label="Nueva nota"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-ink placeholder:text-subtle outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {hasVideo ? (
            <button type="button" onClick={() => setWithTime((w) => !w)} className={`chip h-8 cursor-pointer ${withTime ? "border-white/40 text-ink" : ""}`} aria-pressed={withTime}>
              <Clock className="size-3.5" aria-hidden /> {withTime ? `En ${formatClock(Math.max(1, stamp ?? 0) * 1000)}` : "Sin minuto"}
            </button>
          ) : (
            <span className="text-xs text-subtle">Nota general de la clase</span>
          )}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-subtle sm:inline">⌘ + Enter</span>
            <button onClick={submit} disabled={!text.trim() || pending} className="btn btn-accent h-9 px-4 text-sm">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Pin className="size-4" aria-hidden />} Guardar nota
            </button>
          </div>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {sorted.length ? (
        <ul className="mt-5 space-y-2">
          {sorted.map((n) => (
            <li key={n.id} className={`group card flex animate-pop items-start gap-3 p-4 ${n.id.startsWith("tmp-") ? "opacity-60" : ""}`}>
              {n.atS !== null ? (
                <button
                  onClick={() => seek(n.atS!)}
                  disabled={!hasVideo}
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-black transition hover:shadow-[0_0_16px_-2px_#fff] disabled:cursor-default"
                  title="Ir a este momento"
                >
                  {formatClock(Math.max(1, n.atS) * 1000)}
                </button>
              ) : (
                <span className="serif shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-sm text-muted">nota</span>
              )}
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink/90">{n.body}</p>
              <button
                onClick={() =>
                  start(async () => {
                    apply({ type: "del", id: n.id });
                    const ok = await deleteNote(n.id);
                    if (ok) setNotes((all) => all.filter((x) => x.id !== n.id));
                  })
                }
                className="shrink-0 rounded-md p-1.5 text-subtle opacity-0 transition hover:bg-surface-2 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                aria-label="Borrar nota"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center text-sm text-subtle">Tus notas de esta clase aparecerán aquí. Solo tú puedes verlas.</p>
      )}
    </div>
  );
}

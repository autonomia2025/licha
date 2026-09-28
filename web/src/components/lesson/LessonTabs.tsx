"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AlignLeft, FileDown, MessageSquareText, NotebookPen } from "lucide-react";

type TabId = "descripcion" | "transcripcion" | "notas" | "recursos";

export function LessonTabs({
  description,
  transcript,
  notes,
  resources,
  notesCount,
  resourcesCount,
  defaultTab,
}: {
  description: ReactNode | null;
  transcript: ReactNode | null;
  notes: ReactNode;
  resources: ReactNode | null;
  notesCount: number;
  resourcesCount: number;
  defaultTab?: TabId;
}) {
  const tabs = [
    description ? { id: "descripcion" as const, label: "Descripción", icon: AlignLeft, content: description } : null,
    transcript ? { id: "transcripcion" as const, label: "Transcripción", icon: MessageSquareText, content: transcript } : null,
    { id: "notas" as const, label: "Mis notas", icon: NotebookPen, content: notes, count: notesCount },
    resources ? { id: "recursos" as const, label: "Recursos", icon: FileDown, content: resources, count: resourcesCount } : null,
  ].filter((t): t is NonNullable<typeof t> => Boolean(t));
  const [active, setActive] = useState<TabId>(defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const bar = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // Píldora blanca que se desliza hasta la pestaña activa
  useLayoutEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>(`[data-tab="${current.id}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [current.id, tabs.length]);

  return (
    <section className="mt-6">
      <div ref={bar} role="tablist" aria-label="Contenido de la clase" className="glass scroll-thin relative isolate flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {pill ? (
          <span
            className="absolute inset-y-1 -z-10 rounded-full bg-white shadow-[0_0_24px_-6px_#fff] transition-[left,width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
            style={{ left: pill.left, width: pill.width }}
            aria-hidden
          />
        ) : null}
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              data-tab={t.id}
              onClick={() => setActive(t.id)}
              className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition duration-300 ${on ? "text-black" : "text-muted hover:text-ink"} ${on && !pill ? "bg-white" : ""}`}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
              {"count" in t && t.count ? <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-black/10 text-black" : "bg-white/10 text-muted"}`}>{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6 animate-fade-up" key={current.id}>
        {current.content}
      </div>
    </section>
  );
}

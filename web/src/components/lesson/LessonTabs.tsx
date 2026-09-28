"use client";

import { useState, type ReactNode } from "react";
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

  return (
    <section className="mt-6">
      <div role="tablist" aria-label="Contenido de la clase" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition ${on ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
              {"count" in t && t.count ? <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums text-muted">{t.count}</span> : null}
              {on ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden /> : null}
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

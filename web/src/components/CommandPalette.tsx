"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, CornerDownLeft, FileText, Home, PlayCircle, Search, ExternalLink, SearchX } from "lucide-react";
import { usePresence } from "@/lib/usePresence";

export interface PaletteItem {
  id: string;
  title: string;
  original: string;
  course: string;
  href: string;
  number: number;
  kind: "video" | "texto" | "externo";
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Búsqueda instantánea (⌘K / Ctrl+K) en todas las clases. Tolera palabras en desorden y sin tildes. */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const presence = usePresence(open, 180);

  const show = () => {
    setQ("");
    setSel(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else show();
      } else if (e.key === "/" && !open && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const quick = [
    { id: "go-home", title: "Ir al inicio", course: "Navegación", href: "/", icon: Home },
    { id: "go-courses", title: "Ver todos los cursos", course: "Navegación", href: "/cursos", icon: BookOpen },
  ];

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return items
      .map((it) => {
        const hay = norm(`${it.title} ${it.original} ${it.course}`);
        if (!words.every((w) => hay.includes(w))) return null;
        const t = norm(it.title);
        const score = (t.startsWith(words[0]) ? 3 : 0) + (t.includes(words.join(" ")) ? 2 : 0) + words.filter((w) => t.includes(w)).length;
        return { it, score };
      })
      .filter((x): x is { it: PaletteItem; score: number } => Boolean(x))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.it);
  }, [q, items]);

  const rows = q ? results.map((r) => ({ id: r.id, title: r.title, course: `${r.course} · Clase ${r.number}`, href: r.href, kind: r.kind })) : quick.map((x) => ({ ...x, kind: null }));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-sel="true"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={show}
        className="ml-auto hidden h-10 w-full max-w-xs items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-subtle transition-[background-color,border-color,color,transform] duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-muted active:scale-[0.98] md:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Buscar clases…</span>
        <kbd className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-muted">⌘K</kbd>
      </button>
      <button onClick={show} className="icon-btn ml-auto size-10 border border-white/10 bg-white/[0.04] text-muted hover:bg-white/10 md:hidden" aria-label="Buscar">
        <Search className="size-4" />
      </button>

      {presence.mounted ? createPortal(
        <div data-state={presence.state} className="overlay fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar clases"
            data-state={presence.state}
            className="modal glass-float w-full max-w-2xl overflow-hidden bg-neutral-950/60 shadow-[0_1px_0_0_#ffffff1f_inset,0_40px_120px_-20px_#000]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 text-subtle" aria-hidden />
              <input
                ref={input}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSel((s) => Math.min(rows.length - 1, s + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSel((s) => Math.max(0, s - 1));
                  } else if (e.key === "Enter" && rows[sel]) {
                    e.preventDefault();
                    go(rows[sel].href);
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Busca una clase: ganchos, testing, UGC, ofertas…"
                aria-label="Buscar"
                className="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-subtle outline-none"
              />
              <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-subtle">Esc</kbd>
            </div>
            <ul ref={list} className="scroll-thin max-h-[55vh] overflow-y-auto p-2" role="listbox">
              {q && !rows.length ? (
                <li className="flex animate-fade flex-col items-center px-4 py-10 text-center">
                  <SearchX className="size-5 text-subtle" aria-hidden />
                  <p className="mt-3 text-sm font-medium text-ink">Sin resultados para “{q}”</p>
                  <p className="mt-1 text-xs text-subtle">Prueba con menos palabras o con el título original en inglés.</p>
                </li>
              ) : null}
              {rows.map((r, i) => {
                const Icon = r.kind === "texto" ? FileText : r.kind === "externo" ? ExternalLink : r.kind === "video" ? PlayCircle : "icon" in r ? (r as { icon: typeof Home }).icon : Search;
                const active = i === sel;
                return (
                  <li key={r.id} role="option" aria-selected={active} data-sel={active}>
                    <button
                      onMouseMove={() => setSel(i)}
                      onClick={() => go(r.href)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-100 active:bg-white/[0.12] ${active ? "bg-white/[0.08]" : ""}`}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150 ${active ? "bg-white text-black shadow-[0_0_20px_-4px_#fff]" : "border border-white/10 bg-white/[0.04] text-muted"}`}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                        <span className="block truncate text-xs text-subtle">{r.course}</span>
                      </span>
                      {active ? <CornerDownLeft className="size-4 shrink-0 text-subtle" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-subtle">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span className="ml-auto">{items.length} clases indexadas</span>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

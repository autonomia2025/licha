"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Home, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import type { Viewer } from "@/lib/types";

export function UserMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const initial = (viewer.name || viewer.email).charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de usuario"
        className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white ring-2 ring-transparent transition hover:ring-accent/40"
      >
        {initial}
      </button>
      {open ? (
        <div role="menu" className="card absolute right-0 top-12 w-64 animate-fade-up p-2">
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="text-sm font-semibold text-ink">{viewer.name}</p>
            <p className="truncate text-xs text-subtle">{viewer.email}</p>
          </div>
          <div className="py-1 sm:hidden">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
              <Home className="size-4" /> Inicio
            </Link>
            <Link href="/cursos" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
              <BookOpen className="size-4" /> Cursos
            </Link>
          </div>
          <form action={signOut}>
            <button role="menuitem" className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

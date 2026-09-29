"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Home, Loader2, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import type { Viewer } from "@/lib/types";
import { usePresence } from "@/lib/usePresence";

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
  const presence = usePresence(open, 140);
  const [signingOut, setSigningOut] = useState(false);
  const initial = (viewer.name || viewer.email).charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de usuario"
        className="serif grid size-10 place-items-center rounded-full bg-white text-xl leading-none text-black shadow-[0_0_24px_-6px_#fff] ring-4 ring-transparent transition-[box-shadow,transform] duration-200 hover:ring-white/15 active:scale-95 aria-expanded:ring-white/20"
      >
        {initial}
      </button>
      {presence.mounted ? (
        <div role="menu" data-state={presence.state} className="surface glass absolute right-0 top-14 w-64 origin-top-right bg-neutral-950/85 p-2">
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="serif text-lg leading-tight text-ink">{viewer.name}</p>
            <p className="truncate text-xs text-subtle">{viewer.email}</p>
          </div>
          <div className="py-1 sm:hidden">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.08] hover:text-ink active:bg-white/[0.12]">
              <Home className="size-4" /> Inicio
            </Link>
            <Link href="/cursos" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.08] hover:text-ink active:bg-white/[0.12]">
              <BookOpen className="size-4" /> Cursos
            </Link>
          </div>
          <form action={signOut} onSubmit={() => setSigningOut(true)}>
            <button role="menuitem" aria-busy={signingOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.08] hover:text-ink active:bg-white/[0.12]">
              {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

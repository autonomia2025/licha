import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import type { Viewer } from "@/lib/types";

export function AppHeader({ viewer, demo }: { viewer: Viewer; demo: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-xl">
      {demo ? (
        <div className="border-b border-accent/20 bg-accent-soft px-4 py-1.5 text-center text-xs text-accent-strong">
          Modo demo · datos de ejemplo. Conecta Supabase para ver el contenido real.
        </div>
      ) : null}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Inicio" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks />
        <form action="/buscar" className="relative ml-auto hidden w-full max-w-xs md:block" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            name="q"
            type="search"
            placeholder="Buscar clases…"
            aria-label="Buscar clases"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-subtle outline-none transition focus:border-accent/60 focus:bg-surface-2"
          />
        </form>
        <Link href="/buscar" className="ml-auto grid size-10 place-items-center rounded-xl border border-line text-muted md:hidden" aria-label="Buscar">
          <Search className="size-4" />
        </Link>
        <UserMenu viewer={viewer} />
      </div>
    </header>
  );
}

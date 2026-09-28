import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import type { Viewer } from "@/lib/types";

export function AppHeader({ viewer, demo, items }: { viewer: Viewer; demo: boolean; items: PaletteItem[] }) {
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
        <CommandPalette items={items} />
        <UserMenu viewer={viewer} />
      </div>
    </header>
  );
}

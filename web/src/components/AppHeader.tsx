import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { StickyHeader } from "./StickyHeader";
import type { Viewer } from "@/lib/types";

export function AppHeader({ viewer, demo, items }: { viewer: Viewer; demo: boolean; items: PaletteItem[] }) {
  return (
    <>
      {demo ? (
        <div className="mx-auto mt-3 w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-center text-[11px] text-muted backdrop-blur-xl">
          <span className="serif text-[13px] text-ink">Modo demo</span> · datos de ejemplo. Conecta Supabase para ver el contenido real.
        </div>
      ) : null}
      <StickyHeader>
        <div className="glass mx-auto flex h-16 max-w-7xl items-center gap-4 rounded-full py-0 pl-5 pr-3 shadow-[0_1px_0_0_#ffffff14_inset,0_20px_50px_-20px_#000] transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] group-data-[scrolled=true]/hdr:h-14 group-data-[scrolled=true]/hdr:max-w-5xl group-data-[scrolled=true]/hdr:bg-black/50">
          <Link href="/" aria-label="Inicio" className="shrink-0">
            <Logo />
          </Link>
          <NavLinks />
          <CommandPalette items={items} />
          <UserMenu viewer={viewer} />
        </div>
      </StickyHeader>
    </>
  );
}

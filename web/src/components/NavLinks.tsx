"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Inicio", match: (p: string) => p === "/" },
  { href: "/cursos", label: "Cursos", match: (p: string) => p.startsWith("/cursos") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Principal">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

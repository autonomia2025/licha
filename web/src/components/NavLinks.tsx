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
    <nav className="relative isolate ml-4 hidden items-center gap-1 sm:flex" aria-label="Principal">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition duration-300 ${active ? "text-black" : "text-muted hover:bg-white/[0.06] hover:text-ink"}`}
          >
            {active ? <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_0_24px_-6px_#fff] [view-transition-name:nav-pill]" aria-hidden /> : null}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";

/** Cabecera fija que se compacta y oscurece al hacer scroll (data-scrolled). */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // Con histéresis para que no parpadee justo en el umbral.
    const on = () => setScrolled((was) => (was ? window.scrollY > 4 : window.scrollY > 24));
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header data-scrolled={scrolled} className="group/hdr sticky top-0 z-40 h-[76px] px-3 pt-3 sm:px-4 [view-transition-name:header]">
      {children}
    </header>
  );
}

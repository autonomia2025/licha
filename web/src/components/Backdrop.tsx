"use client";

import { useEffect, useRef } from "react";

/** Fondo vivo (orbes de luz + grano) y brillo que sigue al cursor en el fondo y en las tarjetas de vidrio. */
export function Backdrop() {
  const spot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      // Solo se escriben variables en el propio elemento del brillo y en la tarjeta bajo el cursor
      // (escribirlas en <html> recalcularía estilos de toda la página en cada movimiento).
      spot.current?.style.setProperty("--gx", `${e.clientX}px`);
      spot.current?.style.setProperty("--gy", `${e.clientY}px`);
      const card = (e.target as Element | null)?.closest?.<HTMLElement>(".card");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="backdrop-orb" />
      <div className="backdrop-orb" />
      <div className="backdrop-orb" />
      <div className="backdrop-grid" />
      <div ref={spot} className="backdrop-spot" />
      <div className="backdrop-grain" />
    </div>
  );
}

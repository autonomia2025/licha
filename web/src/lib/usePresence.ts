"use client";

import { useEffect, useState } from "react";

/**
 * Mantiene montado un elemento durante su animación de salida.
 * `state` va en data-state ("open" | "closed") y el CSS (.surface/.overlay/.modal) anima entrada y salida.
 */
export function usePresence(open: boolean, exitMs = 160) {
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  // Detecta el cierre durante el render (patrón "estado derivado del render anterior").
  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open);
  }
  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setClosing(false), reduced ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [closing, exitMs]);
  return { mounted: open || closing, state: open ? ("open" as const) : ("closed" as const) };
}

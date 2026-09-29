"use client";

import { useLayoutEffect } from "react";

/** Desplaza el temario lateral para que la clase actual quede a la vista. */
export function ScrollToCurrent({ containerId }: { containerId: string }) {
  // Antes de pintar: el temario aparece ya posicionado, sin salto visible.
  useLayoutEffect(() => {
    const box = document.getElementById(containerId);
    const current = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && current) box.scrollTop = current.offsetTop - box.clientHeight / 3;
  }, [containerId]);
  return null;
}

"use client";

import { useEffect } from "react";

/** Desplaza el temario lateral para que la clase actual quede a la vista. */
export function ScrollToCurrent({ containerId }: { containerId: string }) {
  useEffect(() => {
    const box = document.getElementById(containerId);
    const current = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && current) box.scrollTop = current.offsetTop - box.clientHeight / 3;
  }, [containerId]);
  return null;
}

"use client";

import { useState } from "react";

/** Imagen que aparece con un fundido corto al terminar de cargar (el contenedor ya reserva su espacio). */
export function FadeImg({ src, className = "" }: { src: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      ref={(el) => {
        // Si ya estaba en caché, onLoad puede no dispararse después de hidratar.
        if (el?.complete && el.naturalWidth && !loaded) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      className={`transition-opacity duration-300 ease-[var(--ease-out)] ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}

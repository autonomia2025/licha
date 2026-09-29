"use client";

import { useLinkStatus } from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Indicador dentro de un <Link>: flecha al pasar el mouse y spinner mientras la navegación está
 * pendiente (cuando la página destino aún no estaba precargada). Debe ir dentro del Link.
 */
export function LinkPending({ arrow = true, className = "" }: { arrow?: boolean; className?: string }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 className={`size-4 shrink-0 animate-spin text-white/70 ${className}`} aria-label="Cargando" />;
  if (!arrow) return <span className={`size-4 shrink-0 ${className}`} aria-hidden />;
  return (
    <ArrowRight
      className={`size-4 shrink-0 -translate-x-1 text-white/60 opacity-0 transition-[opacity,translate] duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100 ${className}`}
      aria-hidden
    />
  );
}

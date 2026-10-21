"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SwapLabel } from "@/components/BtnContent";
import { toast } from "@/components/Toaster";

/** Copia un texto al portapapeles; el botón confirma con "Copiado" un momento. */
export function CopyButton({ text, label = "Copiar", className = "btn btn-ghost btn-sm" }: { text: () => string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1600);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text());
          setDone(true);
        } catch {
          toast.error("No pudimos copiar. Selecciona el texto y cópialo a mano.");
        }
      }}
    >
      <SwapLabel
        active={done ? 1 : 0}
        labels={[
          <>
            <Copy className="size-3.5" aria-hidden /> {label}
          </>,
          <>
            <Check className="size-3.5" aria-hidden /> Copiado
          </>,
        ]}
      />
    </button>
  );
}

"use client";

import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Search } from "lucide-react";

function Icon() {
  const { pending } = useFormStatus();
  return pending ? (
    <Loader2 className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 animate-spin text-muted" aria-label="Buscando" />
  ) : (
    <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-subtle" aria-hidden />
  );
}

/** Buscador de la página /buscar: navega sin recargar y se queda fijo mientras llegan los resultados. */
export function SearchBox() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <Form action="/buscar" role="search" className="relative">
      <Icon />
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        autoFocus
        placeholder="¿Qué quieres aprender? Ej: ganchos, testing, UGC…"
        aria-label="Buscar clases"
        className="input h-14 rounded-full pl-12 pr-4 text-base"
      />
    </Form>
  );
}

export function SearchBoxFallback() {
  return <div className="skeleton h-14 rounded-full" />;
}

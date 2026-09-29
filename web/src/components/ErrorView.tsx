"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw, WifiOff } from "lucide-react";
import { BtnContent } from "./BtnContent";

/** Pantalla de error recuperable: explica qué pasó en lenguaje simple y ofrece reintentar. */
export function ErrorView({ error, retry, home = true }: { error: Error & { digest?: string }; retry: () => void; home?: boolean }) {
  const [retrying, setRetrying] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    console.error(error);
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6 py-16">
      <div className="glass w-full animate-fade-up p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted" aria-hidden>
          <WifiOff className="size-5" />
        </span>
        <h1 className="display mt-5 text-3xl">
          {offline ? (
            <>
              Sin <em>conexión</em>
            </>
          ) : (
            <>
              Algo no <em>cargó</em>
            </>
          )}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {offline
            ? "Parece que perdiste la conexión a internet. Cuando vuelva, reintenta."
            : "No pudimos traer el contenido en este momento. Suele ser algo pasajero: vuelve a intentarlo en unos segundos."}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => {
              setRetrying(true);
              retry();
              window.setTimeout(() => setRetrying(false), 1500);
            }}
            aria-busy={retrying}
            className="btn btn-primary"
          >
            <BtnContent>
              <RotateCw className="size-4" aria-hidden /> Reintentar
            </BtnContent>
          </button>
          {home ? (
            <Link href="/" className="btn btn-ghost">
              Ir al inicio
            </Link>
          ) : null}
        </div>
        {error.digest ? <p className="mt-6 font-mono text-[11px] text-subtle">Código: {error.digest}</p> : null}
      </div>
    </div>
  );
}

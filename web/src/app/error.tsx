"use client";

import { ErrorView } from "@/components/ErrorView";

/**
 * Errores fuera de las páginas con sesión (login, recuperar contraseña, o fallos de carga en el layout).
 * "Reintentar" recarga la página completa: así también se arregla el caso de una pestaña abierta con una
 * versión antigua de la app (las acciones del servidor cambian de id en cada publicación).
 */
export default function RootError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="flex-1">
      <ErrorView error={error} retry={() => window.location.reload()} home={false} />
    </main>
  );
}

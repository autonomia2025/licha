"use client";

import { ErrorView } from "@/components/ErrorView";

/** Errores fuera de las páginas (por ejemplo, al cargar la biblioteca en el layout). */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex-1">
      <ErrorView error={error} retry={retry} home={false} />
    </main>
  );
}

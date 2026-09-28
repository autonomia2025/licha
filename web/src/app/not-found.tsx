import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-6 py-24 text-center">
      <div className="animate-fade-up">
        <Logo className="justify-center" />
        <p className="mt-10 font-mono text-sm text-accent-strong">404</p>
        <h1 className="mt-2 text-2xl font-semibold">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-muted">Puede que la clase haya cambiado de lugar.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

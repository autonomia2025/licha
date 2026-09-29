import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-6 py-24 text-center">
      <div className="animate-fade-up">
        <Logo className="justify-center" />
        <p className="serif mt-10 text-[9rem] leading-none text-white/90">404</p>
        <h1 className="display mt-2 text-3xl">
          No encontramos esta <em>página</em>
        </h1>
        <p className="mt-2 text-sm text-muted">Puede que la clase haya cambiado de lugar.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primary">
            Volver al inicio
          </Link>
          <Link href="/buscar" className="btn btn-ghost">
            Buscar una clase
          </Link>
        </div>
      </div>
    </main>
  );
}

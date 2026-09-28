import { Logo } from "./ui";

/** Pantalla dividida para login / recuperar contraseña. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 20%, #7c6cff40 0%, transparent 60%), radial-gradient(50% 40% at 80% 80%, #3b82f630 0%, transparent 60%), linear-gradient(160deg, #0f0f14, #09090b)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">Anuncios que venden. Marcas que escalan.</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">El programa completo de Evolve para llevar tu e-commerce al siguiente nivel, clase por clase.</p>
          </div>
          <p className="text-sm text-subtle">© {new Date().getFullYear()} Evolve</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-fade-up">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}

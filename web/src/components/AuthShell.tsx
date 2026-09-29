import { Logo } from "./ui";

/** Pantalla de login / recuperar contraseña: titular editorial a la izquierda y formulario de vidrio. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen flex-1 lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <Logo className="animate-fade-up" />
        <div className="max-w-xl">
          <p className="eyebrow animate-fade-up [animation-delay:30ms]">Área de alumnos</p>
          <h1 className="display mt-6 animate-fade-up text-7xl [animation-delay:60ms] xl:text-8xl">
            Anuncios que <em className="shine">venden</em>.
            <br />
            Marcas que <em>escalan</em>.
          </h1>
          <p className="mt-8 max-w-md animate-fade-up text-lg leading-relaxed text-muted [animation-delay:90ms]">
            El programa completo del Estudio de Licha para llevar tu e-commerce al siguiente nivel, <em className="serif text-[1.15em] text-ink">clase por clase</em>.
          </p>
        </div>
        <div className="flex animate-fade-up items-center gap-6 text-sm text-subtle [animation-delay:120ms]">
          <span>
            <span className="serif text-2xl text-ink">14</span> cursos
          </span>
          <span className="h-4 w-px bg-white/15" />
          <span>
            <span className="serif text-2xl text-ink">+700</span> clases
          </span>
          <span className="h-4 w-px bg-white/15" />
          <span>© {new Date().getFullYear()} Estudio de Licha</span>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-16">
        <div className="glass w-full max-w-md animate-fade-up p-8 [animation-delay:60ms] sm:p-10">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}

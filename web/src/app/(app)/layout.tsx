import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Logo } from "@/components/ui";
import { getViewer, hasAccess, isDemo } from "@/lib/data";
import { signOut } from "@/app/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");

  if (!(await hasAccess())) {
    return (
      <main className="grid flex-1 place-items-center px-6 py-24">
        <div className="card max-w-md animate-fade-up p-8 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-8 text-xl font-semibold">Tu cuenta aún no tiene acceso</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Iniciaste sesión como <span className="text-ink">{viewer.email}</span>, pero este correo no está en la lista de alumnos. Si ya compraste, escríbenos para activarlo.
          </p>
          <form action={signOut} className="mt-8">
            <button className="btn btn-ghost w-full">Usar otra cuenta</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
      <AppHeader viewer={viewer} demo={isDemo} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/60 py-8 text-center text-xs text-subtle">© {new Date().getFullYear()} Evolve · Área de alumnos</footer>
    </>
  );
}

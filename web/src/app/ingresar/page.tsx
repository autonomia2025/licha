import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  const v = (await searchParams).volver;
  const volver = typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";
  return (
    <AuthShell>
      <h2 className="display text-4xl">
        Bienvenido de <em>vuelta</em>
      </h2>
      <p className="mt-2 text-sm text-muted">Ingresa con el correo con el que te inscribiste.</p>
      <LoginForm volver={volver} />
    </AuthShell>
  );
}

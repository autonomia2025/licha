import { AuthShell } from "@/components/AuthShell";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata = { title: "Nueva contraseña" };

export default function ResetPage() {
  return (
    <AuthShell>
      <h2 className="display text-4xl">
        Crea tu <em>contraseña</em>
      </h2>
      <p className="mt-2 text-sm text-muted">Elige una contraseña de al menos 8 caracteres.</p>
      <NewPasswordForm />
    </AuthShell>
  );
}

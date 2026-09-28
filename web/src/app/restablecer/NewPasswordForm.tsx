"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updatePassword } from "@/app/actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Nueva contraseña</span>
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
          className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none transition focus:border-accent/60"
        />
      </label>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Guardar y entrar
      </button>
    </form>
  );
}

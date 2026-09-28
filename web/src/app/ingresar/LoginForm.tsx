"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { requestReset, signIn } from "@/app/actions";

const input =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-subtle outline-none transition focus:border-accent/60 focus:bg-surface-2";

export function LoginForm({ volver }: { volver: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginAction, loggingIn] = useActionState(signIn, undefined);
  const [resetState, resetAction, resetting] = useActionState(requestReset, undefined);

  if (mode === "reset") {
    return (
      <form action={resetAction} className="mt-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Correo</span>
          <input name="email" type="email" autoComplete="email" required className={input} placeholder="tu@correo.com" />
        </label>
        {resetState?.error ? <p className="text-sm text-red-400">{resetState.error}</p> : null}
        {resetState?.ok ? <p className="rounded-xl border border-success/25 bg-success/10 p-3 text-sm text-success">{resetState.ok}</p> : null}
        <button className="btn btn-primary w-full" disabled={resetting}>
          {resetting ? <Loader2 className="size-4 animate-spin" /> : null} Enviar enlace
        </button>
        <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-muted hover:text-ink">
          ← Volver a ingresar
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="mt-8 space-y-4">
      <input type="hidden" name="volver" value={volver} />
      <label className="block space-y-2">
        <span className="text-sm font-medium">Correo</span>
        <input name="email" type="email" autoComplete="email" required className={input} placeholder="tu@correo.com" />
      </label>
      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm font-medium">
          Contraseña
          <button type="button" onClick={() => setMode("reset")} className="text-xs font-normal text-muted hover:text-ink">
            ¿La olvidaste?
          </button>
        </span>
        <input name="password" type="password" autoComplete="current-password" required className={input} placeholder="••••••••" />
      </label>
      {loginState?.error ? (
        <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">
          {loginState.error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" disabled={loggingIn}>
        {loggingIn ? <Loader2 className="size-4 animate-spin" /> : null} Ingresar <ArrowRight className="size-4" aria-hidden />
      </button>
    </form>
  );
}

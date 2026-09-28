"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { requestReset, signIn } from "@/app/actions";

const input = "input text-[15px]";

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
        {resetState?.ok ? <p className="rounded-2xl border border-white/15 bg-white/[0.06] p-3 text-sm text-ink">{resetState.ok}</p> : null}
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
        <p role="alert" className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">
          {loginState.error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" disabled={loggingIn}>
        {loggingIn ? <Loader2 className="size-4 animate-spin" /> : null} Ingresar <ArrowRight className="size-4" aria-hidden />
      </button>
    </form>
  );
}

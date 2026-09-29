"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { requestReset, signIn } from "@/app/actions";
import { BtnContent } from "@/components/BtnContent";

export function LoginForm({ volver }: { volver: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginAction, loggingIn] = useActionState(signIn, undefined);
  const [resetState, resetAction, resetting] = useActionState(requestReset, undefined);
  // El error se muestra hasta que el alumno vuelve a escribir.
  const [editedSince, setEditedSince] = useState<object | undefined>(undefined);
  const [showPass, setShowPass] = useState(false);
  const loginError = loginState?.error && editedSince !== loginState ? loginState.error : null;
  const onEdit = () => loginState && setEditedSince(loginState);

  if (mode === "reset") {
    return (
      <form key="reset" action={resetAction} className="mt-8 animate-fade-up space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Correo</span>
          <input name="email" type="email" autoComplete="email" required className="input text-[15px]" placeholder="tu@correo.com" aria-invalid={Boolean(resetState?.error)} />
        </label>
        {resetState?.error ? (
          <p role="alert" className="alert alert-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {resetState.error}
          </p>
        ) : null}
        {resetState?.ok ? (
          <p role="status" className="alert alert-ok">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {resetState.ok}
          </p>
        ) : null}
        <button className="btn btn-primary w-full" aria-busy={resetting}>
          <BtnContent>{resetState?.ok ? "Enviar de nuevo" : "Enviar enlace"}</BtnContent>
        </button>
        <button type="button" onClick={() => setMode("login")} className="mx-auto flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a ingresar
        </button>
      </form>
    );
  }

  return (
    <form key="login" action={loginAction} className="mt-8 animate-fade-up space-y-4">
      <input type="hidden" name="volver" value={volver} />
      <label className="block space-y-2">
        <span className="text-sm font-medium">Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          onChange={onEdit}
          aria-invalid={Boolean(loginError)}
          aria-describedby={loginError ? "login-error" : undefined}
          className="input text-[15px]"
          placeholder="tu@correo.com"
        />
      </label>
      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm font-medium">
          Contraseña
          <button type="button" onClick={() => setMode("reset")} className="link-underline text-xs font-normal text-muted hover:text-ink">
            ¿La olvidaste?
          </button>
        </span>
        <span className="relative block">
          <input
            name="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            required
            onChange={onEdit}
            aria-invalid={Boolean(loginError)}
            aria-describedby={loginError ? "login-error" : undefined}
            className="input pr-12 text-[15px]"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPass}
            className="icon-btn absolute right-1.5 top-1/2 size-9 -translate-y-1/2 text-subtle hover:bg-white/10 hover:text-ink"
          >
            {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      {loginError ? (
        <p id="login-error" role="alert" className="alert alert-error">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {loginError}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" aria-busy={loggingIn}>
        <BtnContent>
          Ingresar <ArrowRight className="size-4" aria-hidden />
        </BtnContent>
      </button>
    </form>
  );
}

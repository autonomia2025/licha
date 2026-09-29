"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { updatePassword } from "@/app/actions";
import { BtnContent } from "@/components/BtnContent";

const MIN = 8;

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const ok = value.length >= MIN;

  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Nueva contraseña</span>
        <span className="relative block">
          <input
            name="password"
            type={show ? "text" : "password"}
            minLength={MIN}
            autoComplete="new-password"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(state?.error)}
            aria-describedby="password-hint"
            className="input pr-12 text-[15px]"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={show}
            className="icon-btn absolute right-1.5 top-1/2 size-9 -translate-y-1/2 text-subtle hover:bg-white/10 hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      {/* Pista en vivo: pasa a "lista" cuando cumple el mínimo */}
      <p id="password-hint" className={`flex items-center gap-2 text-xs transition-colors duration-200 ${ok ? "text-ink" : "text-subtle"}`}>
        <span className={`grid size-4 place-items-center rounded-full transition-[background-color,transform] duration-200 ${ok ? "scale-100 bg-white text-black" : "scale-90 border border-white/25"}`} aria-hidden>
          {ok ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
        </span>
        Al menos {MIN} caracteres
      </p>
      {state?.error ? (
        <p role="alert" className="alert alert-error">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" aria-busy={pending} disabled={!ok && !pending}>
        <BtnContent>Guardar y entrar</BtnContent>
      </button>
    </form>
  );
}

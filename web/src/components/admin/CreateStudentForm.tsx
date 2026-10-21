"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Sparkles, UserPlus } from "lucide-react";
import { createStudent } from "@/app/admin-actions";
import { BtnContent } from "@/components/BtnContent";
import { CopyButton } from "./CopyButton";

const SET = "abcdefghjkmnpqrstuvwxyz";
const rnd = (n: number, set: string) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => set[v % set.length]).join("");
const newPassword = () => `${rnd(4, SET)}-${rnd(4, SET)}-${rnd(3, "23456789")}`;

export function CreateStudentForm() {
  const [state, action, pending] = useActionState(createStudent, undefined);
  const form = useRef<HTMLFormElement>(null);
  const pass = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(true);

  // Tras crear al alumno se limpia el formulario (las credenciales quedan visibles debajo para copiarlas).
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  const creds = state?.creds;
  const message = () => {
    const first = (creds?.name || "").split(" ")[0];
    return [`${first ? `Hola ${first}, ` : ""}este es tu acceso al Estudio de Licha:`, window.location.origin, `Correo: ${creds?.email}`, creds?.password ? `Contraseña: ${creds.password}` : ""].filter(Boolean).join("\n");
  };

  return (
    <section className="card p-5" aria-labelledby="nuevo-alumno">
      <h2 id="nuevo-alumno" className="display text-3xl">
        Nuevo <em>alumno</em>
      </h2>
      <p className="mt-1.5 text-sm text-muted">Crea su cuenta y dale acceso. No se envía ningún correo: tú le pasas los datos.</p>

      <form ref={form} action={action} className="mt-5 space-y-3.5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nombre</span>
          <input name="name" autoComplete="off" maxLength={80} placeholder="Camila Rojas" className="input h-11 text-[15px]" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Correo</span>
          <input name="email" type="email" required autoComplete="off" placeholder="alumno@correo.com" aria-invalid={Boolean(state?.error)} className="input h-11 text-[15px]" />
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            Contraseña temporal
            <button
              type="button"
              onClick={() => {
                if (pass.current) pass.current.value = newPassword();
                setShow(true);
              }}
              className="link-underline inline-flex items-center gap-1 text-xs font-normal text-muted hover:text-ink"
            >
              <Sparkles className="size-3" aria-hidden /> Generar
            </button>
          </span>
          <span className="relative block">
            <input ref={pass} name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="off" aria-invalid={Boolean(state?.error)} className="input h-11 pr-12 font-mono text-[15px]" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show} className="icon-btn absolute right-1.5 top-1/2 size-9 -translate-y-1/2 text-subtle hover:bg-white/10 hover:text-ink">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>

        {state?.error ? (
          <p role="alert" className="alert alert-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
          </p>
        ) : null}

        <button className="btn btn-primary w-full" aria-busy={pending}>
          <BtnContent>
            <UserPlus className="size-4" aria-hidden /> Crear alumno
          </BtnContent>
        </button>
      </form>

      {state?.ok ? (
        <div role="status" className="alert alert-ok mt-4 flex-col !items-stretch gap-3">
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.ok}
          </p>
          {creds?.password ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[13px] leading-relaxed">
              <p>Correo: {creds.email}</p>
              <p>Contraseña: {creds.password}</p>
            </div>
          ) : null}
          <CopyButton text={message} label="Copiar mensaje con el acceso" className="btn btn-primary btn-sm w-full" />
        </div>
      ) : null}
    </section>
  );
}

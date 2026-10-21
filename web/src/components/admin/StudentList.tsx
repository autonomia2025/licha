"use client";

import { useState, useTransition } from "react";
import { KeyRound, Search, UserX } from "lucide-react";
import { resetStudentPassword, setStudentActive } from "@/app/admin-actions";
import { BtnContent } from "@/components/BtnContent";
import { EmptyState } from "@/components/States";
import { toast } from "@/components/Toaster";
import { CopyButton } from "./CopyButton";

export interface StudentItem {
  email: string;
  name: string | null;
  active: boolean;
  hasAccount: boolean;
  completed: number;
  grantedLabel: string;
  signInAgo: string;
  signInAt: string;
  activityAgo: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function StudentList({ items }: { items: StudentItem[] }) {
  const [q, setQ] = useState("");
  const t = norm(q.trim());
  const shown = t ? items.filter((s) => norm(`${s.name ?? ""} ${s.email}`).includes(t)) : items;

  return (
    <section aria-labelledby="alumnos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="alumnos" className="display text-3xl">
          Todos los <em>alumnos</em>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar alumno" className="input h-10 rounded-full pl-9 text-sm" />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={UserX} title="Todavía no hay alumnos" className="mt-4">
          Crea el primero con el formulario “Nuevo alumno”.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={UserX} title={`Nadie coincide con “${q}”`} className="mt-4">
          Prueba con otra parte del nombre o del correo.
        </EmptyState>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {shown.map((s) => (
            <Row key={s.email} s={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ s }: { s: StudentItem }) {
  const [pending, start] = useTransition();
  const [resetting, startReset] = useTransition();
  const [newPass, setNewPass] = useState<string | null>(null);
  const initial = (s.name || s.email).charAt(0).toUpperCase();
  const status = !s.active ? { label: "Suspendido", cls: "border-red-400/30 text-red-300" } : !s.hasAccount ? { label: "Sin cuenta", cls: "border-white/20" } : { label: "Activo", cls: "border-white/25 text-ink" };

  const toggle = () =>
    start(async () => {
      const ok = await setStudentActive(s.email, !s.active).catch(() => false);
      if (ok) toast(s.active ? `Acceso de ${s.name || s.email} suspendido` : `Acceso de ${s.name || s.email} reactivado`);
      else toast.error("No pudimos cambiar el acceso. Inténtalo de nuevo.");
    });
  const reset = () =>
    startReset(async () => {
      const r: { password?: string; error?: string } = await resetStudentPassword(s.email).catch(() => ({ error: "No pudimos cambiar la contraseña." }));
      if (r.password) setNewPass(r.password);
      else toast.error(r.error ?? "No pudimos cambiar la contraseña.");
    });

  return (
    <li className="card animate-fade-up p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="serif grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-xl" aria-hidden>
          {initial}
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold tracking-[-0.01em]">{s.name || s.email}</span>
            <span className={`chip h-6 text-[11px] ${status.cls}`}>{status.label}</span>
          </p>
          {s.name ? <p className="truncate text-xs text-subtle">{s.email}</p> : null}
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
            <span title={s.signInAt}>
              Último ingreso: <span className="text-ink">{s.signInAgo}</span>
            </span>
            <span>
              Última actividad: <span className="text-ink">{s.activityAgo}</span>
            </span>
            <span>
              Clases completadas: <span className="tabular-nums text-ink">{s.completed}</span>
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {s.hasAccount ? (
            <button onClick={reset} aria-busy={resetting} className="btn btn-ghost btn-sm" title="Genera una contraseña nueva para este alumno">
              <BtnContent>
                <KeyRound className="size-3.5" aria-hidden /> Nueva clave
              </BtnContent>
            </button>
          ) : null}
          <button onClick={toggle} aria-busy={pending} className="btn btn-ghost btn-sm">
            <BtnContent>{s.active ? "Suspender" : "Reactivar"}</BtnContent>
          </button>
        </div>
      </div>

      {newPass ? (
        <div role="status" className="alert alert-ok mt-3 flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[13px]">
            Nueva contraseña: <span className="text-ink">{newPass}</span>
          </p>
          <CopyButton text={() => `Tu nueva contraseña para el Estudio de Licha es: ${newPass}`} label="Copiar mensaje" />
        </div>
      ) : null}
    </li>
  );
}

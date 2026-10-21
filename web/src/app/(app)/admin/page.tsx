import { notFound } from "next/navigation";
import { Activity, AlertCircle, Clock, MonitorSmartphone, UserCheck, UserPlus } from "lucide-react";
import { CreateStudentForm } from "@/components/admin/CreateStudentForm";
import { StudentList, type StudentItem } from "@/components/admin/StudentList";
import { EmptyState } from "@/components/States";
import { getAdminOverview, stats } from "@/lib/admin";
import { isAdmin } from "@/lib/data";
import { ago, stamp } from "@/lib/time";

export const metadata = { title: "Administración" };

export default async function AdminPage() {
  if (!(await isAdmin())) notFound(); // para cualquier otra persona esta página "no existe"
  const { now, configured, loginsTracked, students, logins } = await getAdminOverview();
  const s = stats(students);

  const items: StudentItem[] = students.map((r) => ({
    email: r.email,
    name: r.name,
    active: r.active,
    hasAccount: r.hasAccount,
    completed: r.completed,
    grantedLabel: ago(r.grantedAt, now),
    signInAgo: ago(r.lastSignIn, now),
    signInAt: stamp(r.lastSignIn),
    activityAgo: ago(r.lastActivity, now),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="animate-fade-up">
        <p className="eyebrow">Administración</p>
        <h1 className="display mt-4 text-5xl sm:text-6xl">
          Tus <em>alumnos</em>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">Crea cuentas, suspende accesos y mira quién entra y cuándo.</p>
      </header>

      {!configured ? (
        <p role="alert" className="alert alert-error mt-8">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Falta conectar el panel con la base de datos: agrega la variable <code className="font-mono">SUPABASE_SECRET_KEY</code> en Vercel (Settings → Environment Variables) y vuelve a publicar.
          </span>
        </p>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-3 animate-fade-up [animation-delay:40ms] lg:grid-cols-4" aria-label="Resumen">
            <Stat icon={<UserCheck className="size-5" />} label="Alumnos activos" value={s.active} />
            <Stat icon={<Clock className="size-5" />} label="Entraron hoy" value={s.today} />
            <Stat icon={<Activity className="size-5" />} label="Entraron esta semana" value={s.week} />
            <Stat icon={<UserPlus className="size-5" />} label="Aún no han entrado" value={s.never} />
          </section>

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <StudentList items={items} />

            <div className="space-y-6 lg:sticky lg:top-24">
              <CreateStudentForm />

              <section className="card p-5" aria-labelledby="ingresos">
                <h2 id="ingresos" className="display text-3xl">
                  Últimos <em>ingresos</em>
                </h2>
                {!loginsTracked ? (
                  <p className="mt-2 text-xs text-subtle">Mostrando solo el último ingreso de cada cuenta. Para ver el historial completo falta aplicar la migración de la base de datos (ver README).</p>
                ) : null}
                {logins.length === 0 ? (
                  <EmptyState icon={MonitorSmartphone} title="Todavía no hay ingresos" className="py-8">
                    Aparecerán aquí cuando alguien inicie sesión.
                  </EmptyState>
                ) : (
                  <ol className="scroll-thin mt-4 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
                    {logins.map((l, i) => (
                      <li key={`${l.email}-${l.at}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2">
                        <span className="serif grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-base" aria-hidden>
                          {(l.name || l.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name || l.email}</p>
                          <p className="truncate text-xs text-subtle">{l.device}</p>
                        </div>
                        <p className="shrink-0 text-right text-xs" title={stamp(l.at)}>
                          <span className="block text-ink">{ago(l.at, now)}</span>
                          <span className="block text-subtle">{stamp(l.at)}</span>
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white">{icon}</span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

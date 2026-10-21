import "server-only";
import { adminConfigured, createAdminClient } from "./supabase/admin";
import { isDemo } from "./supabase/server";

export interface StudentRow {
  email: string;
  name: string | null;
  active: boolean;
  grantedAt: string;
  hasAccount: boolean;
  lastSignIn: string | null;
  lastActivity: string | null;
  completed: number;
}
export interface LoginRow {
  email: string;
  name: string | null;
  at: string;
  device: string;
}
export interface AdminOverview {
  /** Hora del servidor al armar el panel (para "hace 5 min") */
  now: number;
  configured: boolean;
  loginsTracked: boolean;
  students: StudentRow[];
  logins: LoginRow[];
}

/** "iPhone · Chrome", "Windows · Edge"… a partir del user-agent (aproximado, solo para orientar). */
export function describeDevice(ua: string | null): string {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${os} · ${br}`;
}

const DAY = 86_400_000;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const demoOverview = (): AdminOverview => ({
  now: Date.now(),
  configured: true,
  loginsTracked: true,
  students: [
    { email: "camila@correo.com", name: "Camila Rojas", active: true, grantedAt: hoursAgo(24 * 20), hasAccount: true, lastSignIn: hoursAgo(1.5), lastActivity: hoursAgo(1.4), completed: 18 },
    { email: "diego@correo.com", name: "Diego Pérez", active: true, grantedAt: hoursAgo(24 * 12), hasAccount: true, lastSignIn: hoursAgo(30), lastActivity: hoursAgo(29), completed: 7 },
    { email: "fernanda@correo.com", name: "Fernanda Soto", active: true, grantedAt: hoursAgo(24 * 3), hasAccount: true, lastSignIn: null, lastActivity: null, completed: 0 },
    { email: "tomas@correo.com", name: "Tomás Vidal", active: false, grantedAt: hoursAgo(24 * 40), hasAccount: true, lastSignIn: hoursAgo(24 * 9), lastActivity: hoursAgo(24 * 9), completed: 31 },
  ],
  logins: [
    { email: "camila@correo.com", name: "Camila Rojas", at: hoursAgo(1.5), device: "iPhone · Safari" },
    { email: "diego@correo.com", name: "Diego Pérez", at: hoursAgo(30), device: "Windows · Chrome" },
    { email: "camila@correo.com", name: "Camila Rojas", at: hoursAgo(52), device: "Mac · Chrome" },
  ],
});

/** Todo lo que muestra el panel. Se llama solo después de comprobar que quien mira es admin. */
export async function getAdminOverview(): Promise<AdminOverview> {
  if (isDemo) return demoOverview();
  if (!adminConfigured()) return { now: Date.now(), configured: false, loginsTracked: false, students: [], logins: [] };
  const admin = createAdminClient();

  const [access, users] = await Promise.all([
    admin.from("student_access").select("email,full_name,active,created_at").order("created_at", { ascending: false }).limit(2000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (access.error) throw new Error(`No se pudo cargar la lista de alumnos: ${access.error.message}`);
  const byEmail = new Map((users.data?.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u]));

  // Última actividad y clases completadas por alumno (de lesson_progress), leyendo por páginas.
  const lastActivity = new Map<string, string>();
  const completed = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("lesson_progress").select("user_id,completed_at,updated_at").range(from, from + 999);
    if (error || !data) break;
    for (const r of data) {
      if (r.updated_at > (lastActivity.get(r.user_id) ?? "")) lastActivity.set(r.user_id, r.updated_at);
      if (r.completed_at) completed.set(r.user_id, (completed.get(r.user_id) ?? 0) + 1);
    }
    if (data.length < 1000) break;
  }

  const students: StudentRow[] = access.data.map((a) => {
    const u = byEmail.get(a.email);
    return {
      email: a.email,
      name: a.full_name ?? (u?.user_metadata?.full_name as string | undefined) ?? null,
      active: a.active,
      grantedAt: a.created_at,
      hasAccount: Boolean(u),
      lastSignIn: u?.last_sign_in_at ?? null,
      lastActivity: u ? lastActivity.get(u.id) ?? null : null,
      completed: u ? completed.get(u.id) ?? 0 : 0,
    };
  });

  // Historial de ingresos (si la migración aún no se aplicó, la tabla no existe: se muestra el último ingreso de cada cuenta).
  const ev = await admin.from("login_events").select("email,at,user_agent").order("at", { ascending: false }).limit(60);
  const nameOf = new Map(students.map((s) => [s.email, s.name]));
  const loginsTracked = !ev.error;
  const logins: LoginRow[] = loginsTracked
    ? (ev.data ?? []).map((e) => ({ email: e.email, name: nameOf.get(e.email) ?? null, at: e.at, device: describeDevice(e.user_agent) }))
    : students
        .filter((s) => s.lastSignIn)
        .sort((a, b) => b.lastSignIn!.localeCompare(a.lastSignIn!))
        .slice(0, 30)
        .map((s) => ({ email: s.email, name: s.name, at: s.lastSignIn!, device: "—" }));

  return { now: Date.now(), configured: true, loginsTracked, students, logins };
}

export const stats = (students: StudentRow[]) => {
  const now = Date.now();
  const within = (iso: string | null, ms: number) => Boolean(iso) && now - new Date(iso!).getTime() < ms;
  return {
    active: students.filter((s) => s.active).length,
    today: students.filter((s) => within(s.lastSignIn, DAY) || within(s.lastActivity, DAY)).length,
    week: students.filter((s) => within(s.lastSignIn, 7 * DAY) || within(s.lastActivity, 7 * DAY)).length,
    never: students.filter((s) => s.active && !s.lastSignIn).length,
  };
};

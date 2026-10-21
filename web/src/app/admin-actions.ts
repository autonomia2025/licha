"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { isAdmin, isDemo } from "@/lib/data";

export interface Credentials {
  name: string;
  email: string;
  password: string;
  existing?: boolean;
}
export type CreateState = { error?: string; ok?: string; creds?: Credentials } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin letras que se confunden (0/O, 1/l/I)

/** Contraseña temporal legible: 4 letras · 4 letras · 3 dígitos (se puede dictar por teléfono). */
const generatePassword = () => {
  const pick = (n: number, set: string) => Array.from({ length: n }, () => set[randomInt(set.length)]).join("");
  return `${pick(4, ALPHABET.slice(0, 22))}-${pick(4, ALPHABET.slice(0, 22))}-${pick(3, "23456789")}`;
};

/** Toda acción de este archivo pasa por aquí: comprueba en el servidor que quien llama es admin. */
async function requireAdmin(): Promise<string | null> {
  if (isDemo) return null;
  if (!(await isAdmin())) return "No tienes permiso para hacer esto.";
  if (!adminConfigured()) return "Falta configurar la clave secreta del servidor (SUPABASE_SECRET_KEY).";
  return null;
}

/** Crea la cuenta (correo + contraseña, sin enviar correos) y la agrega a la lista de alumnos. */
export async function createStudent(_: CreateState, form: FormData): Promise<CreateState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return { error: "Escribe un correo válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (isDemo) return { error: "En modo demo no se crean usuarios." };
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: name ? { full_name: name } : {} });
  let existing = false;
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) return { error: "No pudimos crear la cuenta. Revisa el correo e inténtalo de nuevo." };
    existing = true; // ya tenía cuenta: solo se le da acceso (su contraseña NO se cambia)
  }
  const { error: dbError } = await admin.from("student_access").upsert({ email, full_name: name || null, active: true }, { onConflict: "email" });
  if (dbError) return { error: "La cuenta se creó, pero no pudimos darle acceso al contenido. Intenta de nuevo." };

  revalidatePath("/admin");
  return existing
    ? { ok: `${email} ya tenía cuenta: ahora tiene acceso al contenido. Su contraseña no se modificó.`, creds: { name, email, password: "", existing: true } }
    : { ok: `Listo: ${name || email} ya puede ingresar.`, creds: { name, email, password } };
}

/** Suspende o reactiva el acceso de un alumno (no borra su cuenta ni su progreso). */
export async function setStudentActive(email: string, active: boolean): Promise<boolean> {
  if (isDemo) return true;
  if (await requireAdmin()) return false;
  const { error } = await createAdminClient().from("student_access").update({ active }).eq("email", email.trim().toLowerCase());
  if (error) return false;
  revalidatePath("/admin");
  return true;
}

/** Genera una contraseña nueva para un alumno (por si la olvidó) y la devuelve para copiarla. */
export async function resetStudentPassword(email: string): Promise<{ password?: string; error?: string }> {
  if (isDemo) return { error: "En modo demo no se cambian contraseñas." };
  const denied = await requireAdmin();
  if (denied) return { error: denied };
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === target);
  if (error || !user) return { error: "Ese alumno todavía no tiene cuenta." };
  const password = generatePassword();
  const { error: upd } = await admin.auth.admin.updateUserById(user.id, { password });
  return upd ? { error: "No pudimos cambiar la contraseña." } : { password };
}

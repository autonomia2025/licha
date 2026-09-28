"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, isDemo } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string } | undefined;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (isDemo) redirect(safeNext(form.get("volver")));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y contraseña." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : "No pudimos iniciar sesión. Inténtalo de nuevo." };
  redirect(safeNext(form.get("volver")));
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Ingresa tu correo." };
  if (isDemo) return { ok: "En modo demo no se envían correos." };
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirmar?siguiente=/restablecer` });
  // Misma respuesta exista o no la cuenta, para no revelar correos registrados.
  return { ok: "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (isDemo) redirect("/");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No pudimos actualizar la contraseña. Pide un enlace nuevo." };
  redirect("/");
}

export async function signOut() {
  if (!isDemo) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/ingresar");
}

/** Guarda por dónde va el alumno en el video (se llama cada ~15 s mientras reproduce). */
export async function saveProgress(lessonId: string, positionS: number) {
  if (isDemo) return;
  const supabase = await createClient();
  await supabase.from("lesson_progress").upsert(
    { lesson_id: lessonId, position_s: Math.max(0, Math.round(positionS)), updated_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" },
  );
}

export async function setCompleted(lessonId: string, completed: boolean, path: string) {
  if (!isDemo) {
    const supabase = await createClient();
    await supabase.from("lesson_progress").upsert(
      { lesson_id: lessonId, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" },
    );
  }
  revalidatePath(path);
}

/** Guarda una nota del alumno (opcionalmente en un segundo del video). En demo no se persiste. */
export async function addNote(lessonId: string, body: string, atS: number | null): Promise<import("@/lib/types").Note | null> {
  const text = body.trim().slice(0, 4000);
  if (!text) return null;
  const at = atS === null ? null : Math.max(0, Math.round(atS));
  if (isDemo) return { id: `demo-${Date.now()}`, atS: at, body: text, createdAt: new Date().toISOString() };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lesson_notes").insert({ lesson_id: lessonId, body: text, at_s: at }).select("id,at_s,body,created_at").single();
  if (error || !data) return null;
  return { id: data.id, atS: data.at_s, body: data.body, createdAt: data.created_at };
}

export async function deleteNote(id: string): Promise<boolean> {
  if (isDemo || id.startsWith("demo-")) return true;
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_notes").delete().eq("id", id);
  return !error;
}

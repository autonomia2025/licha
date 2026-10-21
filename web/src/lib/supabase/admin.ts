import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./server";

/** ¿Está configurada la clave secreta (SUPABASE_SECRET_KEY) en el servidor? */
export const adminConfigured = () => Boolean(SUPABASE_URL && process.env.SUPABASE_SECRET_KEY?.trim());

/**
 * Cliente con la clave secreta: se salta la RLS y puede administrar usuarios.
 * SOLO para código de servidor que ya comprobó que quien llama es admin (ver requireAdmin).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!SUPABASE_URL || !key) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

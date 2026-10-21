import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isDemo } from "@/lib/supabase/server";

/**
 * Lo llama Vercel Cron una vez al día (ver vercel.json). Hace una consulta mínima a Supabase para que el
 * plan gratis no pause el proyecto por inactividad (7 días sin uso). Vercel envía
 * `Authorization: Bearer $CRON_SECRET`; sin ese secreto la ruta responde 401.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (isDemo) return NextResponse.json({ ok: true, demo: true });

  const t0 = Date.now();
  try {
    // Consulta a la base de datos (con la clave pública y RLS no devuelve filas, pero sí la ejecuta).
    const res = await fetch(`${SUPABASE_URL}/rest/v1/courses?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const ms = Date.now() - t0;
    // Un fallo se responde con 502 para que Vercel lo muestre en rojo en el panel de Cron Jobs.
    return NextResponse.json({ ok: res.ok, status: res.status, ms }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.name : "error", ms: Date.now() - t0 }, { status: 502 });
  }
}

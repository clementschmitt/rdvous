import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Libération du verrou à la fermeture de l'onglet. Route distincte de
 * /api/booking/hold parce que `navigator.sendBeacon` ne sait émettre qu'un POST,
 * et que c'est le seul appel qui survit à la fermeture de la page.
 */
export async function POST(req: NextRequest) {
  const { cle_session } = await req.json().catch(() => ({ cle_session: null }));
  if (!cle_session) return NextResponse.json({ ok: true });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.from("creneaux_bloques").delete().eq("cle_session", cle_session);
  return NextResponse.json({ ok: true });
}

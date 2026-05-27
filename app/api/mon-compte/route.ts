import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, cagnotte")
    .eq("email", user.email)
    .limit(1);

  if (!clientRows || clientRows.length === 0) return NextResponse.json({ rdvs: [], cagnotte: 0 });

  const clientId = clientRows[0].id;
  const cagnotte = clientRows.reduce((s: number, c: { cagnotte?: number }) => s + (c.cagnotte || 0), 0);

  const { data: rdvs } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut, salon_id, salons(nom, slug), rendez_vous_prestations(prestations(nom))")
    .eq("client_id", clientId)
    .order("date_heure", { ascending: false })
    .limit(20);

  return NextResponse.json({ rdvs: rdvs || [], cagnotte });
}

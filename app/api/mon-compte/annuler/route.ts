import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { rdv_id } = await req.json();
  if (!rdv_id) return NextResponse.json({ error: "rdv_id manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Vérifie que ce RDV appartient bien à ce client (email = email du compte)
  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("id, statut, date_heure, clients(email)")
    .eq("id", rdv_id)
    .single();

  if (!rdv) return NextResponse.json({ error: "RDV introuvable" }, { status: 404 });
  const clientEmail = (rdv.clients as { email: string } | null)?.email;
  if (clientEmail !== user.email) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  if (new Date(rdv.date_heure) < new Date()) return NextResponse.json({ error: "Ce rendez-vous est déjà passé." }, { status: 400 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "Déjà annulé." }, { status: 400 });

  await admin.from("rendez_vous").update({ statut: "annule" }).eq("id", rdv_id);

  return NextResponse.json({ ok: true });
}

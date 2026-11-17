import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { annulerRendezVous, AnnulationError } from "@/lib/annulation";

// Annulation par le lien du mail de confirmation (cancel_token).
export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut")
    .eq("cancel_token", token)
    .single();

  if (!rdv) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "Ce rendez-vous est déjà annulé." }, { status: 400 });

  const diffH = (new Date(rdv.date_heure).getTime() - Date.now()) / 3600000;
  if (diffH < 2) return NextResponse.json({ error: "Impossible d'annuler moins de 2h avant le rendez-vous." }, { status: 400 });

  try {
    const { salonNom, dateStr, heureStr } = await annulerRendezVous(admin, rdv.id, "lien");
    return NextResponse.json({ ok: true, salon_nom: salonNom, dateStr, heureStr });
  } catch (e) {
    if (e instanceof AnnulationError) {
      const status = e.code === "ECRITURE" ? 500 : e.code === "INTROUVABLE" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("Annulation par lien : erreur inattendue", e);
    return NextResponse.json({ error: "Erreur lors de l'annulation." }, { status: 500 });
  }
}

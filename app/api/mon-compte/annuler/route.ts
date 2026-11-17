import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { annulerRendezVous, AnnulationError } from "@/lib/annulation";

// Annulation depuis l'espace client /mon-compte : prévient désormais la professionnelle et sa liste
// d'attente, comme l'annulation par lien (avant le 17/11/2026, elle ne prévenait personne).
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
  const clientEmail = (rdv.clients as unknown as { email: string } | null)?.email;
  if (clientEmail !== user.email) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  if (new Date(rdv.date_heure) < new Date()) return NextResponse.json({ error: "Ce rendez-vous est déjà passé." }, { status: 400 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "Déjà annulé." }, { status: 400 });

  try {
    await annulerRendezVous(admin, rdv.id, "compte");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AnnulationError) {
      const status = e.code === "ECRITURE" ? 500 : e.code === "INTROUVABLE" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("Annulation depuis /mon-compte : erreur inattendue", e);
    return NextResponse.json({ error: "Erreur lors de l'annulation." }, { status: 500 });
  }
}

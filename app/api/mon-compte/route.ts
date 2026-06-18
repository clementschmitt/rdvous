import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Une cliente peut avoir une fiche par salon (même email). La cagnotte est PROPRE à chaque salon.
  const { data: clientRows } = await admin
    .from("clients")
    .select("id, cagnotte, salon_id, salons(nom, metier)")
    .eq("email", user.email);

  if (!clientRows || clientRows.length === 0) return NextResponse.json({ rdvs: [], cagnottes: [] });

  const clientIds = clientRows.map((c: { id: string }) => c.id);
  const cagnottes = (clientRows as unknown as { cagnotte?: number; salon_id: string; salons: { nom: string; metier: string } | null }[])
    .filter(c => (c.cagnotte || 0) > 0)
    .map(c => ({ salon_id: c.salon_id, salon_nom: c.salons?.nom || "Salon", metier: c.salons?.metier || "", montant: c.cagnotte || 0 }))
    .sort((a, b) => b.montant - a.montant);

  const { data: rdvs } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut, salon_id, salons(nom, slug, metier), rendez_vous_prestations(prestations(nom))")
    .in("client_id", clientIds)
    .order("date_heure", { ascending: false })
    .limit(20);

  return NextResponse.json({ rdvs: rdvs || [], cagnottes });
}

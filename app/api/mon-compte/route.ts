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
    .select("id, cagnotte, salon_id, salons(nom, metier)")
    .eq("email", user.email);

  if (!clientRows || clientRows.length === 0)
    return NextResponse.json({ rdvs: [], cagnottes: [], favoris: [], salonsRevus: [] });

  const clientIds = clientRows.map((c: { id: string }) => c.id);
  const cagnottes = (clientRows as unknown as { cagnotte?: number; salon_id: string; salons: { nom: string; metier: string } | null }[])
    .filter(c => (c.cagnotte || 0) > 0)
    .map(c => ({ salon_id: c.salon_id, salon_nom: c.salons?.nom || "Salon", metier: c.salons?.metier || "", montant: c.cagnotte || 0 }))
    .sort((a, b) => b.montant - a.montant);

  const [rdvsRes, favorisRes] = await Promise.all([
    admin
      .from("rendez_vous")
      .select("id, date_heure, statut, salon_id, tarif, photo_reference_url, salons(nom, slug, metier), rendez_vous_prestations(prestations(nom, tarif, sur_devis))")
      .in("client_id", clientIds)
      .order("date_heure", { ascending: false })
      .limit(30),
    admin
      .from("client_favoris")
      .select("salon_id, salons(nom, slug, metier)")
      .eq("user_id", user.id),
  ]);

  const rdvIds = (rdvsRes.data || []).map((r: { id: string }) => r.id);
  let salonsRevus: string[] = [];
  if (rdvIds.length > 0) {
    const { data: avisData } = await admin
      .from("avis")
      .select("salon_id")
      .in("rdv_id", rdvIds)
      .not("note", "is", null);
    salonsRevus = [...new Set((avisData || []).map((a: { salon_id: string }) => a.salon_id))];
  }

  return NextResponse.json({
    rdvs: rdvsRes.data || [],
    cagnottes,
    favoris: favorisRes.data || [],
    salonsRevus,
  });
}

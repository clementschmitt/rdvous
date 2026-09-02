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
    .select("id, prenom, cagnotte, nb_visites, salon_id, salons(nom, metier, plan)")
    .eq("email", user.email);

  if (!clientRows || clientRows.length === 0)
    return NextResponse.json({ rdvs: [], cagnottes: [], favoris: [], salonsRevus: [] });

  const clientIds = clientRows.map((c: { id: string }) => c.id);

  type ClientRow = { id: string; prenom: string | null; cagnotte: number; nb_visites: number; salon_id: string; salons: { nom: string; metier: string; plan: string } | null };
  const rows = clientRows as unknown as ClientRow[];

  // Fetch app_settings for each salon (fidelite params)
  const salonIds = rows.map(c => c.salon_id);
  const { data: settingsRows } = await admin
    .from("app_settings")
    .select("salon_id, nb_visites_fidelite, montant_recompense")
    .in("salon_id", salonIds);

  const settingsMap: Record<string, { nb_visites_fidelite: number; montant_recompense: number }> = {};
  for (const s of settingsRows || []) settingsMap[s.salon_id] = s;

  const cagnottes = rows
    .filter(c => {
      const plan = c.salons?.plan || "free";
      const settings = settingsMap[c.salon_id];
      return plan !== "free" && settings && settings.nb_visites_fidelite > 0 && (c.nb_visites || 0) > 0;
    })
    .map(c => {
      const settings = settingsMap[c.salon_id] || { nb_visites_fidelite: 10, montant_recompense: 10 };
      return {
        salon_id: c.salon_id,
        salon_nom: c.salons?.nom || "Salon",
        metier: c.salons?.metier || "",
        montant: c.cagnotte || 0,
        nb_visites: c.nb_visites || 0,
        nb_visites_fidelite: settings.nb_visites_fidelite,
        montant_recompense: settings.montant_recompense,
      };
    })
    .sort((a, b) => b.montant - a.montant);

  const [rdvsRes, favorisRes] = await Promise.all([
    admin
      .from("rendez_vous")
      .select("id, date_heure, statut, salon_id, tarif, duree_minutes, photo_reference_url, salons(nom, slug, metier, adresse, ville, photos), rendez_vous_prestations(prestations(nom, tarif, sur_devis, duree_minutes))")
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

  const prenom = rows.find(r => r.prenom)?.prenom || null;

  return NextResponse.json({
    rdvs: rdvsRes.data || [],
    cagnottes,
    favoris: favorisRes.data || [],
    salonsRevus,
    prenom,
  });
}

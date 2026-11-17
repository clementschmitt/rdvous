import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Coordonnées habituelles de la cliente connectée, pour pré-remplir le formulaire de réservation.
// On prend la fiche qu'elle a chez ce salon si elle existe, sinon sa fiche la plus récente ailleurs.
// Seules ses propres fiches sont lues : l'email vient du jeton vérifié, jamais de la requête.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const salonId = req.nextUrl.searchParams.get("salon_id");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: fiches, error } = await admin
    .from("clients")
    .select("salon_id, prenom, nom, telephone, created_at")
    .eq("email", user.email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Profil : lecture des fiches échouée", error);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  const fiche = (fiches || []).find(f => f.salon_id === salonId) || (fiches || [])[0];
  return NextResponse.json({
    prenom: fiche?.prenom || null,
    nom: fiche?.nom || null,
    telephone: fiche?.telephone || null,
  });
}

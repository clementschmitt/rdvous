import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lecture d'un avis par son jeton, pour la page publique /avis/[token].
// Passe en service_role : la table `avis` est protégée par une politique RLS qui
// s'appuie sur salon_users, table sur laquelle anon n'a aucun droit. Une lecture
// directe depuis le navigateur échouait donc en "permission denied", et la page
// affichait "lien invalide ou expiré" alors que l'avis existait bel et bien.
//
// Le jeton fait office de secret : on ne renvoie que le nom du salon et le fait
// qu'une note ait déjà été déposée.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Jeton manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data } = await admin
    .from("avis")
    .select("note, salons(nom)")
    .eq("token", token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });

  const salon = data.salons as unknown as { nom: string } | null;
  return NextResponse.json({
    salon_nom: salon?.nom || null,
    deja_note: data.note !== null,
  });
}

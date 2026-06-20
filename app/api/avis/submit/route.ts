import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { token, note, commentaire } = await req.json();
  if (!token || !note || note < 1 || note > 5) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: avis } = await admin.from("avis").select("id, note").eq("token", token).single();
  if (!avis) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  if (avis.note !== null) return NextResponse.json({ error: "Avis déjà soumis." }, { status: 400 });

  const { error } = await admin.from("avis").update({
    note,
    commentaire: commentaire?.trim() || null,
    statut: "visible",
  }).eq("token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

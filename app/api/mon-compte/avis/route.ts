import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { rdv_id, salon_id, note, commentaire } = await req.json();

  if (!rdv_id || !salon_id || !note || note < 1 || note > 5)
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const { data: clientRows } = await admin.from("clients").select("id").eq("email", user.email);
  if (!clientRows?.length) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  const clientIds = clientRows.map((c: { id: string }) => c.id);

  const { data: rdv } = await admin.from("rendez_vous")
    .select("id, statut").eq("id", rdv_id).in("client_id", clientIds).single();
  if (!rdv) return NextResponse.json({ error: "RDV introuvable" }, { status: 404 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "RDV annulé" }, { status: 400 });

  const { data: existing } = await admin.from("avis").select("id, note").eq("rdv_id", rdv_id).maybeSingle();
  if (existing?.note != null) return NextResponse.json({ error: "Avis déjà déposé" }, { status: 400 });

  if (existing) {
    await admin.from("avis").update({ note, commentaire: commentaire?.trim() || null, statut: "visible" }).eq("id", existing.id);
  } else {
    await admin.from("avis").insert({ rdv_id, salon_id, note, commentaire: commentaire?.trim() || null, statut: "visible", token: randomUUID() });
  }

  return NextResponse.json({ ok: true });
}

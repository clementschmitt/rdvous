import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { salon_id, action } = body;
  if (!salon_id) return NextResponse.json({ error: "salon_id manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (action === "save_dispos") {
    const { rows } = body as { rows: { jour_semaine: number; heure_debut: string; heure_fin: string }[] };
    await admin.from("disponibilites").delete().eq("salon_id", salon_id);
    if (rows && rows.length > 0) {
      const { error } = await admin.from("disponibilites").insert(rows.map(r => ({ ...r, salon_id })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "add_conge") {
    const { date_debut, date_fin, libelle } = body;
    const { error } = await admin.from("conges").insert({ salon_id, date_debut, date_fin, libelle: libelle || "" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_conge") {
    const { id } = body;
    const { error } = await admin.from("conges").delete().eq("id", id).eq("salon_id", salon_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

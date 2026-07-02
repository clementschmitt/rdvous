import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error: authError } = await anon.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { salon_id, ...settingsData } = body;
  if (!salon_id) return NextResponse.json({ error: "salon_id manquant" }, { status: 400 });

  // Champs DATE : une chaîne vide fait échouer Postgres ("invalid input syntax for type date")
  if (settingsData.date_limite_planning === "") settingsData.date_limite_planning = null;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: salonUser } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!salonUser) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await admin.from("app_settings").upsert({ ...settingsData, salon_id }, { onConflict: "salon_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

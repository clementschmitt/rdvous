import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { salon_id, action } = await req.json();
  if (!salon_id) return NextResponse.json({ error: "salon_id manquant" }, { status: 400 });

  if (action === "remove") {
    await admin.from("client_favoris").delete().eq("user_id", user.id).eq("salon_id", salon_id);
  } else {
    await admin.from("client_favoris").upsert({ user_id: user.id, salon_id }, { onConflict: "user_id,salon_id" });
  }

  return NextResponse.json({ ok: true });
}

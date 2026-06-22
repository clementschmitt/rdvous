import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const rdv_id = formData.get("rdv_id") as string | null;
  if (!file || !rdv_id) return NextResponse.json({ error: "Données manquantes" }, { status: 400 });

  const { data: clientRows } = await admin.from("clients").select("id").eq("email", user.email);
  if (!clientRows?.length) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  const clientIds = clientRows.map((c: { id: string }) => c.id);

  const { data: rdv } = await admin.from("rendez_vous").select("id").eq("id", rdv_id).in("client_id", clientIds).single();
  if (!rdv) return NextResponse.json({ error: "RDV introuvable" }, { status: 404 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${rdv_id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from("rdv-photos").upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("rdv-photos").getPublicUrl(path);
  await admin.from("rendez_vous").update({ photo_reference_url: publicUrl }).eq("id", rdv_id);

  return NextResponse.json({ ok: true, url: publicUrl });
}

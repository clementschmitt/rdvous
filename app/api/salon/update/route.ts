import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

function slugify(str: string) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const body = await req.json();
  const { salon_id, slug: rawSlug, photos, deplacement, visible_recherche } = body;

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  if (rawSlug !== undefined) {
    const newSlug = slugify(rawSlug);
    if (!newSlug) return NextResponse.json({ error: "Slug invalide" }, { status: 400 });
    const { count } = await admin.from("salons").select("id", { count: "exact", head: true }).eq("slug", newSlug).neq("id", salon_id);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "Cette URL est déjà prise" }, { status: 409 });
    updates.slug = newSlug;
  }

  if (photos !== undefined) updates.photos = photos;
  if (deplacement !== undefined) updates.deplacement = deplacement;
  if (visible_recherche !== undefined) updates.visible_recherche = visible_recherche;

  const { error } = await admin.from("salons").update(updates).eq("id", salon_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug: updates.slug });
}

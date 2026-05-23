import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function slugify(str: string) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { nom, metier, telephone, adresse, ville } = await req.json();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let slug = slugify(nom);
  const { count } = await admin.from("salons").select("id", { count: "exact", head: true }).eq("slug", slug);
  if ((count ?? 0) > 0) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: salon, error } = await admin
    .from("salons")
    .insert({ nom, slug, metier, telephone, adresse, ville, email: user.email })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("salon_users").insert({ user_id: user.id, salon_id: salon.id, role: "owner" });
  await admin.from("app_settings").insert({ salon_id: salon.id });

  return NextResponse.json({ ok: true });
}

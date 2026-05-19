import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { nom, metier } = await req.json();
  if (!nom || !metier) return NextResponse.json({ error: "nom et metier requis" }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const slug = `${slugify(nom)}-${Date.now()}`;

  const { data: salon, error: salonErr } = await admin
    .from("salons")
    .insert({ nom, slug, metier, email: user.email })
    .select()
    .single();

  if (salonErr) return NextResponse.json({ error: salonErr.message }, { status: 500 });

  await admin.from("salon_users").insert({ user_id: user.id, salon_id: salon.id, role: "owner" });
  await admin.from("app_settings").insert({ salon_id: salon.id });

  return NextResponse.json({ ok: true, salon_id: salon.id });
}

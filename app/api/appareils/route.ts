import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Enregistrement du jeton de notification d'un appareil.
 * Route serveur en service_role : la table est fermée en écriture au navigateur,
 * on ne veut pas qu'un client puisse rattacher un jeton au compte d'un autre.
 */
async function utilisateur(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  return user;
}

export async function POST(req: NextRequest) {
  const user = await utilisateur(req);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { token, plateforme } = await req.json();
  if (!token || !["android", "ios", "web"].includes(plateforme)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Conflit sur le jeton : un appareil qui change de compte doit basculer,
  // pas créer une seconde ligne qui enverrait la notification à l'ancienne.
  const { error } = await admin.from("appareils").upsert(
    { user_id: user.id, email: user.email, token, plateforme, derniere_maj: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Déconnexion ou refus des notifications : on retire le jeton. */
export async function DELETE(req: NextRequest) {
  const user = await utilisateur(req);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { token } = await req.json().catch(() => ({ token: null }));
  if (!token) return NextResponse.json({ ok: true });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.from("appareils").delete().eq("token", token).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

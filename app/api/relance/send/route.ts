import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateRelance } from "@/lib/email";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { client_id, salon_id } = await req.json();
  if (!client_id || !salon_id) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: client } = await admin.from("clients").select("prenom, nom, email").eq("id", client_id).eq("salon_id", salon_id).single();
  if (!client?.email) return NextResponse.json({ error: "Ce client n'a pas d'adresse email." }, { status: 400 });

  const [settingsRes, salonRes] = await Promise.all([
    admin.from("app_settings").select("email_relance_objet, message_relance, email_expediteur, email_expediteur_nom").eq("salon_id", salon_id).single(),
    admin.from("salons").select("nom").eq("id", salon_id).single(),
  ]);

  const settings = settingsRes.data;
  const salonNom = salonRes.data?.nom || "rdvous";

  try {
    await sendEmail({
      to: client.email,
      toName: client.prenom,
      subject: settings?.email_relance_objet || `${salonNom} : on vous a manqué ?`,
      html: templateRelance({ prenom: client.prenom, salonNom, contenu: settings?.message_relance || undefined }),
      fromName: settings?.email_expediteur_nom || salonNom,
      replyTo: settings?.email_expediteur || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Relance email failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

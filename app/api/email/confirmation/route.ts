import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { rdv_id } = await req.json();
  if (!rdv_id) return NextResponse.json({ error: "rdv_id requis" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("date_heure, salon_id, clients(prenom, email), rendez_vous_prestations(prestations(nom, duree_minutes, tarif)), salons(nom)")
    .eq("id", rdv_id)
    .single();

  if (!rdv) return NextResponse.json({ ok: false });

  const { data: settings } = await admin.from("app_settings").select("email_confirmation_active, email_confirmation_objet, message_confirmation, email_expediteur, email_expediteur_nom").eq("salon_id", rdv.salon_id).single();
  if (settings?.email_confirmation_active === false) return NextResponse.json({ ok: false, reason: "disabled" });

  const client = rdv.clients as unknown as { prenom: string; email: string | null } | null;
  if (!client?.email) return NextResponse.json({ ok: false, reason: "no email" });

  const salon = rdv.salons as unknown as { nom: string } | null;
  const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string; duree_minutes: number; tarif: number } | null }[])
    .map(rp => rp.prestations)
    .filter(Boolean) as { nom: string; duree_minutes: number; tarif: number }[];

  const dateStr = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heureStr = rdv.date_heure.slice(11, 16);

  try {
    await sendEmail({
      to: client.email,
      toName: client.prenom,
      subject: settings?.email_confirmation_objet || `Confirmation de votre rendez-vous, ${salon?.nom || "rdvous"}`,
      html: templateConfirmation({ prenom: client.prenom, salonNom: salon?.nom || "", dateStr, heureStr, prestations, contenu: settings?.message_confirmation || undefined }),
      fromName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
      replyTo: settings?.email_expediteur || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Confirmation email failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

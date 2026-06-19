import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { bookingLimiter, getIP } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const { success } = await bookingLimiter.limit(getIP(req));
    if (!success) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une heure." }, { status: 429 });
  }

  const { salon_id, prenom, nom, email, telephone, prestation_ids, date, heure_debut, heure_fin, website } = await req.json();

  // Honeypot anti-bot
  if (website) return NextResponse.json({ ok: true });

  const ids: string[] = Array.isArray(prestation_ids) ? prestation_ids : prestation_ids ? [prestation_ids] : [];
  if (!salon_id || !prenom || !nom || !email || !telephone || !date) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }
  const telClean = telephone.replace(/[\s.\-]/g, "");
  if (!/^(\+33|0033)[1-9]\d{8}$|^0[1-9]\d{8}$/.test(telClean)) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Éviter les doublons : même email, même date, déjà en attente
  const { data: existing } = await admin
    .from("liste_attente")
    .select("id")
    .eq("salon_id", salon_id)
    .eq("email", email)
    .eq("date_souhaitee", date)
    .eq("statut", "en_attente")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await admin.from("liste_attente").insert({
    salon_id, prenom, nom, email, telephone, prestation_ids: ids, date_souhaitee: date,
    heure_debut: heure_debut || null, heure_fin: heure_fin || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email de confirmation d'inscription à la cliente
  try {
    const { data: salon } = await admin.from("salons").select("nom").eq("id", salon_id).single();
    const { data: settings } = await admin.from("app_settings").select("email_expediteur, email_expediteur_nom").eq("salon_id", salon_id).single();
    const dateStr = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

    await sendEmail({
      to: email,
      toName: prenom,
      subject: `Vous êtes sur la liste d'attente — ${salon?.nom || "rdvous"}`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
        <p style="font-size:15px">Bonjour ${prenom},</p>
        <p style="font-size:14px;line-height:1.6">Vous êtes bien inscrit·e sur la liste d'attente de <strong>${salon?.nom || ""}</strong> pour le <strong>${dateStr}</strong>.</p>
        <p style="font-size:14px;line-height:1.6">Si une place se libère ce jour-là, le salon vous contactera directement pour convenir d'un créneau.</p>
        <p style="font-size:13px;color:#888;margin-top:24px">À bientôt !</p>
      </div>`,
      fromName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
      replyTo: settings?.email_expediteur || undefined,
    });
  } catch (e) {
    console.error("Waitlist confirmation email failed:", e);
  }

  return NextResponse.json({ ok: true });
}

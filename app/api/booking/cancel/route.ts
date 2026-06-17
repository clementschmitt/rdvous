import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut, salon_id, salons(nom), clients(prenom, nom), rendez_vous_prestations(prestations(nom))")
    .eq("cancel_token", token)
    .single();

  if (!rdv) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "Ce rendez-vous est déjà annulé." }, { status: 400 });

  const rdvDate = new Date(rdv.date_heure);
  const diffH = (rdvDate.getTime() - Date.now()) / 3600000;
  if (diffH < 2) return NextResponse.json({ error: "Impossible d'annuler moins de 2h avant le rendez-vous." }, { status: 400 });

  await admin.from("rendez_vous").update({ statut: "annule" }).eq("id", rdv.id);

  const salon = rdv.salons as unknown as { nom: string } | null;
  const client = rdv.clients as unknown as { prenom: string; nom: string } | null;
  const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string } | null }[]).map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
  const dateStr = rdvDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heureStr = rdv.date_heure.slice(11, 16);

  const { data: settings } = await admin.from("app_settings").select("email_expediteur, email_reception, email_expediteur_nom, sms_active, sms_expediteur").eq("salon_id", rdv.salon_id).single();
  let artisanEmail = settings?.email_reception?.trim() || settings?.email_expediteur?.trim() || null;
  if (!artisanEmail) {
    const { data: su } = await admin.from("salon_users").select("user_id").eq("salon_id", rdv.salon_id).limit(1).single();
    if (su?.user_id) {
      const { data: { user } } = await admin.auth.admin.getUserById(su.user_id);
      artisanEmail = user?.email || null;
    }
  }

  if (artisanEmail) {
    try {
      await sendEmail({
        to: artisanEmail,
        toName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
        subject: `Annulation — ${client?.prenom || ""} ${client?.nom || ""} · ${dateStr} à ${heureStr}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
          <div style="background:#fef2f2;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #ef4444">
            <div style="font-size:16px;font-weight:700;color:#dc2626">Rendez-vous annulé</div>
            <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr} à ${heureStr}</div>
          </div>
          <p style="font-size:14px"><strong>Client :</strong> ${client?.prenom || ""} ${client?.nom || ""}</p>
          ${prestations ? `<p style="font-size:14px"><strong>Prestations :</strong> ${prestations}</p>` : ""}
        </div>`,
        fromName: "rdvous",
      });
    } catch (e) {
      console.error("Cancel notification email failed:", e);
    }
  }

  // ── Notification de la liste d'attente ──
  // Une place vient de se libérer ce jour-là : on prévient les personnes en attente.
  try {
    const dateRdv = rdv.date_heure.slice(0, 10);
    const { data: waiting } = await admin
      .from("liste_attente")
      .select("id, prenom, email, telephone")
      .eq("salon_id", rdv.salon_id)
      .eq("date_souhaitee", dateRdv)
      .eq("statut", "en_attente");

    if (waiting && waiting.length > 0) {
      const { data: salonInfo } = await admin.from("salons").select("slug").eq("id", rdv.salon_id).single();
      const origin = new URL(req.url).origin;
      const bookingUrl = salonInfo?.slug ? `${origin}/${salonInfo.slug}` : `${origin}/s/${rdv.salon_id}`;
      const salonNom = salon?.nom || "votre salon";

      for (const w of waiting) {
        // Email
        if (w.email) {
          try {
            await sendEmail({
              to: w.email,
              toName: w.prenom,
              subject: `Une place s'est libérée — ${salonNom} le ${dateStr}`,
              html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
                <div style="background:#ecfdf5;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #10b981">
                  <div style="font-size:16px;font-weight:700;color:#059669">Une place s'est libérée !</div>
                  <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr}</div>
                </div>
                <p style="font-size:14px;line-height:1.6">Bonjour ${w.prenom}, une place vient de se libérer chez <strong>${salonNom}</strong> le ${dateStr}. Réservez vite, le premier qui réserve obtient le créneau.</p>
                <p style="text-align:center;margin:28px 0"><a href="${bookingUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700">Réserver maintenant</a></p>
              </div>`,
              fromName: settings?.email_expediteur_nom || salonNom,
              replyTo: settings?.email_expediteur || undefined,
            });
          } catch (e) { console.error("Waitlist email failed:", e); }
        }
        // SMS (si activé et crédits disponibles)
        if (settings?.sms_active && w.telephone) {
          try {
            const { data: canSend } = await admin.rpc("decrement_sms_credits", { p_salon_id: rdv.salon_id });
            if (canSend) {
              await sendSMS({
                to: w.telephone,
                content: `Bonjour ${w.prenom}, une place s'est liberee chez ${salonNom} le ${dateStr}. Reservez vite : ${bookingUrl}`,
                sender: settings?.sms_expediteur || salonNom,
              });
            }
          } catch (e) { console.error("Waitlist SMS failed:", e); }
        }
      }

      // Marquer ces personnes comme notifiées
      await admin
        .from("liste_attente")
        .update({ statut: "notifie", notifie_le: new Date().toISOString() })
        .in("id", waiting.map(w => w.id));
    }
  } catch (e) {
    console.error("Waitlist notification block failed:", e);
  }

  return NextResponse.json({ ok: true, salon_nom: salon?.nom, dateStr, heureStr });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateRappel } from "@/lib/email";
import { sendSMS, smsRappel, analyserSms } from "@/lib/sms";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const now = new Date();
  const demain = new Date(now);
  demain.setDate(demain.getDate() + 1);
  const d = demain;
  const demainStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const aujourdhuiStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: salonSettings } = await admin.from("app_settings").select("salon_id, email_rappel_active, email_rappel_objet, message_rappel_rdv, email_expediteur, email_expediteur_nom, sms_active, sms_rappel_active, sms_expediteur, sms_message_rappel");
  const { data: rdvs } = await admin
    .from("rendez_vous")
    .select("id, date_heure, salon_id, created_at, salons(nom), clients(prenom, email, telephone), rendez_vous_prestations(prestations(nom, tarif, sur_devis))")
    .eq("statut", "planifie")
    .gte("date_heure", `${demainStr}T00:00:00`)
    .lte("date_heure", `${demainStr}T23:59:59`);

  let sent = 0;
  let emailsEnvoyes = 0;
  let smsEnvoyes = 0;
  let echecs = 0;
  // Passe à true dès qu'un envoi SMS échoue : c'est presque toujours un solde
  // Brevo épuisé, et réessayer consommerait un crédit du salon à chaque RDV
  // suivant pour rien.
  let smsIndisponible = false;

  for (const rdv of rdvs || []) {
    const salonCfg = (salonSettings || []).find(s => s.salon_id === rdv.salon_id);
    const client = rdv.clients as unknown as { prenom: string; email: string | null; telephone: string | null } | null;
    if (!client?.email && !client?.telephone) continue;
    const emailEnabled = salonCfg?.email_rappel_active !== false;
    const smsEnabled = salonCfg?.sms_active === true && salonCfg?.sms_rappel_active !== false;
    if (!emailEnabled && !smsEnabled) continue;

    const salon = rdv.salons as unknown as { nom: string } | null;
    const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string; tarif: number; sur_devis: boolean } | null }[])
      .map(rp => rp.prestations)
      .filter(Boolean) as { nom: string; tarif: number; sur_devis: boolean }[];

    const dateStr = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const heureStr = rdv.date_heure.slice(11, 16);

    // Un échec sur un rendez-vous ne doit jamais empêcher les suivants d'être traités.
    if (emailEnabled && client.email) {
      try {
        await sendEmail({
          to: client.email,
          toName: client.prenom,
          subject: salonCfg?.email_rappel_objet || `Rappel : votre rendez-vous demain — ${salon?.nom || "rdvous"}`,
          html: templateRappel({ prenom: client.prenom, salonNom: salon?.nom || "", dateStr, heureStr, prestations, contenu: salonCfg?.message_rappel_rdv || undefined }),
          fromName: salonCfg?.email_expediteur_nom || salon?.nom || "rdvous",
          replyTo: salonCfg?.email_expediteur || undefined,
        });
        emailsEnvoyes++;
      } catch (e) {
        console.error("Email de rappel échoué pour le RDV", rdv.id, e);
        echecs++;
      }
    }

    // RDV créé aujourd'hui = confirmation déjà envoyée le jour même → pas de rappel SMS (doublon + crédit gaspillé).
    const creeAujourdhui = typeof rdv.created_at === "string" && rdv.created_at.slice(0, 10) === aujourdhuiStr;
    if (smsEnabled && client.telephone && !creeAujourdhui && !smsIndisponible) {
      // Le contenu est construit avant le décompte : on débite autant de crédits
      // que le message consomme réellement de segments chez l'opérateur.
      const texteSms = smsRappel({ prenom: client.prenom, salonNom: salon?.nom || "", dateStr, heureStr, contenu: salonCfg?.sms_message_rappel });
      const { segments } = analyserSms(texteSms);

      // Le solde est vérifié sans être consommé, puis débité seulement après un
      // envoi réussi. Décompter avant l'envoi faisait perdre des crédits au salon
      // à chaque refus de l'opérateur, typiquement quand notre propre solde est à sec.
      const { data: solde } = await admin
        .from("salons")
        .select("sms_credits, sms_credits_achetes")
        .eq("id", rdv.salon_id)
        .single();
      const disponible = (solde?.sms_credits ?? 0) + (solde?.sms_credits_achetes ?? 0);

      if (disponible >= segments) {
        try {
          await sendSMS({
            to: client.telephone,
            content: texteSms,
            sender: salonCfg?.sms_expediteur || salon?.nom || undefined,
          });
          await admin.rpc("decrement_sms_credits", { p_salon_id: rdv.salon_id, p_amount: segments });
          smsEnvoyes += segments;
        } catch (e) {
          console.error("SMS de rappel échoué, SMS coupés pour ce passage:", e);
          smsIndisponible = true;
          echecs++;
        }
      }
    }
    sent++;
  }

  return NextResponse.json({ ok: true, sent, emails: emailsEnvoyes, sms: smsEnvoyes, echecs, sms_interrompus: smsIndisponible });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateRappel } from "@/lib/email";
import { sendSMS, smsRappel } from "@/lib/sms";

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

  const { data: salonSettings } = await admin.from("app_settings").select("salon_id, email_rappel_active, email_rappel_objet, message_rappel_rdv, email_expediteur, email_expediteur_nom, sms_active, sms_expediteur");
  const { data: rdvs } = await admin
    .from("rendez_vous")
    .select("id, date_heure, salon_id, salons(nom), clients(prenom, email, telephone), rendez_vous_prestations(prestations(nom, tarif, sur_devis))")
    .eq("statut", "confirme")
    .gte("date_heure", `${demainStr}T00:00:00`)
    .lte("date_heure", `${demainStr}T23:59:59`);

  let sent = 0;
  for (const rdv of rdvs || []) {
    const salonCfg = (salonSettings || []).find(s => s.salon_id === rdv.salon_id);
    if (salonCfg?.email_rappel_active === false) continue;
    const client = rdv.clients as unknown as { prenom: string; email: string | null; telephone: string | null } | null;
    if (!client?.email && !client?.telephone) continue;

    const salon = rdv.salons as unknown as { nom: string } | null;
    const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string; tarif: number; sur_devis: boolean } | null }[])
      .map(rp => rp.prestations)
      .filter(Boolean) as { nom: string; tarif: number; sur_devis: boolean }[];

    const dateStr = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const heureStr = rdv.date_heure.slice(11, 16);

    if (salonCfg?.email_rappel_active !== false && client.email) {
      await sendEmail({
        to: client.email,
        toName: client.prenom,
        subject: salonCfg?.email_rappel_objet || `Rappel : votre rendez-vous demain — ${salon?.nom || "rdvous"}`,
        html: templateRappel({ prenom: client.prenom, salonNom: salon?.nom || "", dateStr, heureStr, prestations, contenu: salonCfg?.message_rappel_rdv || undefined }),
        fromName: salonCfg?.email_expediteur_nom || salon?.nom || "rdvous",
        replyTo: salonCfg?.email_expediteur || undefined,
      });
    }
    if (salonCfg?.sms_active && client.telephone) {
      const { data: canSend } = await admin.rpc("decrement_sms_credits", { p_salon_id: rdv.salon_id });
      if (canSend) {
        await sendSMS({
          to: client.telephone,
          content: smsRappel({ prenom: client.prenom, salonNom: salon?.nom || "", dateStr, heureStr }),
          sender: salonCfg?.sms_expediteur || salon?.nom || undefined,
        });
      }
    }
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}

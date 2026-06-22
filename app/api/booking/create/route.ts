import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateConfirmation, templateNouveauRdv } from "@/lib/email";
import { sendSMS, smsConfirmation } from "@/lib/sms";
import { bookingLimiter, getIP } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const { success } = await bookingLimiter.limit(getIP(req));
    if (!success) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une heure." }, { status: 429 });
  }

  const { salon_id, prestation_ids, date, heure, prenom, nom, email, telephone, adresse_domicile } = await req.json();

  const ids: string[] = Array.isArray(prestation_ids) ? prestation_ids : prestation_ids ? [prestation_ids] : [];
  if (!salon_id || ids.length === 0 || !date || !heure || !prenom || !nom || !email || !telephone) {
    return NextResponse.json({ error: "Tous les champs obligatoires doivent être remplis." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Trouver ou créer le client
  let clientId: string;
  if (email) {
    const { data: existing } = await admin.from("clients").select("id").eq("salon_id", salon_id).eq("email", email).single();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: newClient } = await admin.from("clients").insert({ salon_id, prenom, nom, email, telephone: telephone || null }).select("id").single();
      if (!newClient) return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
      clientId = newClient.id;
    }
  } else {
    const { data: newClient } = await admin.from("clients").insert({ salon_id, prenom, nom, telephone: telephone || null }).select("id").single();
    if (!newClient) return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
    clientId = newClient.id;
  }

  // Créer le RDV
  const cancelToken = crypto.randomUUID();
  const { data: rdv, error } = await admin.from("rendez_vous")
    .insert({ salon_id, client_id: clientId, date_heure: `${date}T${heure}:00`, statut: "planifie", adresse_domicile: adresse_domicile || null, cancel_token: cancelToken })
    .select("id")
    .single();

  if (error || !rdv) return NextResponse.json({ error: error?.message || "Erreur RDV" }, { status: 500 });

  await admin.from("rendez_vous_prestations").insert(ids.map(prestation_id => ({ rendez_vous_id: rdv.id, prestation_id })));

  // Envoyer email de confirmation
  try {
    const { data: fullRdv } = await admin
      .from("rendez_vous")
      .select("date_heure, clients(prenom, email), rendez_vous_prestations(prestations(nom, duree_minutes, tarif, sur_devis)), salons(nom)")
      .eq("id", rdv.id)
      .single();
    const { data: settings } = await admin.from("app_settings").select("email_confirmation_active, email_confirmation_objet, message_confirmation, email_expediteur, email_expediteur_nom, email_reception, sms_active, sms_confirmation_active, sms_expediteur, sms_message_confirmation").eq("salon_id", salon_id).single();

    const clientData = fullRdv?.clients as unknown as { prenom: string; email: string | null } | null;
    const salonData = fullRdv?.salons as unknown as { nom: string } | null;
    const prestationsData = ((fullRdv?.rendez_vous_prestations || []) as unknown as { prestations: { nom: string; duree_minutes: number; tarif: number; sur_devis: boolean } | null }[])
      .map(rp => rp.prestations).filter(Boolean) as { nom: string; duree_minutes: number; tarif: number; sur_devis: boolean }[];

    const dateStr = new Date(fullRdv!.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const heureStr = fullRdv!.date_heure.slice(11, 16);

    // Email de confirmation au client
    if (settings?.email_confirmation_active !== false && clientData?.email && fullRdv) {
      await sendEmail({
        to: clientData.email,
        toName: clientData.prenom,
        subject: settings?.email_confirmation_objet || `Confirmation de votre rendez-vous — ${salonData?.nom || "rdvous"}`,
        html: templateConfirmation({ prenom: clientData.prenom, salonNom: salonData?.nom || "", dateStr, heureStr, prestations: prestationsData, contenu: settings?.message_confirmation || undefined, cancelToken }),
        fromName: settings?.email_expediteur_nom || salonData?.nom || "rdvous",
        replyTo: settings?.email_expediteur || undefined,
      });
    }

    // SMS de confirmation au client
    if (settings?.sms_active && settings?.sms_confirmation_active !== false && telephone) {
      try {
        const { data: canSend, error: rpcError } = await admin.rpc("decrement_sms_credits", { p_salon_id: salon_id });
        if (rpcError) { console.error("SMS: decrement_sms_credits error:", rpcError); }
        else if (!canSend) { console.warn("SMS: pas de crédits disponibles pour", salon_id); }
        else {
          await sendSMS({
            to: telephone,
            content: smsConfirmation({ prenom: clientData?.prenom || prenom, salonNom: salonData?.nom || "", dateStr, heureStr, contenu: settings?.sms_message_confirmation }),
            sender: settings?.sms_expediteur || salonData?.nom || undefined,
          });
        }
      } catch (smsErr) {
        console.error("SMS confirmation failed:", smsErr);
      }
    } else {
      if (!settings?.sms_active) console.log("SMS: désactivé pour", salon_id);
      if (!telephone) console.warn("SMS: pas de numéro de téléphone");
    }

    // Notification nouveau RDV à l'artisan
    let artisanEmail = settings?.email_reception?.trim() || settings?.email_expediteur?.trim() || null;
    if (!artisanEmail) {
      const { data: su } = await admin.from("salon_users").select("user_id").eq("salon_id", salon_id).limit(1).single();
      if (su?.user_id) {
        const { data: { user: authUser } } = await admin.auth.admin.getUserById(su.user_id);
        artisanEmail = authUser?.email || null;
      }
    }
    if (artisanEmail && fullRdv) {
      await sendEmail({
        to: artisanEmail,
        toName: settings?.email_expediteur_nom || salonData?.nom || "rdvous",
        subject: `Nouveau RDV — ${clientData?.prenom || ""} ${nom} · ${dateStr} à ${heureStr}`,
        html: templateNouveauRdv({ clientPrenom: prenom, clientNom: nom, clientTel: telephone, clientEmail: email || "", dateStr, heureStr, prestations: prestationsData, adresseDomicile: adresse_domicile }),
        fromName: "rdvous",
      });
    }

    // Alerte interne
    sendEmail({
      to: "support@rdvous.fr",
      toName: "rdvous",
      subject: `🔔 Nouveau RDV — ${salonData?.nom || salon_id} · ${prenom} ${nom}`,
      html: `<div style="font-family:sans-serif;padding:24px;color:#222">
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:16px;border-left:4px solid #22c55e">
          <strong>${dateStr} à ${heureStr}</strong><br/>
          <span style="color:#666">${salonData?.nom || salon_id}</span>
        </div>
        <p><strong>Client :</strong> ${prenom} ${nom}</p>
        <p><strong>Email :</strong> ${email || "—"}</p>
        <p><strong>Tél :</strong> ${telephone || "—"}</p>
        <p><strong>Prestations :</strong> ${prestationsData.map(p => p.nom).join(", ") || "—"}</p>
      </div>`,
      fromName: "rdvous monitoring",
    }).catch(e => console.error("Alerte interne failed:", e));
  } catch (e) {
    console.error("Confirmation email failed:", e);
  }

  return NextResponse.json({ ok: true, rdv_id: rdv.id });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateConfirmation, templateNouveauRdv } from "@/lib/email";
import { sendSMS, smsConfirmation, analyserSms } from "@/lib/sms";
import { bookingLimiter, getIP } from "@/lib/ratelimit";
import { normalizePhone, normalizeEmail } from "@/lib/normalize";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const { success } = await bookingLimiter.limit(getIP(req));
    if (!success) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une heure." }, { status: 429 });
  }

  const { salon_id, prestation_ids, date, heure, prenom, nom, email: emailRaw, telephone, adresse_domicile, cle_session } = await req.json();
  const email = normalizeEmail(emailRaw) || emailRaw;
  const telephoneNorm = normalizePhone(telephone);

  const ids: string[] = Array.isArray(prestation_ids) ? prestation_ids : prestation_ids ? [prestation_ids] : [];
  if (!salon_id || ids.length === 0 || !date || !heure || !prenom || !nom || !email || !telephone) {
    return NextResponse.json({ error: "Tous les champs obligatoires doivent être remplis." }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Trouver ou créer le client, upsert atomique sur (salon_id, email) pour éviter les doublons en race condition
  let clientId: string;
  const { data: upserted, error: upsertErr } = await admin
    .from("clients")
    .upsert(
      { salon_id, prenom, nom, email, telephone: telephoneNorm },
      { onConflict: "salon_id,email", ignoreDuplicates: false }
    )
    .select("id")
    .single();
  if (upsertErr || !upserted) {
    // Fallback si la contrainte unique n'est pas encore posée : cherche par email puis par téléphone normalisé
    const { data: byEmail } = await admin.from("clients").select("id").eq("salon_id", salon_id).eq("email", email).maybeSingle();
    if (byEmail) {
      clientId = byEmail.id;
    } else if (telephoneNorm) {
      const { data: byPhone } = await admin.from("clients").select("id").eq("salon_id", salon_id).eq("telephone", telephoneNorm).maybeSingle();
      if (byPhone) {
        await admin.from("clients").update({ email }).eq("id", byPhone.id);
        clientId = byPhone.id;
      } else {
        const { data: newClient } = await admin.from("clients").insert({ salon_id, prenom, nom, email, telephone: telephoneNorm }).select("id").single();
        if (!newClient) return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
        clientId = newClient.id;
      }
    } else {
      const { data: newClient } = await admin.from("clients").insert({ salon_id, prenom, nom, email, telephone: telephoneNorm }).select("id").single();
      if (!newClient) return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
      clientId = newClient.id;
    }
  } else {
    clientId = upserted.id;
  }

  // Récupérer la durée totale des prestations
  const { data: prestationData } = await admin.from("prestations").select("duree_minutes").in("id", ids);
  const dureeMinutes = (prestationData || []).reduce((s, p) => s + (p.duree_minutes || 0), 0) || 60;

  // Revalidation serveur : ne jamais accepter un créneau sur un jour fermé ou en congé
  // (le blocage côté créneaux ne suffit pas, un état périmé ou un appel direct peut le contourner)
  const [{ data: dayExceptions }, { data: dayConges }] = await Promise.all([
    admin.from("disponibilites_exceptions").select("ferme").eq("salon_id", salon_id).eq("date", date),
    admin.from("conges").select("id").eq("salon_id", salon_id).lte("date_debut", date).gte("date_fin", date).limit(1),
  ]);
  if ((dayExceptions || []).some(e => e.ferme) || (dayConges && dayConges.length > 0)) {
    return NextResponse.json({ error: "Ce jour n'est pas disponible à la réservation." }, { status: 409 });
  }

  // Créer le RDV de façon atomique (pg_advisory_lock, élimine la race condition)
  const cancelToken = crypto.randomUUID();
  const { data: rdvId, error } = await admin.rpc("create_rdv_safe", {
    p_salon_id: salon_id,
    p_client_id: clientId,
    p_date_heure: `${date}T${heure}:00`,
    p_duree_minutes: dureeMinutes,
    p_statut: "planifie",
    p_cancel_token: cancelToken,
    p_adresse_domicile: adresse_domicile || null,
    p_source: "client",
  });

  if (error) {
    if (error.message?.includes("CONFLIT_CRENEAU")) {
      return NextResponse.json({ error: "Ce créneau n'est plus disponible. Veuillez en choisir un autre." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Erreur RDV" }, { status: 500 });
  }

  const rdv = { id: rdvId as string };

  // Le rendez-vous existe, le verrou n'a plus lieu d'être.
  if (cle_session) await admin.from("creneaux_bloques").delete().eq("cle_session", cle_session);

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
        subject: settings?.email_confirmation_objet || `Confirmation de votre rendez-vous, ${salonData?.nom || "rdvous"}`,
        html: templateConfirmation({ prenom: clientData.prenom, salonNom: salonData?.nom || "", dateStr, heureStr, prestations: prestationsData, contenu: settings?.message_confirmation || undefined, cancelToken }),
        fromName: settings?.email_expediteur_nom || salonData?.nom || "rdvous",
        replyTo: settings?.email_expediteur || undefined,
      });
    }

    // SMS de confirmation au client
    if (settings?.sms_active && settings?.sms_confirmation_active !== false && telephone) {
      try {
        // Le contenu est construit avant le décompte : on débite autant de crédits
        // que le message consomme réellement de segments chez l'opérateur.
        const texteSms = smsConfirmation({ prenom: clientData?.prenom || prenom, salonNom: salonData?.nom || "", dateStr, heureStr, contenu: settings?.sms_message_confirmation });
        const { segments } = analyserSms(texteSms);

        // Solde vérifié sans être consommé, débité seulement après un envoi réussi.
        const { data: solde } = await admin
          .from("salons")
          .select("sms_credits, sms_credits_achetes")
          .eq("id", salon_id)
          .single();
        const disponible = (solde?.sms_credits ?? 0) + (solde?.sms_credits_achetes ?? 0);

        if (disponible < segments) {
          console.warn("SMS: crédits insuffisants pour", segments, "segment(s) pour", salon_id);
        } else {
          await sendSMS({
            to: telephone,
            content: texteSms,
            sender: settings?.sms_expediteur || salonData?.nom || undefined,
          });
          await admin.rpc("decrement_sms_credits", { p_salon_id: salon_id, p_amount: segments });
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
        subject: `Nouveau RDV, ${clientData?.prenom || ""} ${nom} · ${dateStr} à ${heureStr}`,
        html: templateNouveauRdv({ clientPrenom: prenom, clientNom: nom, clientTel: telephone, clientEmail: email || "", dateStr, heureStr, prestations: prestationsData, adresseDomicile: adresse_domicile }),
        fromName: "rdvous",
      });
    }

    // L'alerte interne par réservation a été retirée : elle représentait un email
    // par RDV réservé à l'exploitant, soit un quart du volume total et une charge
    // qui croît linéairement avec le nombre de salons. La page /admin/live donne
    // déjà cette information en temps réel.
  } catch (e) {
    console.error("Confirmation email failed:", e);
  }

  return NextResponse.json({ ok: true, rdv_id: rdv.id });
}

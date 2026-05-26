import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateConfirmation, templateNouveauRdv } from "@/lib/email";

export async function POST(req: NextRequest) {
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
  const { data: rdv, error } = await admin.from("rendez_vous")
    .insert({ salon_id, client_id: clientId, date_heure: `${date}T${heure}:00`, statut: "confirme", adresse_domicile: adresse_domicile || null })
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
    const { data: settings } = await admin.from("app_settings").select("email_confirmation_active, email_confirmation_objet, message_confirmation, email_expediteur, email_expediteur_nom, email_reception").eq("salon_id", salon_id).single();

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
        html: templateConfirmation({ prenom: clientData.prenom, salonNom: salonData?.nom || "", dateStr, heureStr, prestations: prestationsData, contenu: settings?.message_confirmation || undefined }),
        fromName: settings?.email_expediteur_nom || salonData?.nom || "rdvous",
        replyTo: settings?.email_expediteur || undefined,
      });
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
  } catch (e) {
    console.error("Confirmation email failed:", e);
  }

  return NextResponse.json({ ok: true, rdv_id: rdv.id });
}

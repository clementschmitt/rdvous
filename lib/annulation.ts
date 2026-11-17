import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { adresseDeLaPro } from "@/lib/adresse-pro";

// D'où vient l'annulation : le lien du mail de confirmation, ou l'espace client /mon-compte.
export type OrigineAnnulation = "lien" | "compte";

export class AnnulationError extends Error {
  constructor(public code: "INTROUVABLE" | "DEJA_ANNULE" | "ECRITURE", message: string) {
    super(message);
  }
}

// Annule un rendez-vous, l'inscrit au journal, prévient la professionnelle et sa liste d'attente.
// Point d'entrée unique de toute annulation faite par une cliente : avant le 17/11/2026, l'annulation
// depuis /mon-compte ne prévenait personne, et aucune des deux routes ne vérifiait l'écriture en base.
// Lève une AnnulationError si le rendez-vous n'a pas pu être annulé ; les notifications, elles,
// n'interrompent jamais l'annulation (un mail qui échoue est journalisé, pas bloquant).
export async function annulerRendezVous(admin: SupabaseClient, rdvId: string, origine: OrigineAnnulation) {
  const { data: rdv, error: lectureErr } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut, salon_id, salons(nom), clients(prenom, nom), rendez_vous_prestations(prestations(nom))")
    .eq("id", rdvId)
    .single();
  if (lectureErr || !rdv) throw new AnnulationError("INTROUVABLE", "Rendez-vous introuvable.");

  // Le filtre sur le statut rend l'opération sûre en cas de double clic : la seconde requête ne trouve plus rien.
  const { data: maj, error: majErr } = await admin
    .from("rendez_vous")
    .update({ statut: "annule" })
    .eq("id", rdvId)
    .neq("statut", "annule")
    .select("id");
  if (majErr) {
    console.error("Annulation : écriture en base échouée", majErr);
    throw new AnnulationError("ECRITURE", "L'annulation n'a pas pu être enregistrée. Réessayez dans un instant.");
  }
  if (!maj || maj.length === 0) throw new AnnulationError("DEJA_ANNULE", "Ce rendez-vous est déjà annulé.");

  const salon = rdv.salons as unknown as { nom: string } | null;
  const client = rdv.clients as unknown as { prenom: string; nom: string } | null;
  const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string } | null }[])
    .map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
  const dateStr = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heureStr = rdv.date_heure.slice(11, 16);

  // ── Journal ──
  // Même table que les déplacements : on sait désormais quand et par où un rendez-vous a été annulé.
  const { error: journalErr } = await admin.from("rdv_events").insert({
    salon_id: rdv.salon_id,
    rdv_id: rdv.id,
    type: `annulation_${origine}`,
    old_date_heure: rdv.date_heure,
    new_date_heure: null,
    client_prenom: client?.prenom || null,
    client_nom: client?.nom || null,
  });
  if (journalErr) console.error("Annulation : journal non écrit", journalErr);

  // ── Adresse de la professionnelle ──
  const { data: settings } = await admin
    .from("app_settings")
    .select("email_expediteur, email_reception, email_expediteur_nom")
    .eq("salon_id", rdv.salon_id)
    .single();
  const artisanEmail = await adresseDeLaPro(admin, rdv.salon_id, settings);

  const origineLibelle = origine === "compte" ? "depuis son espace client" : "depuis le lien de son mail de confirmation";

  if (artisanEmail) {
    try {
      await sendEmail({
        to: artisanEmail,
        toName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
        subject: `Annulation, ${client?.prenom || ""} ${client?.nom || ""} · ${dateStr} à ${heureStr}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
          <div style="background:#fef2f2;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #ef4444">
            <div style="font-size:16px;font-weight:700;color:#dc2626">Rendez-vous annulé</div>
            <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr} à ${heureStr}</div>
          </div>
          <p style="font-size:14px"><strong>Client :</strong> ${client?.prenom || ""} ${client?.nom || ""}</p>
          ${prestations ? `<p style="font-size:14px"><strong>Prestations :</strong> ${prestations}</p>` : ""}
          <p style="font-size:13px;color:#888">${client?.prenom ? `${client.prenom} ${client?.nom || ""}`.trim() : "La personne"} a annulé ${origineLibelle}.</p>
        </div>`,
        fromName: "rdvous",
      });
    } catch (e) {
      console.error("Annulation : mail à la professionnelle échoué", e);
    }
  } else {
    console.error("Annulation : aucune adresse pour prévenir la professionnelle", rdv.salon_id);
  }

  // ── Liste d'attente ──
  // Une place vient de se libérer ce jour-là : on prévient la professionnelle des personnes en attente.
  try {
    const dateRdv = rdv.date_heure.slice(0, 10);
    const { data: waitingAll } = await admin
      .from("liste_attente")
      .select("id, prenom, email, telephone, heure_debut, heure_fin")
      .eq("salon_id", rdv.salon_id)
      .eq("date_souhaitee", dateRdv)
      .eq("statut", "en_attente")
      .order("created_at", { ascending: true });

    // Ne retenir que les personnes dont la plage horaire correspond (ou sans préférence)
    const waiting = (waitingAll || []).filter(w => {
      if (!w.heure_debut && !w.heure_fin) return true;
      if (w.heure_debut && heureStr < w.heure_debut) return false;
      if (w.heure_fin && heureStr > w.heure_fin) return false;
      return true;
    });

    if (waiting.length > 0) {
      const salonNom = salon?.nom || "votre salon";

      // Notifier uniquement la professionnelle, elle gère sa liste d'attente manuellement
      if (artisanEmail) {
        const lignes = waiting.map((w, i) => {
          const plage = w.heure_debut || w.heure_fin
            ? ` (${w.heure_debut && w.heure_fin ? `${w.heure_debut}–${w.heure_fin}` : w.heure_debut ? `dès ${w.heure_debut}` : `avant ${w.heure_fin}`})`
            : "";
          return `<li style="margin-bottom:6px">#${i + 1}, <strong>${w.prenom}</strong> · <a href="tel:${w.telephone}">${w.telephone}</a>${plage}</li>`;
        }).join("");

        try {
          await sendEmail({
            to: artisanEmail,
            toName: settings?.email_expediteur_nom || salonNom,
            subject: `Liste d'attente, ${waiting.length} personne${waiting.length > 1 ? "s" : ""} à rappeler pour le ${dateStr}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
              <div style="background:#ecfdf5;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #10b981">
                <div style="font-size:16px;font-weight:700;color:#059669">Un créneau s'est libéré</div>
                <div style="font-size:18px;font-weight:700;margin-top:6px">${dateStr} à ${heureStr}</div>
              </div>
              <p style="font-size:14px;line-height:1.6">${waiting.length} personne${waiting.length > 1 ? "s sont" : " est"} en liste d'attente pour ce jour :</p>
              <ul style="font-size:14px;line-height:1.8;padding-left:18px">${lignes}</ul>
              <p style="font-size:13px;color:#888;margin-top:20px">Retrouvez la liste complète dans votre tableau de bord.</p>
            </div>`,
            fromName: "rdvous",
          });
        } catch (e) { console.error("Annulation : mail liste d'attente échoué", e); }
      }

      // Marquer comme « notifié » : la pro a été prévenue, à elle de contacter les clients
      await admin
        .from("liste_attente")
        .update({ statut: "notifie", notifie_le: new Date().toISOString() })
        .in("id", waiting.map(w => w.id));
    }
  } catch (e) {
    console.error("Annulation : bloc liste d'attente échoué", e);
  }

  return { salonNom: salon?.nom, dateStr, heureStr };
}

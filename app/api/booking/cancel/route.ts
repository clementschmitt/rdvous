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
    const { data: waitingAll } = await admin
      .from("liste_attente")
      .select("id, prenom, email, telephone, heure_debut, heure_fin")
      .eq("salon_id", rdv.salon_id)
      .eq("date_souhaitee", dateRdv)
      .eq("statut", "en_attente")
      .order("created_at", { ascending: true });

    // Ne prévenir que les personnes dont la plage horaire correspond (ou sans préférence)
    const waiting = (waitingAll || []).filter(w => {
      if (!w.heure_debut && !w.heure_fin) return true;
      if (w.heure_debut && heureStr < w.heure_debut) return false;
      if (w.heure_fin && heureStr > w.heure_fin) return false;
      return true;
    });

    if (waiting && waiting.length > 0) {
      const salonNom = salon?.nom || "votre salon";

      // Notifier uniquement la professionnelle — elle gère sa liste d'attente manuellement
      if (artisanEmail) {
        const lignes = waiting.map((w, i) => {
          const plage = w.heure_debut || w.heure_fin
            ? ` (${w.heure_debut && w.heure_fin ? `${w.heure_debut}–${w.heure_fin}` : w.heure_debut ? `dès ${w.heure_debut}` : `avant ${w.heure_fin}`})`
            : "";
          return `<li style="margin-bottom:6px">#${i + 1} — <strong>${w.prenom}</strong> · <a href="tel:${w.telephone}">${w.telephone}</a>${plage}</li>`;
        }).join("");

        try {
          await sendEmail({
            to: artisanEmail,
            toName: settings?.email_expediteur_nom || salonNom,
            subject: `Liste d'attente — ${waiting.length} personne${waiting.length > 1 ? "s" : ""} à rappeler pour le ${dateStr}`,
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
        } catch (e) { console.error("Waitlist artisan email failed:", e); }
      }

      // Marquer comme "notifié" — la pro a été prévenue, à elle de contacter les clientes
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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateDeplacement } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { rdv_id, old_date_heure, new_date, new_heure, notify, force } = await req.json();
  if (!rdv_id || !new_date || !new_heure) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("date_heure, duree_minutes, clients(prenom, nom, email), rendez_vous_prestations(prestations(nom, duree_minutes)), salons(nom), salon_id")
    .eq("id", rdv_id)
    .single();

  if (!rdv) return NextResponse.json({ error: "RDV introuvable" }, { status: 404 });

  // Vérification de conflit : le créneau cible ne doit chevaucher aucun autre RDV du salon
  if (!force) {
    const debut = minutes(new_heure);
    const fin = debut + dureeDe(rdv.duree_minutes, rdv.rendez_vous_prestations as unknown as PrestaLien[]);

    const { data: autres } = await admin
      .from("rendez_vous")
      .select("id, date_heure, duree_minutes, clients(prenom, nom), rendez_vous_prestations(prestations(duree_minutes))")
      .eq("salon_id", rdv.salon_id)
      .neq("id", rdv_id)
      .neq("statut", "annule")
      .gte("date_heure", `${new_date}T00:00:00`)
      .lte("date_heure", `${new_date}T23:59:59`);

    for (const autre of (autres || []) as unknown as AutreRdv[]) {
      const aDebut = minutes(autre.date_heure.slice(11, 16));
      const aFin = aDebut + dureeDe(autre.duree_minutes, autre.rendez_vous_prestations);
      if (aDebut < fin && aFin > debut) {
        const nom = `${autre.clients?.prenom || ""} ${autre.clients?.nom || ""}`.trim() || "un autre client";
        return NextResponse.json(
          { error: `Ce créneau chevauche le rendez-vous de ${nom} à ${autre.date_heure.slice(11, 16)}.`, code: "CONFLIT_CRENEAU" },
          { status: 409 }
        );
      }
    }
  }

  const ancienSource = old_date_heure || rdv.date_heure;
  const ancienDateStr = new Date(ancienSource).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const ancienHeureStr = ancienSource.slice(11, 16);

  await admin.from("rendez_vous").update({ date_heure: `${new_date}T${new_heure}:00` }).eq("id", rdv_id);

  const client = rdv.clients as unknown as { prenom: string; nom: string; email: string | null } | null;
  await admin.from("rdv_events").insert({
    salon_id: rdv.salon_id,
    rdv_id,
    type: "deplacement",
    old_date_heure: ancienSource,
    new_date_heure: `${new_date}T${new_heure}:00`,
    client_prenom: client?.prenom || null,
    client_nom: client?.nom || null,
  });

  if (notify) {
    const salon = rdv.salons as unknown as { nom: string } | null;
    const prestations = ((rdv.rendez_vous_prestations || []) as unknown as { prestations: { nom: string } | null }[])
      .map(rp => rp.prestations).filter(Boolean) as { nom: string }[];

    if (client?.email) {
      const nouveauDate = new Date(`${new_date}T${new_heure}:00`);
      const nouveauDateStr = nouveauDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

      const { data: settings } = await admin.from("app_settings")
        .select("email_expediteur, email_expediteur_nom")
        .eq("salon_id", rdv.salon_id)
        .single();

      await sendEmail({
        to: client.email,
        toName: client.prenom,
        subject: `Votre rendez-vous a été déplacé — ${salon?.nom || ""}`,
        html: templateDeplacement({
          prenom: client.prenom,
          salonNom: salon?.nom || "",
          ancienDateStr,
          ancienHeureStr,
          nouveauDateStr,
          nouveauHeureStr: new_heure,
          prestations,
        }),
        fromName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
        replyTo: settings?.email_expediteur || undefined,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

type PrestaLien = { prestations: { duree_minutes: number } | null };

type AutreRdv = {
  date_heure: string;
  duree_minutes: number | null;
  clients: { prenom: string; nom: string } | null;
  rendez_vous_prestations: PrestaLien[];
};

function dureeDe(dureeMinutes: number | null, liens: PrestaLien[] | null): number {
  return dureeMinutes || (liens || []).reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

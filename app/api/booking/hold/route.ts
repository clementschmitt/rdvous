import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { holdLimiter, getIP } from "@/lib/ratelimit";

// Durée du verrou. Volontairement large : un verrou qui expire pendant que la
// cliente tape son numéro recrée exactement la frustration qu on veut supprimer,
// alors qu un créneau gelé quelques minutes de trop ne coûte presque rien à ce
// volume de rendez-vous. On préfère perdre de la disponibilité que perdre une
// réservation en cours.
const DUREE_VERROU_MINUTES = 10;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * Minutes depuis minuit lues dans la chaîne, jamais via l'objet Date : les
 * horaires sont stockés sans fuseau et le serveur Vercel tourne en UTC, un
 * `new Date(...)` décalerait tout de deux heures l'été.
 */
function minutesDuJour(dateHeure: string): number {
  const [h, m] = dateHeure.slice(11, 16).split(":").map(Number);
  return h * 60 + m;
}

/** Pose ou prolonge un verrou sur un créneau. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const { success } = await holdLimiter.limit(getIP(req));
    // Sans plafond, une seule IP pourrait geler un agenda entier en boucle.
    if (!success) return NextResponse.json({ error: "Trop de tentatives." }, { status: 429 });
  }

  const { salon_id, date, heure, duree_minutes, cle_session } = await req.json();
  if (!salon_id || !date || !heure || !cle_session) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  const duree = Number(duree_minutes) > 0 ? Number(duree_minutes) : 60;

  const db = admin();
  const maintenantIso = new Date().toISOString();
  const dateHeure = `${date}T${heure}:00`;
  const debut = minutesDuJour(dateHeure);
  const fin = debut + duree;

  // Purge opportuniste, ça évite un cron pour une table qui reste minuscule.
  await db.from("creneaux_bloques").delete().lt("expire_le", maintenantIso);

  // Cette session ne détient qu'un verrou à la fois : si elle change de créneau,
  // l'ancien doit se libérer immédiatement.
  await db.from("creneaux_bloques").delete().eq("cle_session", cle_session);

  const [{ data: existants }, { data: rdvs }] = await Promise.all([
    db.from("creneaux_bloques")
      .select("date_heure, duree_minutes, cle_session")
      .eq("salon_id", salon_id)
      .gte("expire_le", maintenantIso)
      .gte("date_heure", `${date}T00:00:00`)
      .lte("date_heure", `${date}T23:59:59`),
    db.from("rendez_vous")
      .select("date_heure, duree_minutes, rendez_vous_prestations(prestations(duree_minutes))")
      .eq("salon_id", salon_id)
      .neq("statut", "annule")
      .gte("date_heure", `${date}T00:00:00`)
      .lte("date_heure", `${date}T23:59:59`),
  ]);

  // Quelqu'un d'autre tient-il déjà un créneau qui chevauche celui-ci ?
  const chevauche = (existants || []).some(v => {
    if (v.cle_session === cle_session) return false;
    const vDebut = minutesDuJour(v.date_heure);
    return vDebut < fin && vDebut + (v.duree_minutes || 0) > debut;
  });
  if (chevauche) {
    return NextResponse.json({ error: "Ce créneau vient d'être sélectionné par quelqu'un d'autre." }, { status: 409 });
  }

  // Le créneau a-t-il été réservé entre temps ? Un verrou ne doit jamais laisser
  // croire qu'un horaire déjà pris est encore disponible.
  type RdvRow = { date_heure: string; duree_minutes: number | null; rendez_vous_prestations: { prestations: { duree_minutes: number } | null }[] };
  const pris = ((rdvs || []) as unknown as RdvRow[]).some(r => {
    const rDebut = minutesDuJour(r.date_heure);
    const rDuree = r.duree_minutes || r.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
    return rDebut < fin && rDebut + rDuree > debut;
  });
  if (pris) {
    return NextResponse.json({ error: "Ce créneau n'est plus disponible." }, { status: 409 });
  }

  const expireLe = new Date(Date.now() + DUREE_VERROU_MINUTES * 60000);
  const { error } = await db.from("creneaux_bloques").insert({
    salon_id,
    date_heure: dateHeure,
    duree_minutes: duree,
    cle_session,
    expire_le: expireLe.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, expire_le: expireLe.toISOString(), duree_verrou_minutes: DUREE_VERROU_MINUTES });
}

/** Libère le verrou quand la cliente revient au calendrier ou quitte la page. */
export async function DELETE(req: NextRequest) {
  const { cle_session } = await req.json().catch(() => ({ cle_session: null }));
  if (!cle_session) return NextResponse.json({ ok: true });
  await admin().from("creneaux_bloques").delete().eq("cle_session", cle_session);
  return NextResponse.json({ ok: true });
}

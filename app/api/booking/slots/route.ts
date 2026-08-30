import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const salon_id = searchParams.get("salon_id");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const duree = parseInt(searchParams.get("duree") || "60");
  // Clé de session de la visiteuse : son propre verrou ne doit pas lui masquer
  // le créneau qu'elle est justement en train de réserver.
  const cleSession = searchParams.get("cle") || "";

  if (!salon_id || !date) return NextResponse.json({ slots: [] });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const jourSemaine = (new Date(date + "T12:00:00").getDay() + 6) % 7; // 0=lundi

  // Pour les blocs multi-jours, on cherche jusqu'à 30 jours en arrière
  const dateMinus30 = new Date(date + "T12:00:00");
  dateMinus30.setDate(dateMinus30.getDate() - 30);
  const dateMinus30Str = dateMinus30.toISOString().slice(0, 10);

  const [{ data: templatePlages }, { data: rdvs }, { data: exception }, { data: settings }, { data: conges }, { data: blocs }, { data: verrousRaw }] = await Promise.all([
    admin.from("disponibilites").select("heure_debut, heure_fin").eq("salon_id", salon_id).eq("jour_semaine", jourSemaine),

    admin.from("rendez_vous")
      .select("date_heure, duree_minutes, rendez_vous_prestations(prestations(duree_minutes))")
      .eq("salon_id", salon_id)
      .neq("statut", "annule").neq("statut", "effectue")
      .gte("date_heure", `${date}T00:00:00`)
      .lte("date_heure", `${date}T23:59:59`),
    admin.from("disponibilites_exceptions").select("ferme, plages").eq("salon_id", salon_id).eq("date", date).maybeSingle(),
    admin.from("app_settings").select("delai_min_reservation_heures, planning_horizon_jours, planning_ouverture_mode, planning_ouverture_jour, planning_ouverture_heure, date_limite_planning").eq("salon_id", salon_id).single(),
    admin.from("conges").select("id").eq("salon_id", salon_id).lte("date_debut", date).gte("date_fin", date).limit(1),
    // Les séries récurrentes n'ont pas de borne haute : leur ligne porte la date
    // de la première occurrence, qui peut être très ancienne.
    admin.from("agenda_evenements").select("date_heure, duree_minutes, recurrence, recurrence_fin, dates_exclues").eq("salon_id", salon_id).or(`and(recurrence.is.null,date_heure.gte.${dateMinus30Str}T00:00:00,date_heure.lte.${date}T23:59:59),and(recurrence.not.is.null,date_heure.lte.${date}T23:59:59)`),
    admin.from("creneaux_bloques").select("date_heure, duree_minutes, cle_session").eq("salon_id", salon_id).gte("expire_le", new Date().toISOString()).gte("date_heure", `${date}T00:00:00`).lte("date_heure", `${date}T23:59:59`),
  ]);

  // Horizon de planification : date au-delà de la limite
  const horizonJours = settings?.planning_horizon_jours ?? 0;
  const ouvertureMode = settings?.planning_ouverture_mode ?? "horizon";
  const ouvertureJour = settings?.planning_ouverture_jour ?? 23;
  const ouvertureHeure = settings?.planning_ouverture_heure ?? 0;

  // Fermeture du planning : uniquement en mode horizon glissant
  const dateLimitePlanning = settings?.date_limite_planning as string | null | undefined;
  if (dateLimitePlanning && ouvertureMode === "horizon") {
    const limiteDate = new Date(dateLimitePlanning + "T23:59:59");
    if (new Date(date + "T12:00:00") > limiteDate) return NextResponse.json({ slots: [] });
  }
  if (ouvertureMode === "date_fixe") {
    // Heure courante en heure française (gère automatiquement l'heure d'été/hiver)
    const nowFrance = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const currentDay = nowFrance.getDate();
    const currentHour = nowFrance.getHours();
    const isAfterOpeningTime = currentDay > ouvertureJour || (currentDay === ouvertureJour && currentHour >= ouvertureHeure);
    let maxYear = nowFrance.getFullYear();
    let maxMonth = nowFrance.getMonth();
    if (isAfterOpeningTime) { maxMonth += 1; if (maxMonth > 11) { maxMonth = 0; maxYear++; } }
    const maxDate = new Date(maxYear, maxMonth + 1, 0, 23, 59, 59);
    if (new Date(date + "T12:00:00") > maxDate) return NextResponse.json({ slots: [] });
  } else if (horizonJours > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + horizonJours);
    if (new Date(date + "T12:00:00") > maxDate) return NextResponse.json({ slots: [] });
  }

  // Fermeture exceptionnelle (congés) : date dans une période de fermeture
  if (conges && conges.length > 0) return NextResponse.json({ slots: [] });

  // Exception override : si une exception existe pour cette date
  let plages: { heure_debut: string; heure_fin: string }[] = [];
  if (exception) {
    if (exception.ferme) return NextResponse.json({ slots: [] });
    plages = (exception.plages as { heure_debut: string; heure_fin: string }[]) || [];
  } else {
    plages = templatePlages || [];
  }

  if (plages.length === 0) return NextResponse.json({ slots: [] });

  type RdvRow = { date_heure: string; duree_minutes: number | null; rendez_vous_prestations: { prestations: { duree_minutes: number } | null }[] };
  const occupes: { debut: number; fin: number }[] = ((rdvs || []) as unknown as RdvRow[]).map((r: RdvRow) => {
    const debut = toMinutes(r.date_heure.slice(11, 16));
    const dureeRdv = r.duree_minutes || r.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
    return { debut, fin: debut + dureeRdv };
  });

  // Blocs personnels : calculer la plage occupée sur ce jour précis.
  // La récurrence hebdomadaire était ignorée ici, si bien qu'un bloc « tous les
  // jeudis » ne protégeait que son premier jeudi et laissait réserver ensuite.
  type BlocRow = { date_heure: string; duree_minutes: number | null; recurrence: string | null; recurrence_fin: string | null; dates_exclues: string[] | null };
  const dateMs = new Date(date + "T00:00:00").getTime();
  const jourDemande = new Date(date + "T12:00:00").getDay();

  for (const bloc of ((blocs || []) as BlocRow[])) {
    if (bloc.recurrence === "hebdomadaire") {
      if (new Date(bloc.date_heure).getDay() !== jourDemande) continue;
      if (date < bloc.date_heure.slice(0, 10)) continue;
      if (bloc.recurrence_fin && date > bloc.recurrence_fin) continue;
      // Occurrence supprimée à l'unité par la professionnelle : le créneau redevient réservable.
      if ((bloc.dates_exclues || []).includes(date)) continue;
      const debut = toMinutes(bloc.date_heure.slice(11, 16));
      occupes.push({ debut, fin: Math.min(24 * 60, debut + (bloc.duree_minutes || 0)) });
      continue;
    }

    const blocStartMs = new Date(bloc.date_heure).getTime();
    const blocEndMs = blocStartMs + (bloc.duree_minutes || 0) * 60000;
    if (blocEndMs <= dateMs || blocStartMs >= dateMs + 86400000) continue; // ne chevauche pas ce jour
    const debutSurJour = Math.max(0, Math.round((blocStartMs - dateMs) / 60000));
    const finSurJour = Math.min(24 * 60, Math.round((blocEndMs - dateMs) / 60000));
    occupes.push({ debut: debutSurJour, fin: finSurJour });
  }

  // Verrous temporaires posés par d'autres visiteuses. Ils ne sont pas ajoutés
  // aux créneaux occupés : on veut les afficher grisés comme "en cours de
  // réservation" plutôt que de les faire disparaître du planning.
  const verrous = ((verrousRaw || []) as { date_heure: string; duree_minutes: number; cle_session: string }[])
    .filter(v => v.cle_session !== cleSession)
    .map(v => {
      const debut = toMinutes(v.date_heure.slice(11, 16));
      return { debut, fin: debut + (v.duree_minutes || 0) };
    });

  const delaiHeures = settings?.delai_min_reservation_heures ?? 0;
  const maintenant = new Date();
  const limiteMs = maintenant.getTime() + delaiHeures * 3600000;

  const slots: string[] = [];
  const blocked: string[] = [];
  // Créneaux tenus quelques minutes par une autre visiteuse. Distincts de
  // `blocked`, dont le message invite à appeler le salon, ce qui serait
  // absurde pour un créneau qui se libère tout seul dans cinq minutes.
  const verrouilles: string[] = [];
  for (const plage of plages) {
    const debut = toMinutes(plage.heure_debut.slice(0, 5));
    const fin = toMinutes(plage.heure_fin.slice(0, 5));
    for (let t = debut; t + duree <= fin; t += 15) {
      const slotFin = t + duree;
      const libre = !occupes.some(o => o.debut < slotFin && o.fin > t);
      if (!libre) continue;
      if (verrous.some(v => v.debut < slotFin && v.fin > t)) { verrouilles.push(fromMinutes(t)); continue; }
      if (delaiHeures > 0) {
        const slotDatetime = new Date(`${date}T${fromMinutes(t)}:00`);
        if (slotDatetime.getTime() < limiteMs) { blocked.push(fromMinutes(t)); continue; }
      }
      slots.push(fromMinutes(t));
    }
  }

  return NextResponse.json({ slots, blocked, verrouilles });
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slotsLimiter, getIP } from "@/lib/ratelimit";

// Deux usages :
//   ?date=AAAA-MM-JJ                 un seul jour, renvoie { slots, blocked, verrouilles }
//                                    (liste d'attente, assistant de chat)
//   ?debut=AAAA-MM-JJ&jours=7        une plage, renvoie { jours: { [date]: { slots, blocked, verrouilles } } }
//                                    (calendrier du widget de réservation)
//
// Pourquoi la plage : le 21/10/2026, à l'ouverture des réservations de Studio Doré, le widget appelait
// cette route une fois par jour affiché, et chaque appel lançait 7 requêtes en base, soit 49 requêtes
// par semaine affichée et environ 56 000 par heure au pic. La base a saturé pendant une heure.
// En mode plage, les 7 requêtes portent sur toute la semaine et sont lancées une seule fois.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const salon_id = searchParams.get("salon_id");
  const date = searchParams.get("date");
  const debut = searchParams.get("debut");
  const duree = parseInt(searchParams.get("duree") || "60");
  // Clé de session de la visiteuse : son propre verrou ne doit pas lui masquer
  // le créneau qu'elle est justement en train de réserver.
  const cleSession = searchParams.get("cle") || "";

  const premier = debut || date;
  if (!salon_id || !premier || !/^\d{4}-\d{2}-\d{2}$/.test(premier)) {
    return NextResponse.json(debut ? { jours: {} } : { slots: [], blocked: [], verrouilles: [] });
  }

  if (debut) {
    // Limite par adresse IP, large : sur réseau mobile, beaucoup de clientes partagent la même IP.
    // Une semaine affichée = un appel, une vraie cliente en fait quelques dizaines au plus.
    // Si le service de limitation est indisponible, on laisse passer : il protège la base,
    // il ne doit jamais empêcher de réserver.
    try {
      const { success } = await slotsLimiter.limit(getIP(req));
      if (!success) return NextResponse.json({ error: "Trop de requêtes, réessayez dans quelques minutes." }, { status: 429 });
    } catch (e) {
      console.error("Créneaux : limitation indisponible, requête acceptée", e);
    }
  }

  const nbJours = debut ? Math.min(Math.max(parseInt(searchParams.get("jours") || "7") || 7, 1), 14) : 1;
  const dates = Array.from({ length: nbJours }, (_, i) => ajouterJours(premier, i));
  const dernier = dates[dates.length - 1];
  // Pour les blocs multi-jours, on cherche jusqu'à 30 jours avant le premier jour
  const premierMoins30 = ajouterJours(premier, -30);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [
    { data: templatePlages }, { data: rdvs }, { data: exceptions }, { data: settings },
    { data: conges }, { data: blocs }, { data: verrousRaw },
  ] = await Promise.all([
    admin.from("disponibilites").select("jour_semaine, heure_debut, heure_fin").eq("salon_id", salon_id),
    admin.from("rendez_vous")
      .select("date_heure, duree_minutes, rendez_vous_prestations(prestations(duree_minutes))")
      .eq("salon_id", salon_id)
      .neq("statut", "annule").neq("statut", "effectue")
      .gte("date_heure", `${premier}T00:00:00`)
      .lte("date_heure", `${dernier}T23:59:59`),
    admin.from("disponibilites_exceptions").select("date, ferme, plages").eq("salon_id", salon_id).gte("date", premier).lte("date", dernier),
    admin.from("app_settings").select("delai_min_reservation_heures, planning_horizon_jours, planning_ouverture_mode, planning_ouverture_jour, planning_ouverture_heure, date_limite_planning").eq("salon_id", salon_id).single(),
    admin.from("conges").select("date_debut, date_fin").eq("salon_id", salon_id).lte("date_debut", dernier).gte("date_fin", premier),
    // Les séries récurrentes n'ont pas de borne haute : leur ligne porte la date
    // de la première occurrence, qui peut être très ancienne.
    admin.from("agenda_evenements").select("date_heure, duree_minutes, recurrence, recurrence_fin, dates_exclues").eq("salon_id", salon_id).or(`and(recurrence.is.null,date_heure.gte.${premierMoins30}T00:00:00,date_heure.lte.${dernier}T23:59:59),and(recurrence.not.is.null,date_heure.lte.${dernier}T23:59:59)`),
    admin.from("creneaux_bloques").select("date_heure, duree_minutes, cle_session").eq("salon_id", salon_id).gte("expire_le", new Date().toISOString()).gte("date_heure", `${premier}T00:00:00`).lte("date_heure", `${dernier}T23:59:59`),
  ]);

  const contexte: Contexte = {
    duree, cleSession, settings,
    templatePlages: (templatePlages || []) as Plage[],
    rdvs: (rdvs || []) as unknown as RdvRow[],
    exceptions: (exceptions || []) as ExceptionRow[],
    conges: (conges || []) as { date_debut: string; date_fin: string }[],
    blocs: (blocs || []) as BlocRow[],
    verrous: (verrousRaw || []) as VerrouRow[],
  };

  if (!debut) return NextResponse.json(calculerJour(premier, contexte));
  return NextResponse.json({ jours: Object.fromEntries(dates.map(d => [d, calculerJour(d, contexte)])) });
}

type Plage = { jour_semaine?: number; heure_debut: string; heure_fin: string };
type RdvRow = { date_heure: string; duree_minutes: number | null; rendez_vous_prestations: { prestations: { duree_minutes: number } | null }[] };
type ExceptionRow = { date: string; ferme: boolean; plages: Plage[] | null };
type BlocRow = { date_heure: string; duree_minutes: number | null; recurrence: string | null; recurrence_fin: string | null; dates_exclues: string[] | null };
type VerrouRow = { date_heure: string; duree_minutes: number; cle_session: string };
type Settings = {
  delai_min_reservation_heures: number | null; planning_horizon_jours: number | null; planning_ouverture_mode: string | null;
  planning_ouverture_jour: number | null; planning_ouverture_heure: number | null; date_limite_planning: string | null;
} | null;
type Contexte = {
  duree: number; cleSession: string; settings: Settings;
  templatePlages: Plage[]; rdvs: RdvRow[]; exceptions: ExceptionRow[];
  conges: { date_debut: string; date_fin: string }[]; blocs: BlocRow[]; verrous: VerrouRow[];
};

const VIDE = { slots: [] as string[], blocked: [] as string[], verrouilles: [] as string[] };

// Créneaux d'un jour, à partir des données de toute la plage. Logique identique à l'ancienne route par jour.
function calculerJour(date: string, c: Contexte) {
  const { settings, duree } = c;

  // Horizon de planification : date au-delà de la limite
  const horizonJours = settings?.planning_horizon_jours ?? 0;
  const ouvertureMode = settings?.planning_ouverture_mode ?? "horizon";
  const ouvertureJour = settings?.planning_ouverture_jour ?? 23;
  const ouvertureHeure = settings?.planning_ouverture_heure ?? 0;

  // Fermeture du planning : uniquement en mode horizon glissant
  const dateLimitePlanning = settings?.date_limite_planning;
  if (dateLimitePlanning && ouvertureMode === "horizon") {
    const limiteDate = new Date(dateLimitePlanning + "T23:59:59");
    if (new Date(date + "T12:00:00") > limiteDate) return VIDE;
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
    if (new Date(date + "T12:00:00") > maxDate) return VIDE;
  } else if (horizonJours > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + horizonJours);
    if (new Date(date + "T12:00:00") > maxDate) return VIDE;
  }

  // Fermeture exceptionnelle (congés) : date dans une période de fermeture
  if (c.conges.some(g => g.date_debut <= date && g.date_fin >= date)) return VIDE;

  // Exception override : si une exception existe pour cette date
  const exception = c.exceptions.find(e => e.date === date);
  let plages: Plage[];
  if (exception) {
    if (exception.ferme) return VIDE;
    plages = exception.plages || [];
  } else {
    const jourSemaine = (new Date(date + "T12:00:00").getDay() + 6) % 7; // 0=lundi
    plages = c.templatePlages.filter(p => p.jour_semaine === jourSemaine);
  }

  if (plages.length === 0) return VIDE;

  const occupes: { debut: number; fin: number }[] = c.rdvs
    .filter(r => r.date_heure.slice(0, 10) === date)
    .map(r => {
      const debut = toMinutes(r.date_heure.slice(11, 16));
      const dureeRdv = r.duree_minutes || r.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
      return { debut, fin: debut + dureeRdv };
    });

  // Blocs personnels : calculer la plage occupée sur ce jour précis.
  // La récurrence hebdomadaire était ignorée ici, si bien qu'un bloc « tous les
  // jeudis » ne protégeait que son premier jeudi et laissait réserver ensuite.
  const dateMs = new Date(date + "T00:00:00").getTime();
  const jourDemande = new Date(date + "T12:00:00").getDay();

  for (const bloc of c.blocs) {
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
  const verrous = c.verrous
    .filter(v => v.date_heure.slice(0, 10) === date && v.cle_session !== c.cleSession)
    .map(v => {
      const debut = toMinutes(v.date_heure.slice(11, 16));
      return { debut, fin: debut + (v.duree_minutes || 0) };
    });

  const delaiHeures = settings?.delai_min_reservation_heures ?? 0;
  const limiteMs = Date.now() + delaiHeures * 3600000;

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

  return { slots, blocked, verrouilles };
}

function ajouterJours(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

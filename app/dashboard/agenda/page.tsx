"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RDV = { id: string; date_heure: string; statut: string; duree_minutes: number; clients: { prenom: string; nom: string } | null; rendez_vous_prestations: { prestations: { nom: string; duree_minutes: number } | null }[] };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatHeure(iso: string) {
  return iso.slice(11, 16);
}

function formatDuree(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m}min` : m ? `${h}h${m}` : `${h}h`;
}

export default function AgendaPage() {
  const salon = useSalon();
  const router = useRouter();
  const [vue, setVue] = useState<"semaine" | "mois">("semaine");
  const [semaine, setSemaine] = useState(() => getMonday(new Date()));
  const [moisCourant, setMoisCourant] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [jourDate, setJourDate] = useState(() => new Date());

  const loadSemaine = useCallback(async (lundi: Date) => {
    if (!salon) return;
    const supabase = createSupabase();
    const fin = addDays(lundi, 7);
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, duree_minutes, clients(prenom, nom), rendez_vous_prestations(prestations(nom, duree_minutes))")
      .eq("salon_id", salon.id)
      .gte("date_heure", `${toDateStr(lundi)}T00:00:00`)
      .lte("date_heure", `${toDateStr(fin)}T23:59:59`)
      .neq("statut", "annule")
      .order("date_heure");
    setRdvs((data || []) as unknown as RDV[]);
  }, [salon]);

  const loadMois = useCallback(async (debut: Date) => {
    if (!salon) return;
    const supabase = createSupabase();
    const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0);
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, duree_minutes, clients(prenom, nom), rendez_vous_prestations(prestations(nom, duree_minutes))")
      .eq("salon_id", salon.id)
      .gte("date_heure", `${toDateStr(debut)}T00:00:00`)
      .lte("date_heure", `${toDateStr(fin)}T23:59:59`)
      .neq("statut", "annule")
      .order("date_heure");
    setRdvs((data || []) as unknown as RDV[]);
  }, [salon]);

  useEffect(() => {
    if (vue === "semaine") loadSemaine(semaine);
    else loadMois(moisCourant);
  }, [salon, vue, semaine, moisCourant, loadSemaine, loadMois]);

  useEffect(() => {
    const monday = getMonday(jourDate);
    if (toDateStr(monday) !== toDateStr(semaine)) {
      setSemaine(monday);
    }
  }, [jourDate]);

  if (!salon) return null;
  const m = METIERS[salon.metier];
  const today = toDateStr(new Date());

  const rdvsForDay = (day: Date) => rdvs.filter(r => r.date_heure.slice(0, 10) === toDateStr(day));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(semaine, i));

  const jourRdvs = rdvsForDay(jourDate);
  const jourLabel = jourDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const isJourToday = toDateStr(jourDate) === today;

  return (
    <div className="agenda-wrap" style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .agenda-wrap { padding: 16px !important; }
          .agenda-toolbar { display: none !important; }
          .agenda-desktop { display: none !important; }
          .agenda-mobile { display: flex !important; }
        }
        @media (min-width: 641px) {
          .agenda-mobile { display: none !important; }
        }
      `}</style>

      {/* ── Toolbar mobile ── */}
      <div className="agenda-mobile" style={{ display: "none", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Agenda</h1>
          <Link href="/dashboard/agenda/nouveau" style={{ padding: "8px 16px", background: m.couleur, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            + RDV
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setJourDate(d => addDays(d, -1))} style={navBtn}>‹</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#333", textTransform: "capitalize" }}>{jourLabel}</div>
            {!isJourToday && (
              <button onClick={() => setJourDate(new Date())} style={{ fontSize: 11, color: m.couleur, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>Aujourd'hui</button>
            )}
          </div>
          <button onClick={() => setJourDate(d => addDays(d, 1))} style={navBtn}>›</button>
        </div>
      </div>

      {/* Liste RDVs du jour — mobile */}
      <div className="agenda-mobile" style={{ display: "none", flexDirection: "column", gap: 10 }}>
        {jourRdvs.length === 0 ? (
          <div style={{ textAlign: "center", color: "#bbb", padding: "40px 0", fontSize: 14 }}>Aucun rendez-vous ce jour</div>
        ) : jourRdvs.map(rdv => {
          const duree = rdv.duree_minutes || rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0);
          const prestaNoms = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
          return (
            <div key={rdv.id} onClick={() => router.push(`/dashboard/agenda/${rdv.id}`)}
              style={{ background: "#fff", border: `1px solid ${m.couleur}25`, borderLeft: `4px solid ${m.couleur}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.couleur, marginBottom: 2 }}>{formatHeure(rdv.date_heure)}</div>
                  <div style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 600 }}>{rdv.clients ? `${rdv.clients.prenom} ${rdv.clients.nom}` : "—"}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{prestaNoms || "—"}{duree ? ` · ${formatDuree(duree)}` : ""}</div>
                </div>
                <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar desktop */}
      <div className="agenda-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Agenda</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", border: "1px solid #e0e0e0", borderRadius: 7, overflow: "hidden" }}>
            {(["semaine", "mois"] as const).map((v, i) => (
              <button key={v} onClick={() => setVue(v)} style={{ padding: "7px 16px", border: "none", borderLeft: i > 0 ? "1px solid #e0e0e0" : "none", cursor: "pointer", background: vue === v ? m.couleur : "transparent", color: vue === v ? "#fff" : "#888", fontSize: 13, fontWeight: vue === v ? 600 : 400 }}>
                {v === "semaine" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <button onClick={() => vue === "semaine" ? setSemaine(d => addDays(d, -7)) : setMoisCourant(d => addMonths(d, -1))} style={navBtn}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 200, textAlign: "center", color: "#333" }}>
            {vue === "semaine"
              ? `Semaine du ${semaine.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
              : moisCourant.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => vue === "semaine" ? setSemaine(d => addDays(d, 7)) : setMoisCourant(d => addMonths(d, 1))} style={navBtn}>›</button>
          <button onClick={() => { setSemaine(getMonday(new Date())); setMoisCourant(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} style={{ ...navBtn, fontSize: 12, padding: "5px 12px" }}>Auj.</button>

          <Link href="/dashboard/agenda/nouveau" style={{ padding: "8px 18px", background: m.couleur, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            + Nouveau RDV
          </Link>
        </div>
      </div>

      {/* Vues desktop */}
      <div className="agenda-desktop">

      {/* Vue semaine — timeline */}
      {vue === "semaine" && (
        <VueSemaineTimeline
          salonId={salon.id}
          weekDays={weekDays}
          rdvs={rdvs}
          couleur={m.couleur}
          today={today}
          router={router}
          onRdvChange={() => loadSemaine(semaine)}
        />
      )}

      {/* Vue mois */}
      {vue === "mois" && (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #d0d0d0", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid #e0e0e0" }}>
            {JOURS.map(j => <div key={j} style={{ padding: "10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#aaa", letterSpacing: "0.05em" }}>{j}</div>)}
          </div>
          <MoisGrid moisCourant={moisCourant} rdvsForDay={rdvsForDay} couleur={m.couleur} today={today} router={router} />
        </div>
      )}

      </div>{/* fin agenda-desktop */}
    </div>
  );
}

function MoisGrid({ moisCourant, rdvsForDay, couleur, today, router }: { moisCourant: Date; rdvsForDay: (d: Date) => RDV[]; couleur: string; today: string; router: ReturnType<typeof useRouter> }) {
  function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

  const firstDay = new Date(moisCourant.getFullYear(), moisCourant.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(addDays(firstDay, -offset), i));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
      {cells.map((d, i) => {
        const str = toDateStr(d);
        const isToday = str === today;
        const isCurrentMonth = d.getMonth() === moisCourant.getMonth();
        const dayRdvs = rdvsForDay(d);
        return (
          <div key={i}
            onClick={() => router.push(`/dashboard/agenda/nouveau?date=${str}`)}
            style={{ minHeight: 100, padding: 8, borderRight: "1px solid #e8e8e8", borderBottom: "1px solid #e8e8e8", background: isToday ? `${couleur}12` : "transparent", opacity: isCurrentMonth ? 1 : 0.35, cursor: "pointer" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: isToday ? couleur : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: isToday ? "#fff" : "#333" }}>{d.getDate()}</span>
            </div>
            {dayRdvs.slice(0, 3).map(rdv => (
              <div key={rdv.id} onClick={e => { e.stopPropagation(); router.push(`/dashboard/agenda/${rdv.id}`); }}
                style={{ background: `${couleur}18`, borderRadius: 3, padding: "2px 6px", marginBottom: 3, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                <span style={{ fontSize: 11, color: couleur }}>
                  {rdv.date_heure.slice(11, 16)} {rdv.clients?.prenom}
                </span>
              </div>
            ))}
            {dayRdvs.length > 3 && <div style={{ fontSize: 10, color: "#aaa" }}>+{dayRdvs.length - 3}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── Vue semaine timeline ─────────────────────────

type Plage = { heure_debut: string; heure_fin: string };
type Conge = { id: string; date_debut: string; date_fin: string; libelle: string };
type Exception = { id: string; date: string; ferme: boolean; plages: Plage[]; type?: string };
type JourDispo = { jour_semaine: number; heure_debut: string; heure_fin: string };
type RdvConflict = { id: string; date_heure: string; clients: { prenom: string; nom: string; telephone: string | null } | null };

const PX_PAR_HEURE = 64;
const timeToMin = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1] || "0");
const minToTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Soustrait l'intervalle [a,b] (minutes) d'une liste de plages, renvoie les morceaux restants
function soustraireIntervalle(plages: Plage[], a: number, b: number): Plage[] {
  const out: Plage[] = [];
  for (const p of plages) {
    const pd = timeToMin(p.heure_debut), pf = timeToMin(p.heure_fin);
    if (pd < a) out.push({ heure_debut: minToTime(pd), heure_fin: minToTime(Math.min(pf, a)) });
    if (pf > b) out.push({ heure_debut: minToTime(Math.max(pd, b)), heure_fin: minToTime(pf) });
  }
  return out.filter(p => timeToMin(p.heure_fin) > timeToMin(p.heure_debut));
}

function VueSemaineTimeline({ salonId, weekDays, rdvs, couleur, today, router, onRdvChange }: {
  salonId: string;
  weekDays: Date[];
  rdvs: RDV[];
  couleur: string;
  today: string;
  router: ReturnType<typeof useRouter>;
  onRdvChange: () => void;
}) {
  const [dispos, setDispos] = useState<JourDispo[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Drag vertical (zone dans un jour) et horizontal (en-têtes, multi-jours)
  const [vDrag, setVDrag] = useState<{ col: number; startMin: number; curMin: number } | null>(null);
  const [hDrag, setHDrag] = useState<{ start: number; end: number } | null>(null);
  const didDrag = useRef(false);

  // Popup
  type ZonePopup = { kind: "zone"; col: number; dateStr: string; zDebut: number; zFin: number; isFullDay: boolean; conge: Conge | null; alreadyClosed: boolean; canReopen: boolean };
  type MultiPopup = { kind: "multi"; dates: string[]; anyClosed: boolean; canReopen: boolean };
  const [popup, setPopup] = useState<ZonePopup | MultiPopup | null>(null);
  const [popupMode, setPopupMode] = useState<"ferme" | "custom" | "open">("ferme");
  const [popupPlages, setPopupPlages] = useState<Plage[]>([{ heure_debut: "09:00", heure_fin: "12:00" }]);
  const [saving, setSaving] = useState(false);

  // Conflits RDV
  const [conflicts, setConflicts] = useState<RdvConflict[] | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const weekStartStr = toDateStr(weekDays[0]);
  const weekEndStr = toDateStr(weekDays[6]);

  const load = useCallback(async () => {
    const supabase = createSupabase();
    const [{ data: d }, { data: c }, { data: e }] = await Promise.all([
      supabase.from("disponibilites").select("jour_semaine,heure_debut,heure_fin").eq("salon_id", salonId),
      supabase.from("conges").select("*").eq("salon_id", salonId).lte("date_debut", weekEndStr).gte("date_fin", weekStartStr).order("date_debut"),
      supabase.from("disponibilites_exceptions").select("*").eq("salon_id", salonId).gte("date", weekStartStr).lte("date", weekEndStr),
    ]);
    setDispos((d || []) as JourDispo[]);
    setConges((c || []) as Conge[]);
    setExceptions((e || []) as Exception[]);
  }, [salonId, weekStartStr, weekEndStr]);

  useEffect(() => { load(); }, [load]);

  // ── Grille ──
  const disposParJour = weekDays.map((_, i) => dispos.find(d => d.jour_semaine === i) || null);
  const activeDispos = disposParJour.filter(Boolean) as JourDispo[];
  let grilleDebut = 8 * 60, grilleFin = 19 * 60;
  if (activeDispos.length > 0) {
    grilleDebut = Math.floor(Math.min(...activeDispos.map(d => timeToMin(d.heure_debut))) / 60) * 60;
    grilleFin = Math.ceil(Math.max(...activeDispos.map(d => timeToMin(d.heure_fin))) / 60) * 60;
  }
  const nbHeures = (grilleFin - grilleDebut) / 60;
  const heuresGrille = Array.from({ length: nbHeures + 1 }, (_, i) => grilleDebut / 60 + i);
  const totalHeight = nbHeures * PX_PAR_HEURE;

  function dayInfo(i: number) {
    const day = weekDays[i];
    const dateStr = toDateStr(day);
    const dispo = disposParJour[i];
    const conge = conges.find(c => c.date_debut <= dateStr && c.date_fin >= dateStr) || null;
    const exc = exceptions.find(e => e.date === dateStr) || null;
    const closed = !!conge || (!!exc && exc.ferme);
    const custom = exc && !exc.ferme && exc.plages.length > 0 ? exc.plages : null;
    return { day, dateStr, dispo, conge, exc, closed, custom };
  }

  function rdvsForDay(dateStr: string) {
    return rdvs.filter(r => r.date_heure.slice(0, 10) === dateStr);
  }

  // ── Conversion Y → minutes (snap 15 min) ──
  function yToMin(clientY: number) {
    const rect = bodyRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    const raw = grilleDebut + (y / PX_PAR_HEURE) * 60;
    const snapped = Math.round(raw / 15) * 15;
    return Math.max(grilleDebut, Math.min(grilleFin, snapped));
  }

  // ── Drag vertical (colonne jour) ──
  function onColPointerDown(e: React.PointerEvent, i: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    const m = yToMin(e.clientY);
    didDrag.current = false;
    setVDrag({ col: i, startMin: m, curMin: m });
  }

  function onContainerPointerMove(e: React.PointerEvent) {
    if (vDrag) {
      const m = yToMin(e.clientY);
      if (Math.abs(m - vDrag.startMin) >= 15) didDrag.current = true;
      setVDrag({ ...vDrag, curMin: m });
    } else if (hDrag) {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const colAttr = el?.closest("[data-col]")?.getAttribute("data-col");
      if (colAttr) setHDrag({ ...hDrag, end: parseInt(colAttr) });
    }
  }

  function finishDrag() {
    if (vDrag) {
      const col = vDrag.col;
      if (didDrag.current) {
        openZonePopup(col, Math.min(vDrag.startMin, vDrag.curMin), Math.max(vDrag.startMin, vDrag.curMin));
      } else {
        const heureStr = minToTime(vDrag.startMin);
        router.push(`/dashboard/agenda/nouveau?date=${toDateStr(weekDays[col])}&heure=${heureStr}`);
      }
      setVDrag(null);
    }
    if (hDrag) {
      openMultiPopup(Math.min(hDrag.start, hDrag.end), Math.max(hDrag.start, hDrag.end));
      setHDrag(null);
    }
  }

  function onHdrPointerDown(e: React.PointerEvent, i: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    setHDrag({ start: i, end: i });
  }

  function openZonePopup(col: number, zDebut: number, zFin: number) {
    const info = dayInfo(col);
    const baseDebut = info.dispo ? timeToMin(info.dispo.heure_debut) : grilleDebut;
    const baseFin = info.dispo ? timeToMin(info.dispo.heure_fin) : grilleFin;
    const isFullDay = zDebut <= baseDebut && zFin >= baseFin;
    const basePlages: Plage[] = info.custom
      ? info.custom
      : info.dispo ? [{ heure_debut: info.dispo.heure_debut, heure_fin: info.dispo.heure_fin }] : [];
    const restantes = soustraireIntervalle(basePlages, zDebut, zFin);
    setPopup({ kind: "zone", col, dateStr: info.dateStr, zDebut, zFin, isFullDay, conge: info.conge, alreadyClosed: info.closed, canReopen: !!info.exc || !!info.conge });
    setPopupMode(isFullDay ? "ferme" : "custom");
    setPopupPlages(restantes.length ? restantes : [{ heure_debut: minToTime(baseDebut), heure_fin: minToTime(baseFin) }]);
  }

  function openMultiPopup(lo: number, hi: number) {
    const dates = weekDays.slice(lo, hi + 1).map(toDateStr);
    const anyClosed = dates.some(ds => {
      const conge = conges.find(c => c.date_debut <= ds && c.date_fin >= ds);
      const exc = exceptions.find(e => e.date === ds);
      return !!conge || (!!exc && exc.ferme);
    });
    const canReopen = dates.some(ds => {
      const conge = conges.find(c => c.date_debut <= ds && c.date_fin >= ds);
      const exc = exceptions.find(e => e.date === ds);
      return !!conge || !!exc;
    });
    setPopup({ kind: "multi", dates, anyClosed, canReopen });
    setPopupMode(anyClosed ? "open" : "ferme");
  }

  // ── Sauvegarde ──
  async function post(body: object) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, ...body }),
    });
  }

  async function checkConflicts(dates: string[]): Promise<RdvConflict[]> {
    const res = await post({ action: "check_conflicts", dates });
    const json = await res.json();
    return (json.rdvs || []) as RdvConflict[];
  }

  async function savePopup() {
    if (!popup) return;
    setSaving(true);

    const doSave = async () => {
      if (popup.kind === "zone") {
        const date = popup.dateStr;
        // Si un congé couvre ce jour, on le supprime (réouverture)
        if (popup.conge) await post({ action: "delete_conge", id: popup.conge.id });
        const exc = exceptions.find(e => e.date === date);
        if (popupMode === "open") {
          if (exc) await post({ action: "delete_exception", id: exc.id });
        } else if (popupMode === "ferme") {
          await post({ action: "upsert_exception", date, ferme: true, plages: [] });
        } else {
          await post({ action: "upsert_exception", date, ferme: false, plages: popupPlages });
        }
      } else {
        const dates = popup.dates;
        if (popupMode === "open") {
          for (const ds of dates) {
            const exc = exceptions.find(e => e.date === ds);
            if (exc) await post({ action: "delete_exception", id: exc.id });
          }
          for (const c of conges) {
            if (c.date_debut <= dates[dates.length - 1] && c.date_fin >= dates[0]) {
              await post({ action: "delete_conge", id: c.id });
            }
          }
        } else if (dates.length === 1) {
          await post({ action: "upsert_exception", date: dates[0], ferme: true, plages: [] });
        } else {
          await post({ action: "add_conge", date_debut: dates[0], date_fin: dates[dates.length - 1], libelle: "Fermeture" });
        }
      }
      await load();
      onRdvChange();
      setPopup(null);
      setSaving(false);
    };

    // Vérif conflits RDV uniquement quand on ferme / réduit des créneaux
    if (popupMode !== "open") {
      const dates = popup.kind === "zone" ? [popup.dateStr] : popup.dates;
      let found = await checkConflicts(dates);
      // Pour une pause, ne garder que les RDV dans la zone retirée
      if (popup.kind === "zone" && popupMode === "custom") {
        found = found.filter(r => {
          const m = timeToMin(r.date_heure.slice(11, 16));
          return m >= popup.zDebut && m < popup.zFin;
        });
      }
      if (found.length > 0) {
        setConflicts(found);
        setPendingAction(() => doSave);
        setSaving(false);
        return;
      }
    }
    await doSave();
  }

  async function proceedWithConflicts() {
    if (pendingAction) { setSaving(true); await pendingAction(); }
    setConflicts(null);
    setPendingAction(null);
  }

  // ── Rendu ──
  const inHRange = (i: number) => hDrag !== null && i >= Math.min(hDrag.start, hDrag.end) && i <= Math.max(hDrag.start, hDrag.end);

  return (
    <div style={{ userSelect: "none", touchAction: "none" }}
      onPointerMove={onContainerPointerMove} onPointerUp={finishDrag} onPointerLeave={finishDrag}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e4e0", overflow: "clip", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* Header sticky */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid #ece8e4" }}>
          <div style={{ borderRight: "1px solid #ece8e4" }} />
          {weekDays.map((day, i) => {
            const isToday = toDateStr(day) === today;
            const info = dayInfo(i);
            const hasDispo = !!info.dispo;
            const selected = inHRange(i);
            return (
              <div key={i} data-col={i}
                onPointerDown={e => onHdrPointerDown(e, i)}
                title="Glissez sur les en-têtes pour fermer plusieurs jours"
                style={{ padding: "10px 12px 12px", textAlign: "center", borderRight: i < 6 ? "1px solid #ece8e4" : "none", cursor: "pointer", background: selected ? `${couleur}20` : info.closed ? "rgba(220,38,38,0.06)" : isToday ? `${couleur}08` : "transparent", opacity: hasDispo || info.custom || info.closed ? 1 : 0.45 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: isToday ? couleur : "#bbb", marginBottom: 6 }}>{JOURS[i]}</div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isToday ? couleur : "transparent", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                  <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : "#1a1a1a" }}>{day.getDate()}</span>
                </div>
                {info.closed && (
                  <div style={{ marginTop: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#dc2626" }}>
                    {info.conge ? "En congé" : "Fermé"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Corps */}
        <div ref={bodyRef} style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", height: totalHeight }}>
          {/* Colonne heures */}
          <div style={{ borderRight: "1px solid #ece8e4" }}>
            {heuresGrille.slice(0, -1).map(h => (
              <div key={h} style={{ height: PX_PAR_HEURE, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 10, paddingTop: 4 }}>
                <span style={{ fontSize: 10, color: "#c0bbb5", fontWeight: 500 }}>{h}h</span>
              </div>
            ))}
          </div>

          {/* 7 colonnes jours */}
          {weekDays.map((day, i) => {
            const isToday = toDateStr(day) === today;
            const info = dayInfo(i);
            const dayRdvs = rdvsForDay(info.dateStr);
            const baseDebut = info.dispo ? timeToMin(info.dispo.heure_debut) : null;
            const baseFin = info.dispo ? timeToMin(info.dispo.heure_fin) : null;

            // Zones fermées (gris) : complément des plages custom, ou hors-horaires de la dispo
            const zonesFermees: { top: number; height: number }[] = [];
            if (info.custom) {
              const plages = [...info.custom].sort((a, b) => timeToMin(a.heure_debut) - timeToMin(b.heure_debut));
              let cursor = grilleDebut;
              for (const p of plages) {
                const pd = timeToMin(p.heure_debut), pf = timeToMin(p.heure_fin);
                if (pd > cursor) zonesFermees.push({ top: (cursor - grilleDebut) / 60 * PX_PAR_HEURE, height: (pd - cursor) / 60 * PX_PAR_HEURE });
                cursor = Math.max(cursor, pf);
              }
              if (cursor < grilleFin) zonesFermees.push({ top: (cursor - grilleDebut) / 60 * PX_PAR_HEURE, height: (grilleFin - cursor) / 60 * PX_PAR_HEURE });
            } else if (info.dispo) {
              if (baseDebut! > grilleDebut) zonesFermees.push({ top: 0, height: (baseDebut! - grilleDebut) / 60 * PX_PAR_HEURE });
              if (baseFin! < grilleFin) zonesFermees.push({ top: (baseFin! - grilleDebut) / 60 * PX_PAR_HEURE, height: (grilleFin - baseFin!) / 60 * PX_PAR_HEURE });
            } else if (!info.closed) {
              zonesFermees.push({ top: 0, height: totalHeight });
            }

            const showSel = vDrag && vDrag.col === i;
            const selTop = showSel ? (Math.min(vDrag.startMin, vDrag.curMin) - grilleDebut) / 60 * PX_PAR_HEURE : 0;
            const selH = showSel ? Math.abs(vDrag.curMin - vDrag.startMin) / 60 * PX_PAR_HEURE : 0;

            return (
              <div key={i} data-col={i}
                onPointerDown={e => onColPointerDown(e, i)}
                style={{ position: "relative", borderRight: i < 6 ? "1px solid #ece8e4" : "none", background: isToday ? `${couleur}03` : "transparent", cursor: "pointer" }}>

                {/* Lignes d'heures */}
                {heuresGrille.map((_, hi) => (
                  <div key={hi} style={{ position: "absolute", top: hi * PX_PAR_HEURE, left: 0, right: 0, borderTop: "1px solid #f0ece8" }} />
                ))}

                {/* Zones fermées / hors horaires */}
                {zonesFermees.map((z, zi) => (
                  <div key={zi} style={{ position: "absolute", top: z.top, left: 0, right: 0, height: z.height, background: "rgba(0,0,0,0.035)" }} />
                ))}

                {/* Jour entièrement fermé : fond rouge + label */}
                {info.closed && (
                  <>
                    <div style={{ position: "absolute", inset: 0, background: "rgba(220,38,38,0.05)" }} />
                    <div style={{ position: "absolute", top: 6, left: 0, right: 0, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#dc2626", letterSpacing: "0.04em" }}>
                      {info.conge ? "En congé" : "Fermé"}
                    </div>
                  </>
                )}

                {/* Sélection en cours */}
                {showSel && selH > 0 && (
                  <div style={{ position: "absolute", top: selTop, left: 2, right: 2, height: selH, background: `${couleur}25`, border: `1.5px solid ${couleur}`, borderRadius: 5, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: couleur }}>
                      {minToTime(Math.min(vDrag.startMin, vDrag.curMin))} – {minToTime(Math.max(vDrag.startMin, vDrag.curMin))}
                    </span>
                  </div>
                )}

                {/* RDVs */}
                {dayRdvs.map(rdv => {
                  const rdvMin = timeToMin(rdv.date_heure.slice(11, 16));
                  const duree = rdv.duree_minutes || rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 30;
                  const prestaNoms = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                  const top = (rdvMin - grilleDebut) / 60 * PX_PAR_HEURE;
                  const height = Math.max(22, duree / 60 * PX_PAR_HEURE - 3);
                  return (
                    <div key={rdv.id}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); router.push(`/dashboard/agenda/${rdv.id}`); }}
                      style={{ position: "absolute", top, left: 3, right: 3, height, background: `${couleur}18`, borderLeft: `3px solid ${couleur}`, borderRadius: "0 5px 5px 0", padding: "3px 6px", cursor: "pointer", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", zIndex: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: couleur, lineHeight: 1.3 }}>{formatHeure(rdv.date_heure)}</div>
                      {height > 26 && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rdv.clients ? rdv.clients.prenom : "—"}
                        </div>
                      )}
                      {height > 44 && (
                        <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {prestaNoms}{duree ? ` · ${formatDuree(duree)}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Indice d'usage */}
      <p style={{ fontSize: 11, color: "#aaa", marginTop: 10, textAlign: "center" }}>
        Glissez verticalement dans un jour pour une pause ou une fermeture · Glissez sur les en-têtes pour fermer plusieurs jours
      </p>

      {/* POPUP zone / multi-jours */}
      {popup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onPointerDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) setPopup(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onPointerDown={e => e.stopPropagation()}>

            {popup.kind === "zone" ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, textTransform: "capitalize" }}>
                  {new Date(popup.dateStr + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
                  {popup.isFullDay ? "Journée entière" : `De ${minToTime(popup.zDebut)} à ${minToTime(popup.zFin)}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                  {popup.dates.length === 1
                    ? new Date(popup.dates[0] + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                    : `Du ${new Date(popup.dates[0] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${new Date(popup.dates[popup.dates.length - 1] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{popup.dates.length} jour{popup.dates.length > 1 ? "s" : ""}</div>
              </>
            )}

            {/* Avertissement congé existant */}
            {((popup.kind === "zone" && popup.alreadyClosed && popupMode !== "open") || (popup.kind === "multi" && popup.anyClosed && popupMode !== "open")) && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", marginBottom: 16, display: "flex", gap: 8 }}>
                <span style={{ fontSize: 15 }}>⚠️</span>
                <p style={{ fontSize: 12, color: "#9a3412", margin: 0, lineHeight: 1.5 }}>
                  Ce jour est en congé. Confirmer supprime ce congé et rouvre vos réservations ce jour.
                </p>
              </div>
            )}

            {/* Choix du mode */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {(popup.kind === "zone" && !popup.isFullDay
                ? [{ v: "custom", label: "Ajouter une pause", desc: "Le créneau sélectionné devient indisponible" }, { v: "ferme", label: "Fermer toute la journée", desc: "Salon fermé ce jour" }, { v: "open", label: "Réouvrir (horaires habituels)", desc: "Retirer toute fermeture ce jour" }]
                : [{ v: "ferme", label: popup.kind === "multi" && popup.dates.length > 1 ? "Fermer ces jours" : "Fermer toute la journée", desc: "Salon fermé" }, { v: "open", label: "Réouvrir (horaires habituels)", desc: "Retirer congés et fermetures" }]
              ).map(opt => {
                const disabled = opt.v === "open" && !popup.canReopen;
                return (
                  <label key={opt.v} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: `1.5px solid ${popupMode === opt.v ? couleur : "#e0e0e0"}`, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", background: popupMode === opt.v ? `${couleur}08` : "#fff", opacity: disabled ? 0.4 : 1 }}>
                    <input type="radio" checked={popupMode === opt.v} disabled={disabled} onChange={() => setPopupMode(opt.v as typeof popupMode)} style={{ marginTop: 2, accentColor: couleur }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: opt.v === "ferme" ? "#dc2626" : opt.v === "custom" ? "#2563eb" : "#1a1a1a" }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: "#999" }}>{disabled ? "Aucune fermeture à retirer ce jour" : opt.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Horaires d'ouverture résultants (mode pause) */}
            {popup.kind === "zone" && popupMode === "custom" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 8 }}>HORAIRES D'OUVERTURE CE JOUR</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {popupPlages.map((plage, pi) => (
                    <div key={pi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="time" value={plage.heure_debut} onChange={e => setPopupPlages(ps => ps.map((p, idx) => idx === pi ? { ...p, heure_debut: e.target.value } : p))} style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13 }} />
                      <span style={{ color: "#bbb", fontSize: 12 }}>→</span>
                      <input type="time" value={plage.heure_fin} onChange={e => setPopupPlages(ps => ps.map((p, idx) => idx === pi ? { ...p, heure_fin: e.target.value } : p))} style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13 }} />
                      {popupPlages.length > 1 && (
                        <button onClick={() => setPopupPlages(ps => ps.filter((_, idx) => idx !== pi))} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPopupPlages(ps => [...ps, { heure_debut: "14:00", heure_fin: "18:00" }])} style={{ alignSelf: "flex-start", fontSize: 12, color: couleur, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Ajouter un créneau</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPopup(null)} style={{ flex: 1, padding: "10px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={savePopup} disabled={saving} style={{ flex: 2, padding: "10px", background: couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP conflits RDV */}
      {conflicts && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onPointerDown={e => e.stopPropagation()}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{conflicts.length} rendez-vous sur ce créneau</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 240, overflowY: "auto" }}>
              {conflicts.map(rdv => {
                const dt = new Date(rdv.date_heure);
                return (
                  <div key={rdv.id} style={{ padding: "8px 12px", background: "#fff8f8", borderRadius: 8, border: "1px solid #fee2e2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{rdv.clients?.prenom} {rdv.clients?.nom}</span>
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} {dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {rdv.clients?.telephone && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>📞 {rdv.clients.telephone}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Ces rendez-vous ne seront pas annulés. Pensez à contacter ces clients.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setConflicts(null); setPendingAction(null); }} style={{ flex: 1, padding: "10px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={proceedWithConflicts} disabled={saving} style={{ flex: 1, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>Fermer quand même</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "6px 12px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 7, cursor: "pointer", fontSize: 16, color: "#555" };

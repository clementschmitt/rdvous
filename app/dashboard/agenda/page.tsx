"use client";
import { useEffect, useState, useCallback } from "react";
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
  const [dispos, setDispos] = useState<{jour_semaine: number; heure_debut: string; heure_fin: string}[]>([]);

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

  useEffect(() => {
    if (!salon) return;
    const supabase = createSupabase();
    supabase.from("disponibilites")
      .select("jour_semaine, heure_debut, heure_fin")
      .eq("salon_id", salon.id)
      .then(({ data }) => setDispos((data || []) as {jour_semaine: number; heure_debut: string; heure_fin: string}[]));
  }, [salon]);

  if (!salon) return null;
  const m = METIERS[salon.metier];
  const today = toDateStr(new Date());

  const rdvsForDay = (day: Date) => rdvs.filter(r => r.date_heure.slice(0, 10) === toDateStr(day));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(semaine, i));

  const PX_PAR_HEURE = 64;
  const timeToMin = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1] || "0");

  const disposParJour = weekDays.map((_, i) => dispos.find(d => d.jour_semaine === i) || null);
  const activeDispos = disposParJour.filter(Boolean) as {jour_semaine: number; heure_debut: string; heure_fin: string}[];

  let grilleDebut = 8 * 60;
  let grilleFin = 19 * 60;
  if (activeDispos.length > 0) {
    grilleDebut = Math.floor(Math.min(...activeDispos.map(d => timeToMin(d.heure_debut))) / 60) * 60;
    grilleFin = Math.ceil(Math.max(...activeDispos.map(d => timeToMin(d.heure_fin))) / 60) * 60;
  }

  const nbHeures = (grilleFin - grilleDebut) / 60;
  const heuresGrille = Array.from({ length: nbHeures + 1 }, (_, i) => grilleDebut / 60 + i);
  const totalHeight = nbHeures * PX_PAR_HEURE;

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
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e4e0", overflow: "clip", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {/* Header sticky — même grille que le corps */}
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid #ece8e4" }}>
              <div style={{ borderRight: "1px solid #ece8e4" }} />
              {weekDays.map((day, i) => {
                const isToday = toDateStr(day) === today;
                const hasDispo = !!disposParJour[i];
                return (
                  <div key={i} style={{ padding: "14px 12px", textAlign: "center", borderRight: i < 6 ? "1px solid #ece8e4" : "none", background: isToday ? `${m.couleur}08` : "transparent", opacity: hasDispo ? 1 : 0.45 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: isToday ? m.couleur : "#bbb", marginBottom: 6 }}>{JOURS[i]}</div>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: isToday ? m.couleur : "transparent", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                      <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : "#1a1a1a" }}>{day.getDate()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Corps — même grille que le header */}
            <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", height: totalHeight }}>
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
                const dispo = disposParJour[i];
                const dayRdvs = rdvsForDay(day);
                const dispoDebutMin = dispo ? timeToMin(dispo.heure_debut) : null;
                const dispoFinMin = dispo ? timeToMin(dispo.heure_fin) : null;

                return (
                  <div key={i}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const totalMin = grilleDebut + Math.round((y / PX_PAR_HEURE) * 2) * 30;
                      const h = Math.floor(totalMin / 60);
                      const min = totalMin % 60;
                      const heureStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                      router.push(`/dashboard/agenda/nouveau?date=${toDateStr(day)}&heure=${heureStr}`);
                    }}
                    style={{ position: "relative", borderRight: i < 6 ? "1px solid #ece8e4" : "none", background: isToday ? `${m.couleur}03` : "transparent", cursor: "pointer" }}>

                    {/* Lignes séparatrices d'heures */}
                    {heuresGrille.map((_, hi) => (
                      <div key={hi} style={{ position: "absolute", top: hi * PX_PAR_HEURE, left: 0, right: 0, borderTop: "1px solid #f0ece8" }} />
                    ))}

                    {/* Zones hors horaires */}
                    {dispo && dispoDebutMin !== null && dispoDebutMin > grilleDebut && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: (dispoDebutMin - grilleDebut) / 60 * PX_PAR_HEURE, background: "rgba(0,0,0,0.03)" }} />
                    )}
                    {dispo && dispoFinMin !== null && dispoFinMin < grilleFin && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: (grilleFin - dispoFinMin) / 60 * PX_PAR_HEURE, background: "rgba(0,0,0,0.03)" }} />
                    )}
                    {!dispo && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.025)" }} />
                    )}

                    {/* RDVs positionnés */}
                    {dayRdvs.map(rdv => {
                      const rdvMin = timeToMin(rdv.date_heure.slice(11, 16));
                      const duree = rdv.duree_minutes || rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 30;
                      const prestaNoms = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                      const top = (rdvMin - grilleDebut) / 60 * PX_PAR_HEURE;
                      const height = Math.max(22, duree / 60 * PX_PAR_HEURE - 3);

                      return (
                        <div key={rdv.id}
                          onClick={e => { e.stopPropagation(); router.push(`/dashboard/agenda/${rdv.id}`); }}
                          style={{ position: "absolute", top, left: 3, right: 3, height, background: `${m.couleur}18`, borderLeft: `3px solid ${m.couleur}`, borderRadius: "0 5px 5px 0", padding: "3px 6px", cursor: "pointer", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: m.couleur, lineHeight: 1.3 }}>{formatHeure(rdv.date_heure)}</div>
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

const navBtn: React.CSSProperties = { padding: "6px 12px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 7, cursor: "pointer", fontSize: 16, color: "#555" };

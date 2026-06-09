"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createSupabase } from "@/lib/supabase";

type Plage = { heure_debut: string; heure_fin: string };
type Conge = { id: string; date_debut: string; date_fin: string; libelle: string };
type Exception = { id: string; date: string; ferme: boolean; plages: Plage[]; type?: string };
type JourDispo = { jour_semaine: number; heure_debut: string; heure_fin: string };
type RdvConflict = {
  id: string; date_heure: string;
  clients: { prenom: string; nom: string; telephone: string | null; email: string | null } | null;
  rendez_vous_prestations: { prestations: { nom: string } | null }[];
};

type DayStatus = "open" | "closed-exception" | "closed-conge" | "custom" | "not-worked" | "past";

const JOURS_LABELS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function sortDates(a: string, b: string) { return a < b ? [a, b] : [b, a]; }

function getDatesInRange(start: string, end: string): string[] {
  const [s, e] = sortDates(start, end);
  const dates: string[] = [];
  let cur = s;
  while (cur <= e) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}

export default function DisponibilitesCalendrier({
  salonId, couleur, salonNom,
  onReload,
}: {
  salonId: string; couleur: string; salonNom: string; onReload?: () => void;
}) {
  const today = isoDate(new Date());
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [conges, setConges] = useState<Conge[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [dispos, setDispos] = useState<JourDispo[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const isDragging = useRef(false);

  // Popup
  type PopupState = { dates: string[]; single: boolean } | null;
  const [popup, setPopup] = useState<PopupState>(null);
  const [popupFerme, setPopupFerme] = useState(true);
  const [popupPlages, setPopupPlages] = useState<Plage[]>([{ heure_debut: "09:00", heure_fin: "18:00" }]);
  const [popupMode, setPopupMode] = useState<"ferme" | "custom" | "open">("ferme");
  const [saving, setSaving] = useState(false);

  // Conflicts
  const [conflicts, setConflicts] = useState<RdvConflict[] | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabase();
    const todayStr = today;
    const [{ data: d }, { data: c }, { data: e }] = await Promise.all([
      supabase.from("disponibilites").select("jour_semaine,heure_debut,heure_fin").eq("salon_id", salonId),
      supabase.from("conges").select("*").eq("salon_id", salonId).gte("date_fin", todayStr).order("date_debut"),
      supabase.from("disponibilites_exceptions").select("*").eq("salon_id", salonId).gte("date", todayStr).order("date"),
    ]);
    setDispos((d || []) as JourDispo[]);
    setConges((c || []) as Conge[]);
    setExceptions((e || []) as Exception[]);
    setLoading(false);
  }, [salonId, today]);

  useEffect(() => { load(); }, [load]);

  function getDayStatus(date: string): DayStatus {
    if (date < today) return "past";
    const dow = (new Date(date + "T12:00:00").getDay() + 6) % 7;
    const worked = dispos.some(d => d.jour_semaine === dow);
    const inConge = conges.some(c => c.date_debut <= date && c.date_fin >= date);
    if (inConge) return "closed-conge";
    const exc = exceptions.find(e => e.date === date);
    if (exc) return exc.ferme ? "closed-exception" : "custom";
    if (!worked) return "not-worked";
    return "open";
  }

  function getDayStyle(status: DayStatus, isInDrag: boolean): React.CSSProperties {
    const base: React.CSSProperties = {
      width: "100%", aspectRatio: "1", borderRadius: 8, cursor: status === "past" ? "default" : "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 600, userSelect: "none", transition: "all 0.1s", position: "relative",
      border: "2px solid transparent",
    };
    if (isInDrag) return { ...base, background: couleur + "30", border: `2px solid ${couleur}`, color: couleur };
    switch (status) {
      case "past":         return { ...base, background: "repeating-linear-gradient(135deg, #f5f5f5 0px, #f5f5f5 4px, #ebebeb 4px, #ebebeb 8px)", color: "#ccc", cursor: "default" };
      case "not-worked":   return { ...base, background: "#f9f9f9", color: "#ccc" };
      case "open":         return { ...base, background: "#fff", color: "#1a1a1a", border: "2px solid #f0f0f0" };
      case "closed-conge": return { ...base, background: "#fee2e2", color: "#dc2626" };
      case "closed-exception": return { ...base, background: "#fecaca", color: "#dc2626" };
      case "custom":       return { ...base, background: "#eff6ff", color: "#2563eb" };
    }
  }

  function getDayIcon(status: DayStatus) {
    switch (status) {
      case "closed-conge":     return <span style={{ fontSize: 10, marginTop: 1 }}>✕</span>;
      case "closed-exception": return <span style={{ fontSize: 10, marginTop: 1 }}>✕</span>;
      case "custom":           return <span style={{ fontSize: 8, marginTop: 1, width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "block" }} />;
      default: return null;
    }
  }

  // Build calendar grid
  function buildGrid() {
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // 0=lundi
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function getDragRange(): Set<string> {
    if (!dragStart || !dragEnd) return new Set();
    return new Set(getDatesInRange(dragStart, dragEnd));
  }

  function handleMouseDown(date: string) {
    if (date < today) return;
    isDragging.current = true;
    setDragStart(date);
    setDragEnd(date);
  }

  function handleMouseEnter(date: string) {
    if (!isDragging.current || date < today) return;
    setDragEnd(date);
  }

  function handleMouseUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!dragStart || !dragEnd) return;
    const [s, e] = sortDates(dragStart, dragEnd);
    const dates = getDatesInRange(s, e).filter(d => d >= today);
    if (dates.length === 0) { setDragStart(null); setDragEnd(null); return; }
    openPopup(dates, dates.length === 1);
    setDragStart(null); setDragEnd(null);
  }

  function openPopup(dates: string[], single: boolean) {
    const status = getDayStatus(dates[0]);
    if (status === "custom") {
      const exc = exceptions.find(e => e.date === dates[0]);
      setPopupPlages(exc?.plages.length ? exc.plages : [{ heure_debut: "09:00", heure_fin: "18:00" }]);
      setPopupMode("custom");
    } else if (status === "closed-conge" || status === "closed-exception") {
      setPopupMode("open");
    } else {
      setPopupMode("ferme");
    }
    setPopup({ dates, single });
  }

  async function checkConflictsAndSave(dates: string[], saveFn: () => Promise<void>) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, action: "check_conflicts", dates }),
    });
    const json = await res.json();
    if (json.rdvs && json.rdvs.length > 0) {
      setConflicts(json.rdvs);
      setPendingAction(() => saveFn);
    } else {
      await saveFn();
    }
  }

  async function savePopup() {
    if (!popup) return;
    setSaving(true);
    const dates = popup.dates.filter(d => d >= today);

    const doSave = async () => {
      const supabase = createSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const post = (body: object) => fetch("/api/disponibilites", {
        method: "POST",
        headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ salon_id: salonId, ...body }),
      });

      if (popupMode === "open") {
        for (const date of dates) {
          const exc = exceptions.find(e => e.date === date);
          if (exc) await post({ action: "delete_exception", id: exc.id });
        }
        const sorted = [...dates].sort();
        const first = sorted[0], last = sorted[sorted.length - 1];
        for (const c of conges) {
          if (c.date_debut <= last && c.date_fin >= first) {
            await post({ action: "delete_conge", id: c.id });
          }
        }
      } else if (popupMode === "ferme") {
        if (dates.length === 1) {
          await post({ action: "upsert_exception", date: dates[0], ferme: true, plages: [] });
        } else {
          // Multi-day: save as conge
          const [s, e] = sortDates(dates[0], dates[dates.length - 1]);
          await post({ action: "add_conge", date_debut: s, date_fin: e, libelle: "Fermeture" });
        }
      } else if (popupMode === "custom") {
        // Save exception for each date
        if (dates.length === 1) {
          await post({ action: "upsert_exception", date: dates[0], ferme: false, plages: popupPlages });
        } else {
          const exceptions = dates.map(date => ({ date, ferme: false, plages: popupPlages }));
          await post({ action: "upsert_exceptions_bulk", exceptions });
        }
      }
      await load();
      setPopup(null);
      onReload?.();
    };

    if (popupMode === "ferme") {
      await checkConflictsAndSave(dates, doSave);
    } else {
      await doSave();
    }
    setSaving(false);
  }

  async function deleteConge(id: string) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, action: "delete_conge", id }),
    });
    await load();
  }

  async function deleteException(id: string) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, action: "delete_exception", id }),
    });
    await load();
  }

  async function doCancelRdvs() {
    if (!conflicts) return;
    setCancelling(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, action: "annuler_rdvs_bulk", rdv_ids: conflicts.map(r => r.id) }),
    });
    if (pendingAction) await pendingAction();
    setConflicts(null); setPendingAction(null); setConfirmCancel(false); setCancelling(false);
  }

  async function proceedWithoutCancel() {
    if (pendingAction) await pendingAction();
    setConflicts(null); setPendingAction(null); setConfirmCancel(false);
  }

  const grid = buildGrid();
  const dragRange = getDragRange();

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };


  const LEGENDE = [
    { bg: "#fff",    border: "#d0d0d0", text: "#555",    icon: null, label: "Ouvert" },
    { bg: "#f0f0f0", border: "#e0e0e0", text: "#bbb",    icon: null, label: "Non travaillé" },
    { bg: "#fee2e2", border: "#fca5a5", text: "#dc2626", icon: "✕",  label: "Congé / Fermeture" },
    { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb", icon: "●",  label: "Horaires personnalisés" },
    { bg: "#fff",    border: couleur,   text: couleur,   icon: null, label: "Aujourd'hui", ring: true as const },
  ];

  return (
    <div style={{ userSelect: "none" }} onPointerUp={handleMouseUp} onPointerLeave={handleMouseUp}>
      <style>{`
        .dispo-layout { display: flex; gap: 20px; align-items: flex-start; }
        .dispo-legende { display: flex; flex-direction: column; gap: 6px; padding-top: 52px; flex-shrink: 0; }
        @media (max-width: 640px) {
          .dispo-layout { flex-direction: column; gap: 12px; }
          .dispo-legende { padding-top: 0; flex-direction: row; flex-wrap: wrap; gap: 6px; }
        }
      `}</style>
      <div className="dispo-layout">

        {/* Calendrier */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 7, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>{MOIS[month]} {year}</span>
            <button onClick={nextMonth} style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 7, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          {/* Jours de la semaine */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {JOURS_LABELS.map(j => (
              <div key={j} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#bbb", padding: "4px 0" }}>{j}</div>
            ))}
          </div>

          {/* Grille des jours */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#bbb", fontSize: 13 }}>Chargement…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, touchAction: "none" }}
              onPointerMove={(e) => {
                if (!isDragging.current) return;
                const target = document.elementFromPoint(e.clientX, e.clientY);
                const date = (target as HTMLElement)?.closest("[data-date]")?.getAttribute("data-date");
                if (date && date >= today) setDragEnd(date);
              }}
            >
              {grid.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} />;
                const status = getDayStatus(date);
                const inDrag = dragRange.has(date);
                const dayNum = parseInt(date.slice(8));
                const isToday = date === today;
                const exc = status === "custom" ? exceptions.find(e => e.date === date) : null;
                return (
                  <div
                    key={date}
                    data-date={date}
                    style={{ ...getDayStyle(status, inDrag), ...(isToday ? { boxShadow: `0 0 0 2px ${couleur}` } : {}) }}
                    onPointerDown={() => handleMouseDown(date)}
                  >
                    <span>{dayNum}</span>
                    {exc ? (
                      <span style={{ fontSize: 9, lineHeight: 1.2, color: "#2563eb", fontWeight: 600, textAlign: "center", marginTop: 1 }}>
                        {exc.plages.map((p, i) => <span key={i} style={{ display: "block" }}>{p.heure_debut}–{p.heure_fin}</span>)}
                      </span>
                    ) : getDayIcon(status)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Légende verticale à droite */}
        <div className="dispo-legende">
          <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Légende</div>
          {LEGENDE.map(({ bg, border, text, icon, label, ring }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: bg,
                border: `2px solid ${border}`,
                boxShadow: ring ? `0 0 0 2px ${couleur}40` : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: text, fontWeight: 700, flexShrink: 0,
              }}>
                {icon === "●" ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: text, display: "block" }} /> : icon}
              </div>
              <span style={{ fontSize: 12, color: "#555", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
            </div>
          ))}
        </div>

      </div>


      {/* POPUP choix jour/période */}
      {popup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {popup.single
                ? new Date(popup.dates[0] + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                : `Du ${new Date(popup.dates[0] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${new Date(popup.dates[popup.dates.length - 1] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
              }
            </div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>{popup.dates.length} jour{popup.dates.length > 1 ? "s" : ""}</div>

            {(() => {
              const sorted = [...popup.dates].sort();
              const affectedConge = conges.find(c => c.date_debut <= sorted[sorted.length - 1] && c.date_fin >= sorted[0]);
              const openDesc = affectedConge
                ? `Supprimer "${affectedConge.libelle || "ce congé"}" (${new Date(affectedConge.date_debut + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(affectedConge.date_fin + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })})`
                : "Supprimer les exceptions existantes";
              const opts = [
                { value: "open", label: "Horaires habituels", desc: openDesc, color: "#1a1a1a" },
                { value: "ferme", label: "Fermé", desc: popup.dates.length > 1 ? "Ajouter une période de fermeture" : "Fermé exceptionnellement ce jour", color: "#dc2626" },
                { value: "custom", label: "Horaires personnalisés", desc: "Définir des créneaux spécifiques", color: "#2563eb" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {opts.map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: `1.5px solid ${popupMode === opt.value ? couleur : "#e0e0e0"}`, borderRadius: 8, cursor: "pointer", background: popupMode === opt.value ? couleur + "08" : "#fff" }}>
                      <input type="radio" name="popupMode" value={opt.value} checked={popupMode === opt.value} onChange={() => setPopupMode(opt.value as typeof popupMode)} style={{ marginTop: 2, accentColor: couleur }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: opt.color }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: "#999" }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })()}


            {popupMode === "custom" && (
              <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {popupPlages.map((plage, pi) => (
                  <div key={pi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="time" value={plage.heure_debut}
                      onChange={e => setPopupPlages(ps => ps.map((p, i) => i === pi ? { ...p, heure_debut: e.target.value } : p))}
                      style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13 }} />
                    <span style={{ color: "#bbb", fontSize: 12 }}>→</span>
                    <input type="time" value={plage.heure_fin}
                      onChange={e => setPopupPlages(ps => ps.map((p, i) => i === pi ? { ...p, heure_fin: e.target.value } : p))}
                      style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13 }} />
                    {popupPlages.length > 1 && (
                      <button onClick={() => setPopupPlages(ps => ps.filter((_, i) => i !== pi))}
                        style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setPopupPlages(ps => [...ps, { heure_debut: "14:00", heure_fin: "18:00" }])}
                  style={{ alignSelf: "flex-start", fontSize: 12, color: couleur, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  + Ajouter un créneau
                </button>
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
      {conflicts && !confirmCancel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{conflicts.length} rendez-vous déjà pris sur cette période</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, maxHeight: 240, overflowY: "auto" }}>
              {conflicts.map(rdv => {
                const dt = new Date(rdv.date_heure);
                const dateStr = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                const heureStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const client = rdv.clients;
                return (
                  <div key={rdv.id} style={{ padding: "8px 12px", background: "#fff8f8", borderRadius: 8, border: "1px solid #fee2e2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{client?.prenom} {client?.nom}</span>
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{dateStr} {heureStr}</span>
                    </div>
                    {client?.telephone && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>📞 {client.telephone}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Ces rendez-vous ne seront pas annulés automatiquement. Vous devez contacter ces clients.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={proceedWithoutCancel} style={{ flex: 1, padding: "10px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Fermer sans annuler
              </button>
              <button onClick={() => setConfirmCancel(true)} style={{ flex: 1, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Annuler ces rendez-vous
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP double confirmation annulation */}
      {confirmCancel && conflicts && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 24, textAlign: "center", marginBottom: 12 }}>⛔</div>
            <div style={{ fontWeight: 700, fontSize: 16, textAlign: "center", marginBottom: 8 }}>Action irrémédiable</div>
            <div style={{ fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
              Vous êtes sur le point d'annuler <strong>{conflicts.length} rendez-vous</strong>. Un email de confirmation d'annulation sera envoyé à chaque client. Cette action est définitive.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: "10px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Non, revenir
              </button>
              <button onClick={doCancelRdvs} disabled={cancelling} style={{ flex: 1, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: cancelling ? 0.7 : 1 }}>
                {cancelling ? "Annulation…" : "Oui, annuler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

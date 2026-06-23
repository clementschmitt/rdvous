"use client";
import { useState, useEffect } from "react";
import { formatPrix } from "@/lib/prix";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; sur_devis?: boolean; categorie_id?: string | null; description?: string | null };
type Category = { id: string; nom: string; selection_type: "unique" | "multiple" | "libre" };
type Slot = { date: string; heure: string };

function formatDuree(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m} min` : m ? `${h}h${m}` : `${h}h`;
}
function addDays(base: Date, n: number) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
function toISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function getMondayOfWeek(offset: number) {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = addDays(now, diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function BookingWidget({
  salonId, prestations, categories = [], dispos = [], couleur, deplacement, delaiMinHeures = 0, planningHorizonJours = 0, planningOuvertureMode = "horizon", planningOuvertureJour = 23, salonTel, modeReservation = "menu",
}: {
  salonId: string;
  prestations: Prestation[];
  categories?: Category[];
  dispos?: { jour_semaine: number; heure_debut: string; heure_fin: string }[];
  couleur: string;
  deplacement?: string;
  delaiMinHeures?: number;
  planningHorizonJours?: number;
  planningOuvertureMode?: string;
  planningOuvertureJour?: number;
  salonTel?: string;
  modeReservation?: "menu" | "guide";
}) {
  const heureOuvMin = dispos.length > 0 ? dispos.reduce((min, d) => d.heure_debut < min ? d.heure_debut : min, dispos[0].heure_debut) : "08:00";
  const heureOuvMax = dispos.length > 0 ? dispos.reduce((max, d) => d.heure_fin > max ? d.heure_fin : max, dispos[0].heure_fin) : "20:00";
  const [startH, startM] = heureOuvMin.split(":").map(Number);
  const [endH, endM] = heureOuvMax.split(":").map(Number);
  const startSlot = startH * 2 + (startM >= 30 ? 1 : 0);
  const endSlot = endH * 2 + (endM >= 30 ? 1 : 0);
  const CRENEAUX = Array.from({ length: endSlot - startSlot + 1 }, (_, i) => { const total = startSlot + i; return `${String(Math.floor(total / 2)).padStart(2, "0")}:${total % 2 === 0 ? "00" : "30"}`; });
  const [step, setStep] = useState<"select" | "contact" | "done" | "waitlist" | "waitlist_done">("select");
  const [selected, setSelected] = useState<Prestation[]>([]);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [confirmedSteps, setConfirmedSteps] = useState<Set<string>>(new Set());
  const [weekOffset, setWeekOffset] = useState(0);
  const [slotsMap, setSlotsMap] = useState<Record<string, string[]>>({});
  const [blockedMap, setBlockedMap] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [choix, setChoix] = useState<Slot | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [wantsDomicile, setWantsDomicile] = useState(deplacement === "uniquement");
  const [adresseDomicile, setAdresseDomicile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  const [waitlistDate, setWaitlistDate] = useState("");
  const [wlHeureDebut, setWlHeureDebut] = useState("");
  const [wlHeureFin, setWlHeureFin] = useState("");
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [wlError, setWlError] = useState("");
  const [openDesc, setOpenDesc] = useState<Set<string>>(new Set());
  const toggleDesc = (id: string) => setOpenDesc(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const toggleCat = (id: string) => setOpenCats(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Mode menu : pas d'étapes, toutes les prestations groupées en sélection libre (type Planity)
  const isMenu = modeReservation === "menu";
  // Catégories dans le stepper = unique + multiple (dans l'ordre) — désactivé en mode menu
  const stepCategories = isMenu ? [] : categories.filter(c => c.selection_type === "unique" || c.selection_type === "multiple");
  const libreCategories = categories.filter(c => c.selection_type === "libre");
  const hasSteps = stepCategories.length > 0;

  function isConfirmed(cat: Category): boolean {
    if (cat.selection_type === "unique") return selected.some(p => p.categorie_id === cat.id);
    if (cat.selection_type === "multiple") return confirmedSteps.has(cat.id);
    return false;
  }

  const allStepsCompleted = stepCategories.every(isConfirmed);
  const canShowCalendar = hasSteps ? allStepsCompleted : selected.length > 0;

  const dureeTotal = selected.reduce((s, p) => s + p.duree_minutes, 0);
  const tarifTotal = selected.reduce((s, p) => s + p.tarif, 0);
  const hasSurDevis = selected.some(p => p.sur_devis);
  const monday = getMondayOfWeek(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = toISO(new Date());
  let maxDate: string | null = null;
  if (planningOuvertureMode === "date_fixe") {
    const today = new Date();
    const currentDay = today.getDate();
    let targetYear = today.getFullYear();
    let targetMonth = today.getMonth();
    if (currentDay >= planningOuvertureJour) {
      targetMonth += 1;
      if (targetMonth > 11) { targetMonth = 0; targetYear++; }
    }
    maxDate = toISO(new Date(targetYear, targetMonth + 1, 0));
  } else if (planningHorizonJours > 0) {
    maxDate = toISO(addDays(new Date(), planningHorizonJours));
  }
  let ouvertureInfo: string | null = null;
  if (planningOuvertureMode === "date_fixe" && maxDate) {
    const maxDateObj = new Date(maxDate + "T12:00:00");
    const nextMonthName = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth() + 1, 1).toLocaleDateString("fr-FR", { month: "long" });
    const openingDate = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), planningOuvertureJour).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    ouvertureInfo = `Les réservations pour ${nextMonthName} s'ouvrent le ${openingDate}.`;
  }
  const atMaxWeek = maxDate ? toISO(addDays(monday, 7)) > maxDate : false;

  useEffect(() => {
    if (stepCategories.length > 0 && !openStepId) setOpenStepId(stepCategories[0].id);
  }, [categories.length]);

  useEffect(() => {
    if (!canShowCalendar) { setSlotsMap({}); setSelectedDay(null); return; }
    loadWeekSlots();
  }, [selected, confirmedSteps, weekOffset]);

  function advanceAfter(cat: Category, newSelected: Prestation[], newConfirmed: Set<string>) {
    const currentIdx = stepCategories.findIndex(c => c.id === cat.id);
    const nextStep = stepCategories.slice(currentIdx + 1).find(c => {
      if (c.selection_type === "unique") return !newSelected.some(p => p.categorie_id === c.id);
      return !newConfirmed.has(c.id);
    });
    setOpenStepId(nextStep?.id || null);
  }

  function selectUnique(cat: Category, p: Prestation) {
    const next = [...selected.filter(s => s.categorie_id !== cat.id), p];
    setSelected(next);
    advanceAfter(cat, next, confirmedSteps);
  }

  function toggleInStep(p: Prestation) {
    setSelected(s => s.find(x => x.id === p.id) ? s.filter(x => x.id !== p.id) : [...s, p]);
  }

  function confirmMultiple(cat: Category) {
    const next = new Set([...confirmedSteps, cat.id]);
    setConfirmedSteps(next);
    advanceAfter(cat, selected, next);
  }

  function modifyStep(cat: Category) {
    setSelected(s => s.filter(p => p.categorie_id !== cat.id));
    if (cat.selection_type === "multiple") {
      setConfirmedSteps(s => { const n = new Set(s); n.delete(cat.id); return n; });
    }
    setOpenStepId(cat.id);
    setSlotsMap({}); setSelectedDay(null); setChoix(null);
  }

  function toggleLibre(p: Prestation) {
    setSelected(s => s.find(x => x.id === p.id) ? s.filter(x => x.id !== p.id) : [...s, p]);
  }

  async function loadWeekSlots() {
    setLoadingSlots(true); setChoix(null);
    const results = await Promise.all(weekDays.map(d => {
      const iso = toISO(d);
      return fetch(`/api/booking/slots?salon_id=${salonId}&date=${iso}&duree=${dureeTotal}`)
        .then(r => r.json()).then(j => ({ date: iso, slots: (j.slots || []) as string[], blocked: (j.blocked || []) as string[] }));
    }));
    const map: Record<string, string[]> = {};
    const bmap: Record<string, string[]> = {};
    results.forEach(r => { map[r.date] = r.slots; bmap[r.date] = r.blocked; });
    setBlockedMap(bmap);
    setSlotsMap(map); setLoadingSlots(false);
    const first = results.find(r => r.date >= today && r.slots.length > 0);
    setSelectedDay(first ? first.date : null);
  }

  async function handleSubmit() {
    if (selected.length === 0) { setError("Veuillez sélectionner au moins une prestation."); return; }
    if (!prenom.trim() || !nom.trim()) { setError("Prénom et nom requis."); return; }
    if (!email.trim()) { setError("Email requis."); return; }
    if (!/^[a-zA-Z0-9_%+\-]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9_%+\-])?@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}$/.test(email) || email.includes("..")) { setError("Adresse email invalide."); return; }
    if (!telephone.trim()) { setError("Téléphone requis."); return; }
    if (!choix) { setError("Veuillez choisir un créneau."); return; }
    if (wantsDomicile && (adresseDomicile.trim().length < 15 || !/\b\d{5}[\s,]+[a-zA-ZÀ-ÿ]/.test(adresseDomicile))) { setError("Adresse incomplète — indiquez la rue, le code postal et la ville (ex: 12 rue des Lilas, 75011 Paris)."); return; }
    setError(""); setSubmitting(true);
    const res = await fetch("/api/booking/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, prestation_ids: selected.map(p => p.id), date: choix.date, heure: choix.heure, prenom, nom, email, telephone, adresse_domicile: wantsDomicile ? adresseDomicile : null, website: website }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!json.ok) { setError(json.error || "Erreur, veuillez réessayer."); return; }
    setStep("done");
  }

  function openWaitlist() {
    setWaitlistDate(selectedDay || today);
    setWlError("");
    setStep("waitlist");
  }

  async function handleWaitlistSubmit() {
    if (!prenom.trim() || !nom.trim()) { setWlError("Prénom et nom requis."); return; }
    if (!email.trim()) { setWlError("Email requis."); return; }
    if (!/^[a-zA-Z0-9_%+\-]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9_%+\-])?@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}$/.test(email) || email.includes("..")) { setWlError("Adresse email invalide."); return; }
    const telClean = telephone.replace(/[\s.\-]/g, "");
    if (!telClean || !/^(\+33|0033)[1-9]\d{8}$|^0[1-9]\d{8}$/.test(telClean)) { setWlError("Numéro de téléphone invalide (ex : 06 12 34 56 78)."); return; }
    if (!waitlistDate) { setWlError("Choisissez une date souhaitée."); return; }
    setWlError(""); setWlSubmitting(true);

    // Vérifier si des créneaux sont déjà disponibles à la date et plage souhaitées
    try {
      const duree = dureeTotal > 0 ? dureeTotal : 30;
      const slotsRes = await fetch(`/api/booking/slots?salon_id=${salonId}&date=${waitlistDate}&duree=${duree}`);
      const { slots } = await slotsRes.json();
      if (Array.isArray(slots) && slots.length > 0) {
        const matching = slots.filter((s: string) => {
          if (wlHeureDebut && s < wlHeureDebut) return false;
          if (wlHeureFin && s > wlHeureFin) return false;
          return true;
        });
        if (matching.length > 0) {
          const plage = wlHeureDebut || wlHeureFin
            ? ` entre ${wlHeureDebut || "l'ouverture"} et ${wlHeureFin || "la fermeture"}`
            : "";
          setWlError(`Des créneaux sont disponibles le ${new Date(waitlistDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}${plage}. Vous pouvez réserver directement !`);
          setWlSubmitting(false);
          return;
        }
      }
    } catch { /* si l'API échoue, on laisse passer */ }

    const res = await fetch("/api/waitlist/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salonId, prenom, nom, email, telephone, prestation_ids: selected.map(p => p.id), date: waitlistDate, heure_debut: wlHeureDebut || null, heure_fin: wlHeureFin || null, website }),
    });
    const json = await res.json();
    setWlSubmitting(false);
    if (!json.ok) { setWlError(json.error || "Erreur, veuillez réessayer."); return; }
    setStep("waitlist_done");
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };

  if (step === "done") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center", padding: "28px 0 12px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Rendez-vous confirmé !</div>
        <div style={{ fontSize: 14, color: "#666" }}>{selected.map(p => p.nom).join(" + ")} · {choix?.date.split("-").reverse().join("/")} à {choix?.heure}</div>
        {email && <div style={{ fontSize: 13, color: "#999", marginTop: 8 }}>Un email de confirmation vous a été envoyé.</div>}
      </div>
      <div style={{ height: 1, background: "#f0f0f0" }} />
      <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "16px 18px", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Retrouvez vos rendez-vous en ligne</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 14, lineHeight: 1.5 }}>Créez votre espace rdvous pour accéder à votre historique et votre cagnotte fidélité.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/rejoindre?email=${encodeURIComponent(email)}`}
            style={{ padding: "9px 18px", background: couleur, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            Créer mon espace
          </a>
          <a href={`/login?email=${encodeURIComponent(email)}`}
            style={{ padding: "9px 18px", background: "#fff", color: "#555", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            J'ai déjà un compte
          </a>
        </div>
      </div>
    </div>
  );

  if (step === "waitlist_done") return (
    <div style={{ textAlign: "center", padding: "28px 0 12px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Vous êtes sur la liste d'attente !</div>
      <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>
        Si une place se libère le {waitlistDate.split("-").reverse().join("/")}, le salon vous contactera directement.
      </div>
      {email && <div style={{ fontSize: 13, color: "#999", marginTop: 12 }}>Un email de confirmation vous a été envoyé.</div>}
    </div>
  );

  if (step === "waitlist") return (
    <div>
      <button onClick={() => setStep("select")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}>← Retour</button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>Être prévenu·e d'une place</div>
      </div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 18, lineHeight: 1.5 }}>
        Laissez vos coordonnées. Si un créneau se libère le jour souhaité, le salon vous contactera directement.
      </div>
      <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#555" }}>
        <strong style={{ color: couleur }}>{selected.map(p => p.nom).join(" + ")}</strong> · {formatDuree(dureeTotal)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden>
          <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} name="_b3acon" />
        </div>
        <div><label style={labelStyle}>Jour souhaité *</label>
          <input type="date" value={waitlistDate} min={today} max={maxDate || undefined} onChange={e => setWaitlistDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Plage horaire souhaitée <span style={{ fontWeight: 400, color: "#bbb" }}>(optionnel)</span></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(() => {
              const toMin = (h: string) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
              const endMin = endH * 60 + endM;
              const maxStart = dureeTotal > 0 ? endMin - dureeTotal : endMin;
              return (<>
                <select value={wlHeureDebut} onChange={e => { setWlHeureDebut(e.target.value); if (wlHeureFin && e.target.value && toMin(e.target.value) + dureeTotal > toMin(wlHeureFin)) setWlHeureFin(""); }}
                  style={{ ...inputStyle, color: wlHeureDebut ? "#1a1a1a" : "#aaa" }}>
                  <option value="">Dès que possible</option>
                  {CRENEAUX.filter(h => {
                    const m = toMin(h);
                    if (m > maxStart) return false;
                    if (wlHeureFin && dureeTotal > 0 && m + dureeTotal > toMin(wlHeureFin)) return false;
                    return true;
                  }).map(h => <option key={h} value={h}>À partir de {h}</option>)}
                </select>
                <select value={wlHeureFin} onChange={e => { setWlHeureFin(e.target.value); if (wlHeureDebut && e.target.value && toMin(wlHeureDebut) + dureeTotal > toMin(e.target.value)) setWlHeureDebut(""); }}
                  style={{ ...inputStyle, color: wlHeureFin ? "#1a1a1a" : "#aaa" }}>
                  <option value="">Sans limite</option>
                  {CRENEAUX.filter(h => {
                    if (wlHeureDebut && dureeTotal > 0 && toMin(h) < toMin(wlHeureDebut) + dureeTotal) return false;
                    return true;
                  }).map(h => <option key={h} value={h}>Jusqu'à {h}</option>)}
                </select>
              </>);
            })()}
          </div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>Si vous remplissez ce champ, vous serez prévenu·e seulement si un créneau s'ouvre dans cette plage.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={labelStyle}>Prénom *</label><input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie" style={inputStyle} /></div>
          <div><label style={labelStyle}>Nom *</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie@email.com" style={inputStyle} /></div>
        <div><label style={labelStyle}>Téléphone *</label><input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="06 00 00 00 00" style={inputStyle} /></div>
      </div>
      {wlError && <div style={{ marginTop: 12, fontSize: 13, color: "#e74c3c" }}>{wlError}</div>}
      <button onClick={handleWaitlistSubmit} disabled={wlSubmitting}
        style={{ marginTop: 20, width: "100%", padding: "13px", background: couleur, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: wlSubmitting ? "not-allowed" : "pointer", opacity: wlSubmitting ? 0.7 : 1 }}>
        {wlSubmitting ? "Inscription…" : "M'inscrire sur la liste d'attente"}
      </button>
    </div>
  );

  if (step === "contact") return (
    <div>
      <button onClick={() => setStep("select")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}>← Modifier le créneau</button>
      <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#555" }}>
        <strong style={{ color: couleur }}>{selected.map(p => p.nom).join(" + ")}</strong> · {choix?.date.split("-").reverse().join("/")} à <strong>{choix?.heure}</strong>
        {hasSurDevis && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#888", background: "#e8e8e8", padding: "2px 8px", borderRadius: 10 }}>Prix à définir</span>}
      </div>
      {deplacement === "possible" && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1.5px solid ${wantsDomicile ? couleur : "#e0e0e0"}`, borderRadius: 8, background: wantsDomicile ? couleur + "10" : "#fff", cursor: "pointer", fontSize: 13, marginBottom: 4 }}>
          <input type="checkbox" checked={wantsDomicile} onChange={e => setWantsDomicile(e.target.checked)} style={{ accentColor: couleur }} />
          <span>Je souhaite un <strong>rendez-vous à domicile</strong></span>
        </label>
      )}
      {deplacement === "uniquement" && <div style={{ padding: "8px 12px", background: couleur + "12", borderRadius: 8, fontSize: 12, color: couleur, fontWeight: 600, marginBottom: 4 }}>🚗 RDV à domicile uniquement</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Honeypot — invisible pour les humains, rempli par les bots */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden>
          <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} name="_b3acon" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={labelStyle}>Prénom *</label><input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie" style={inputStyle} /></div>
          <div><label style={labelStyle}>Nom *</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie@email.com" style={inputStyle} /></div>
        <div><label style={labelStyle}>Téléphone *</label><input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="06 00 00 00 00" style={inputStyle} /></div>
        {wantsDomicile && <div><label style={labelStyle}>Votre adresse *</label><input value={adresseDomicile} onChange={e => setAdresseDomicile(e.target.value)} placeholder="12 rue des Lilas, 75011 Paris" style={inputStyle} /></div>}
      </div>
      {error && <div style={{ marginTop: 12, fontSize: 13, color: "#e74c3c" }}>{error}</div>}
      <button onClick={handleSubmit} disabled={submitting}
        style={{ marginTop: 20, width: "100%", padding: "13px", background: couleur, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "Confirmation…" : "Confirmer le rendez-vous"}
      </button>
    </div>
  );

  // ── Composants internes ──

  const PrestationRow = ({ p, onClick, isSelected }: { p: Prestation; onClick: () => void; isSelected?: boolean }) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "11px 12px", borderRadius: 8, textAlign: "left", cursor: "pointer",
      border: `1.5px solid ${isSelected ? couleur : "#eee"}`,
      background: isSelected ? couleur + "08" : "#fff",
    }}>
      {isSelected !== undefined && (
        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? couleur : "#ccc"}`, background: isSelected ? couleur : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          {isSelected && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: "#1a1a1a" }}>{p.nom}</span>
        {p.description && (
          <div style={{ fontSize: 11, color: "#999", marginTop: 2, lineHeight: 1.4 }}>
            <span style={openDesc.has(p.id) ? { display: "block" } : { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</span>
            {p.description.length > 55 && (
              <span onClick={e => { e.stopPropagation(); toggleDesc(p.id); }} style={{ color: couleur, cursor: "pointer", fontWeight: 600 }}>
                {openDesc.has(p.id) ? "réduire" : "plus de détails"}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0, marginLeft: 10 }}>
        <span style={{ fontSize: 12, color: "#bbb" }}>{formatDuree(p.duree_minutes)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: p.sur_devis ? "#aaa" : couleur, minWidth: 52, textAlign: "right", whiteSpace: "nowrap" }}>{formatPrix(p.tarif, p.sur_devis)}</span>
      </div>
    </button>
  );

  const LibreGroup = ({ label, items, optionnel = true }: { label: string; items: Prestation[]; optionnel?: boolean }) => {
    if (items.length === 0) return null;
    return (
      <div style={{ border: "1px solid #ebebeb", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "9px 14px", background: "#f9f9f9", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}{optionnel ? " — optionnel" : ""}</div>
        <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map(p => <PrestationRow key={p.id} p={p} onClick={() => toggleLibre(p)} isSelected={selected.some(s => s.id === p.id)} />)}
        </div>
      </div>
    );
  };

  const CalendarSection = () => (
    <div>
      <div style={{ height: 1, background: "#f0f0f0", margin: "14px 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => { setWeekOffset(w => Math.max(0, w - 1)); setSelectedDay(null); }} disabled={weekOffset === 0}
          style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "4px 10px", cursor: weekOffset === 0 ? "not-allowed" : "pointer", color: weekOffset === 0 ? "#ccc" : "#555", fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>
          {monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {addDays(monday, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
        </span>
        <button onClick={() => { if (!atMaxWeek) { setWeekOffset(w => w + 1); setSelectedDay(null); } }} disabled={atMaxWeek}
          style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "4px 10px", cursor: atMaxWeek ? "not-allowed" : "pointer", color: atMaxWeek ? "#ccc" : "#555", fontSize: 16 }}>›</button>
      </div>
      {atMaxWeek && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#92400e", marginBottom: 8, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, fontWeight: 500 }}>
          {ouvertureInfo ?? "Les réservations ne sont pas encore ouvertes au-delà de cette période."}
        </div>
      )}
      {loadingSlots ? (
        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "#bbb" }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
            {weekDays.map((day, i) => {
              const iso = toISO(day); const isPast = iso < today; const isBeyondMax = maxDate ? iso > maxDate : false;
              const slots = slotsMap[iso] || []; const hasSlots = !isPast && !isBeyondMax && slots.length > 0;
              const isActive = selectedDay === iso;
              return (
                <button key={iso} onClick={() => hasSlots && setSelectedDay(iso)} disabled={!hasSlots}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", borderRadius: 8, border: isActive ? `2px solid ${couleur}` : "2px solid transparent", background: isActive ? couleur + "12" : hasSlots ? "#f9f9f9" : "transparent", cursor: hasSlots ? "pointer" : "default" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: hasSlots ? "#888" : "#ccc", textTransform: "uppercase", letterSpacing: "0.03em" }}>{JOURS_COURTS[i]}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isActive ? couleur : hasSlots ? "#1a1a1a" : "#ccc" }}>{day.getDate()}</span>
                  <span style={{ fontSize: 10, color: isActive ? couleur : hasSlots ? "#aaa" : "#ddd" }}>{hasSlots ? `${slots.length}` : "—"}</span>
                </button>
              );
            })}
          </div>
          {selectedDay && slotsMap[selectedDay] && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(blockedMap[selectedDay] || []).map(s => (
                  <div key={`blocked-${s}`} title="Ce créneau n'est plus disponible à la réservation en ligne — contactez-nous"
                    style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, border: "1.5px solid #e0e0e0", borderRadius: 7, background: "#f5f5f5", color: "#bbb", cursor: "not-allowed", userSelect: "none" }}>
                    {s}
                  </div>
                ))}
                {slotsMap[selectedDay].map(s => {
                  const isSel = choix?.date === selectedDay && choix?.heure === s;
                  return (
                    <button key={s} onClick={() => setChoix({ date: selectedDay, heure: s })}
                      style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, border: `1.5px solid ${isSel ? couleur : "#e0e0e0"}`, borderRadius: 7, background: isSel ? couleur : "#fff", color: isSel ? "#fff" : "#333", cursor: "pointer" }}>
                      {s}
                    </button>
                  );
                })}
              </div>
              {(blockedMap[selectedDay] || []).length > 0 && (
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 6, width: "100%" }}>
                  Les créneaux grisés ne sont plus disponibles à la réservation en ligne — contactez-nous directement.
                </div>
              )}
            </div>
          )}
          {!selectedDay && Object.values(slotsMap).every(s => s.length === 0) && (
            <div style={{ textAlign: "center", fontSize: 13, color: "#bbb", padding: "12px 0" }}>Aucune disponibilité cette semaine.</div>
          )}
        </>
      )}
      {choix && (
        <button onClick={() => setStep("contact")}
          style={{ marginTop: 16, width: "100%", padding: "13px", background: couleur, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Continuer → {choix.date.split("-").reverse().join("/")} à {choix.heure}
        </button>
      )}
      <button onClick={openWaitlist}
        style={{ marginTop: 12, width: "100%", padding: "10px", background: "none", border: `1px dashed ${couleur}66`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: couleur, cursor: "pointer" }}>
        Aucun créneau ne vous convient ? Inscrivez-vous à la liste d'attente
      </button>
    </div>
  );

  // ── Rendu sélection ──

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {delaiMinHeures > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#c2410c", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span>⚠️</span>
          <span>
            Ce salon n'accepte pas de réservations moins de <strong>{delaiMinHeures}h à l'avance</strong>.
            {salonTel ? <> Contactez-nous au <a href={`tel:${salonTel}`} style={{ color: "#c2410c", fontWeight: 700 }}>{salonTel}</a> pour les créneaux du jour.</> : <> Contactez le salon directement pour les créneaux du jour.</>}
          </span>
        </div>
      )}
      {isMenu ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ...categories.map(c => ({ id: c.id, nom: c.nom, items: prestations.filter(p => p.categorie_id === c.id) })),
            { id: "__autres__", nom: "Autres", items: prestations.filter(p => !p.categorie_id) },
          ].filter(g => g.items.length > 0).map(g => {
            const isOpen = openCats.has(g.id);
            const nbSel = g.items.filter(p => selected.some(s => s.id === p.id)).length;
            return (
              <div key={g.id} style={{ border: `1px solid ${nbSel > 0 ? couleur + "55" : "#e8e8e8"}`, borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => toggleCat(g.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "13px 14px", background: isOpen ? `${couleur}0e` : "#fff", border: "none", borderLeft: `3px solid ${couleur}`, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: couleur, flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▸</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: couleur, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g.nom}</span>
                    <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{g.items.length} prestation{g.items.length > 1 ? "s" : ""}</span>
                  </div>
                  {nbSel > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: couleur, borderRadius: 20, padding: "2px 9px", flexShrink: 0, whiteSpace: "nowrap" }}>{nbSel} ✓</span>}
                </button>
                {isOpen && (
                  <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4, borderTop: `1px solid ${couleur}18`, background: "#fafafa" }}>
                    {g.items.map(p => <PrestationRow key={p.id} p={p} onClick={() => toggleLibre(p)} isSelected={selected.some(s => s.id === p.id)} />)}
                  </div>
                )}
              </div>
            );
          })}
          {selected.length > 0 && (
            <div style={{ padding: "10px 14px", background: "#f5f5f5", borderRadius: 8, fontSize: 12, color: "#555" }}>
              {selected.map(p => p.nom).join(" + ")} · <strong>{formatDuree(dureeTotal)}</strong> · <strong style={{ color: couleur }}>{hasSurDevis ? (tarifTotal > 0 ? `${tarifTotal} € + sur devis` : "Sur devis") : `${tarifTotal} €`}</strong>
            </div>
          )}
        </div>
      ) : hasSteps ? (
        <>
          {stepCategories.map((cat, idx) => {
            const catPrestations = prestations.filter(p => p.categorie_id === cat.id);
            const done = isConfirmed(cat);
            const isOpen = openStepId === cat.id;
            const selectedInCat = selected.filter(p => p.categorie_id === cat.id);
            const isMultiple = cat.selection_type === "multiple";

            const summaryLabel = done
              ? (isMultiple
                ? (selectedInCat.length === 0 ? "Aucune" : selectedInCat.map(p => p.nom).join(", "))
                : selectedInCat[0]?.nom || "")
              : null;

            const badgeBg = done
              ? (isMultiple && selectedInCat.length === 0 ? "#e0e0e0" : couleur)
              : isOpen ? couleur + "18" : "#f0f0f0";
            const badgeColor = done
              ? (isMultiple && selectedInCat.length === 0 ? "#999" : "#fff")
              : isOpen ? couleur : "#bbb";

            return (
              <div key={cat.id} style={{ border: `1.5px solid ${isOpen ? couleur + "55" : done ? couleur + "30" : "#ebebeb"}`, borderRadius: 10, overflow: "hidden" }}>
                {/* En-tête */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: done && !isOpen ? couleur + "06" : "#fff" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: badgeBg, fontSize: 11, fontWeight: 700, color: badgeColor }}>
                    {done ? (isMultiple && selectedInCat.length === 0 ? "—" : "✓") : idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: isOpen ? couleur : "#bbb" }}>
                      {cat.nom}{isMultiple && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>(optionnel)</span>}
                    </div>
                    {done && <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summaryLabel}</div>}
                    {!done && isOpen && <div style={{ fontSize: 12, color: couleur + "cc", marginTop: 1 }}>{isMultiple ? "Choisissez 0 ou plusieurs" : "Choisissez une option"}</div>}
                    {!done && !isOpen && <div style={{ fontSize: 12, color: "#ccc", marginTop: 1 }}>—</div>}
                  </div>
                  {done && (
                    <button onClick={() => modifyStep(cat)} style={{ fontSize: 12, color: couleur, background: "none", border: `1px solid ${couleur}40`, cursor: "pointer", fontWeight: 600, padding: "4px 10px", borderRadius: 6, flexShrink: 0 }}>
                      Modifier
                    </button>
                  )}
                </div>

                {/* Corps */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${couleur}20`, padding: "8px 10px 10px", background: "#fafafa", display: "flex", flexDirection: "column", gap: 4 }}>
                    {catPrestations.length === 0
                      ? <div style={{ fontSize: 13, color: "#ccc", padding: "8px 4px" }}>Aucune prestation dans cette catégorie.</div>
                      : catPrestations.map(p =>
                          isMultiple
                            ? <PrestationRow key={p.id} p={p} onClick={() => toggleInStep(p)} isSelected={selected.some(s => s.id === p.id)} />
                            : <PrestationRow key={p.id} p={p} onClick={() => selectUnique(cat, p)} />
                        )
                    }
                    {/* Bouton Continuer pour les étapes "multiple" */}
                    {isMultiple && (
                      <button onClick={() => confirmMultiple(cat)}
                        style={{ marginTop: 6, padding: "10px 14px", background: couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                        {selectedInCat.length > 0 ? `Continuer avec ${selectedInCat.length} sélection${selectedInCat.length > 1 ? "s" : ""} →` : "Passer cette étape →"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Catégories libres (hors stepper) */}
          {libreCategories.map(cat => (
            <LibreGroup key={cat.id} label={cat.nom} items={prestations.filter(p => p.categorie_id === cat.id)} />
          ))}
          <LibreGroup label="Autres" items={prestations.filter(p => !p.categorie_id)} />

          {/* Récap */}
          {selected.length > 0 && (
            <div style={{ padding: "10px 14px", background: "#f5f5f5", borderRadius: 8, fontSize: 12, color: "#555" }}>
              {selected.map(p => p.nom).join(" + ")} · <strong>{formatDuree(dureeTotal)}</strong> · <strong style={{ color: couleur }}>{hasSurDevis ? (tarifTotal > 0 ? `${tarifTotal} € + sur devis` : "Sur devis") : `${tarifTotal} €`}</strong>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ marginBottom: selected.length > 0 ? 8 : 0 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Prestation</label>
            <select value="" onChange={e => {
              const p = prestations.find(x => x.id === e.target.value);
              if (p && !selected.find(s => s.id === p.id)) setSelected(prev => [...prev, p]);
            }} style={{ width: "100%", padding: "10px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" }}>
              <option value="" disabled>{selected.length === 0 ? "Choisissez une prestation…" : "Ajouter une prestation…"}</option>
              {prestations.filter(p => !selected.find(s => s.id === p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.nom} — {formatDuree(p.duree_minutes)} · {formatPrix(p.tarif, p.sur_devis)}</option>
              ))}
            </select>
          </div>
          {selected.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {selected.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: couleur + "15", border: `1px solid ${couleur}40`, borderRadius: 20, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: couleur }}>{p.nom}</span>
                    <span style={{ fontSize: 11, color: "#999" }}>{formatDuree(p.duree_minutes)} · {formatPrix(p.tarif, p.sur_devis)}</span>
                    <button onClick={() => setSelected(s => s.filter(x => x.id !== p.id))} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>Total : {formatDuree(dureeTotal)} · {hasSurDevis ? (tarifTotal > 0 ? `${tarifTotal} € + sur devis` : "Sur devis") : `${tarifTotal} €`}</div>
            </div>
          )}
        </>
      )}

      {canShowCalendar && <CalendarSection />}
    </div>
  );
}

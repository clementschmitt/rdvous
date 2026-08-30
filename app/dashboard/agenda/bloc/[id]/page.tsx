"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const CRENEAUX = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${["00", "15", "30", "45"][i % 4]}`);

function toMin(hhmm: string) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

export default function EditBlocPage({ params }: { params: Promise<{ id: string }> }) {
  const salon = useSalon();
  const router = useRouter();
  // Date de l'occurrence cliquée dans l'agenda. Sans elle on ne saurait pas
  // laquelle des occurrences d'une série la professionnelle veut retirer.
  const dateOccurrence = useSearchParams().get("date");

  const [id, setId] = useState("");
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("09:00");
  const [heureFin, setHeureFin] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [recurrence, setRecurrence] = useState<"" | "hebdomadaire">("");
  const [recurrenceFin, setRecurrenceFin] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [choixSuppression, setChoixSuppression] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id || !salon) return;
    (async () => {
      const supabase = createSupabase();
      const { data, error } = await supabase
        .from("agenda_evenements")
        .select("*")
        .eq("id", id)
        .eq("salon_id", salon.id)
        .single();
      if (error || !data) { setNotFound(true); return; }
      setTitre(data.titre);
      const pad = (n: number) => String(n).padStart(2, "0");
      const startDateStr = data.date_heure.slice(0, 10);
      const startTimeStr = data.date_heure.slice(11, 16);
      setDate(startDateStr);
      setHeure(startTimeStr);
      // Calcul fin purement arithmétique, pas de conversion timezone
      const [sh, sm] = startTimeStr.split(":").map(Number);
      const endTotalMin = sh * 60 + sm + data.duree_minutes;
      const extraDays = Math.floor(endTotalMin / 1440);
      const endMinInDay = endTotalMin % 1440;
      const endTimeStr = `${pad(Math.floor(endMinInDay / 60))}:${pad(endMinInDay % 60)}`;
      const endDateObj = new Date(startDateStr + "T12:00:00");
      endDateObj.setDate(endDateObj.getDate() + extraDays);
      const endDateStr = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}`;
      setDateFin(endDateStr);
      setHeureFin(endTimeStr);
      setRecurrence((data.recurrence as "" | "hebdomadaire") || "");
      setRecurrenceFin(data.recurrence_fin || "");
      setNotes(data.notes || "");
    })();
  }, [id, salon]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError("Titre requis."); return; }
    if (!heureFin) { setError("Heure de fin requise."); return; }
    if (dateFin < date) { setError("La date de fin doit être après la date de début."); return; }
    if (dateFin === date && toMin(heureFin) <= toMin(heure)) { setError("L'heure de fin doit être après l'heure de début."); return; }
    const debutMs = new Date(`${date}T${heure}:00`).getTime();
    const finMs = new Date(`${dateFin}T${heureFin}:00`).getTime();
    const duree = Math.round((finMs - debutMs) / 60000);
    setLoading(true);
    setError("");
    const supabase = createSupabase();
    const { error: err } = await supabase.from("agenda_evenements").update({
      titre: titre.trim(),
      date_heure: `${date}T${heure}:00`,
      duree_minutes: duree,
      notes: notes.trim() || null,
      recurrence: recurrence || null,
      recurrence_fin: recurrence && recurrenceFin ? recurrenceFin : null,
    }).eq("id", id);
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/dashboard/agenda");
  }

  function demanderSuppression() {
    // Un bloc unique n'a rien à arbitrer, on garde la confirmation simple.
    if (recurrence !== "hebdomadaire" || !dateOccurrence) {
      if (!confirm("Supprimer ce bloc ?")) return;
      supprimer("tous");
      return;
    }
    setChoixSuppression(true);
  }

  async function supprimer(portee: "occurrence" | "suivants" | "tous") {
    setChoixSuppression(false);
    setDeleting(true);
    const supabase = createSupabase();

    if (portee === "occurrence" && dateOccurrence) {
      // On mémorise la date écartée plutôt que de matérialiser toutes les
      // occurrences en base. Le créneau redevient réservable côté public.
      const { data } = await supabase.from("agenda_evenements").select("dates_exclues").eq("id", id).single();
      const dejaExclues: string[] = data?.dates_exclues || [];
      if (!dejaExclues.includes(dateOccurrence)) {
        await supabase.from("agenda_evenements")
          .update({ dates_exclues: [...dejaExclues, dateOccurrence] })
          .eq("id", id);
      }
    } else if (portee === "suivants" && dateOccurrence) {
      // Supprimer à partir de la première occurrence revient à supprimer la série.
      if (dateOccurrence <= date) {
        await supabase.from("agenda_evenements").delete().eq("id", id);
      } else {
        const veille = new Date(dateOccurrence + "T12:00:00");
        veille.setDate(veille.getDate() - 1);
        await supabase.from("agenda_evenements")
          .update({ recurrence_fin: veille.toISOString().slice(0, 10) })
          .eq("id", id);
      }
    } else {
      await supabase.from("agenda_evenements").delete().eq("id", id);
    }

    router.push("/dashboard/agenda");
  }

  if (!salon) return null;
  if (notFound) return <div style={{ padding: 40, color: "#bbb" }}>Bloc introuvable.</div>;
  if (!titre && !notFound) return <div style={{ padding: 40, color: "#bbb" }}>Chargement…</div>;

  const m = METIERS[salon.metier];

  const dateLisible = dateOccurrence
    ? new Date(dateOccurrence + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      {choixSuppression && (
        <div onClick={() => setChoixSuppression(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>Supprimer « {titre} »</div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.6, marginBottom: 20 }}>
              Ce bloc se répète toutes les semaines. Que souhaitez-vous supprimer ?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => supprimer("occurrence")} style={choixStyle}>
                <span style={{ fontWeight: 600 }}>Ce bloc uniquement</span>
                <span style={{ fontSize: 12, color: "#888" }}>Seulement le {dateLisible}</span>
              </button>
              <button type="button" onClick={() => supprimer("suivants")} style={choixStyle}>
                <span style={{ fontWeight: 600 }}>Ce bloc et les suivants</span>
                <span style={{ fontSize: 12, color: "#888" }}>Les occurrences passées sont conservées</span>
              </button>
              <button type="button" onClick={() => supprimer("tous")} style={{ ...choixStyle, borderColor: "#fecaca", color: "#dc2626" }}>
                <span style={{ fontWeight: 600 }}>Tous les blocs</span>
                <span style={{ fontSize: 12, color: "#c47" }}>Toute la série, y compris le passé</span>
              </button>
              <button type="button" onClick={() => setChoixSuppression(false)}
                style={{ marginTop: 4, padding: "11px", background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard/agenda" style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← Agenda</Link>
      </div>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Modifier le bloc</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section titre="Détails">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Titre *</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Heure de début *</label>
                <select value={heure} onChange={e => { setHeure(e.target.value); if (dateFin === date && heureFin && toMin(heureFin) <= toMin(e.target.value)) setHeureFin(""); }} style={inputStyle}>
                  {CRENEAUX.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Heure de fin *</label>
                <select value={heureFin} onChange={e => setHeureFin(e.target.value)} style={inputStyle}>
                  <option value="">--</option>
                  {CRENEAUX.filter(h => dateFin > date || toMin(h) > toMin(heure)).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Date de début *</label>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); if (dateFin < e.target.value) setDateFin(e.target.value); }} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date de fin *</label>
                <input type="date" value={dateFin} min={date} onChange={e => setDateFin(e.target.value)} required style={inputStyle} />
              </div>
            </div>
          </div>
        </Section>

        <Section titre="Récurrence">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {([{ v: "" as const, label: "Aucune" }, { v: "hebdomadaire" as const, label: "Chaque semaine" }]).map(opt => (
                <button key={opt.v} type="button" onClick={() => setRecurrence(opt.v)}
                  style={{ flex: 1, padding: "9px 12px", border: `1.5px solid ${recurrence === opt.v ? m.couleur : "#e0e0e0"}`, borderRadius: 8, background: recurrence === opt.v ? `${m.couleur}0c` : "#fff", fontSize: 13, fontWeight: recurrence === opt.v ? 600 : 400, color: recurrence === opt.v ? m.couleur : "#555", cursor: "pointer" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {recurrence === "hebdomadaire" && (
              <div>
                <label style={labelStyle}>Fin de récurrence (optionnel)</label>
                <input type="date" value={recurrenceFin} onChange={e => setRecurrenceFin(e.target.value)} style={inputStyle} />
                <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 0" }}>Laissez vide pour répéter indéfiniment.</p>
              </div>
            )}
          </div>
        </Section>

        <Section titre="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </Section>

        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={demanderSuppression} disabled={deleting}
            style={{ padding: "11px 16px", background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1 }}>
            {deleting ? "…" : "Supprimer"}
          </button>
          <Link href="/dashboard/agenda" style={{ flex: 1, padding: "11px", background: "#f0f0f0", color: "#333", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Annuler
          </Link>
          <button type="submit" disabled={loading}
            style={{ flex: 2, padding: "11px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };
const choixStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
  padding: "12px 14px", background: "#fff", color: "#1a1a1a",
  border: "1.5px solid #e0e0e0", borderRadius: 9, fontSize: 14,
  cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%",
};

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" };

"use client";
import { useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const DUREES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "Toute la journée", value: 480 },
];

const CRENEAUX = Array.from({ length: 30 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`);

function NouveauBlocContent() {
  const salon = useSalon();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(searchParams.get("date") || new Date().toISOString().split("T")[0]);
  const [heure, setHeure] = useState(searchParams.get("heure") || "09:00");
  const [duree, setDuree] = useState(60);
  const [recurrence, setRecurrence] = useState<"" | "hebdomadaire">("");
  const [recurrenceFin, setRecurrenceFin] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError("Titre requis."); return; }
    setLoading(true);
    setError("");
    const supabase = createSupabase();
    const { error: err } = await supabase.from("agenda_evenements").insert({
      salon_id: salon!.id,
      titre: titre.trim(),
      date_heure: `${date}T${heure}:00`,
      duree_minutes: duree,
      notes: notes.trim() || null,
      recurrence: recurrence || null,
      recurrence_fin: recurrence && recurrenceFin ? recurrenceFin : null,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/dashboard/agenda");
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard/agenda" style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← Agenda</Link>
      </div>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Nouveau bloc personnel</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section titre="Détails">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Titre *</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Sport, Médecin, Livraison…" required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Heure *</label>
                <select value={heure} onChange={e => setHeure(e.target.value)} style={inputStyle}>
                  {CRENEAUX.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Durée *</label>
              <select value={duree} onChange={e => setDuree(Number(e.target.value))} style={inputStyle}>
                {DUREES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
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
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes optionnelles…" style={{ ...inputStyle, resize: "vertical" }} />
        </Section>

        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard/agenda" style={{ flex: 1, padding: "11px", background: "#f0f0f0", color: "#333", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Annuler
          </Link>
          <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Enregistrement…" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NouveauBlocPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#bbb" }}>Chargement…</div>}>
      <NouveauBlocContent />
    </Suspense>
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
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" };

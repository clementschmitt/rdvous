"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number };
type Settings = { delai_relance_mois: number; message_relance: string; email_expediteur: string; nb_visites_fidelite: number; montant_recompense: number; tarif_minimum: number; montant_parrain: number; montant_filleul: number };

export default function ParametresPage() {
  const salon = useSalon();
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [settings, setSettings] = useState<Settings>({ delai_relance_mois: 2, message_relance: "Bonjour {prenom}, cela fait un moment que nous ne vous avons pas vu !", email_expediteur: "", nb_visites_fidelite: 10, montant_recompense: 10, tarif_minimum: 0, montant_parrain: 5, montant_filleul: 5 });
  const [newPresta, setNewPresta] = useState({ nom: "", duree_minutes: "60", tarif: "0" });
  const [editPrestaId, setEditPrestaId] = useState<string | null>(null);
  const [editPresta, setEditPresta] = useState<Prestation | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon]);

  async function load() {
    const supabase = createSupabase();
    const [pRes, sRes] = await Promise.all([
      supabase.from("prestations").select("*").eq("salon_id", salon!.id).order("nom"),
      supabase.from("app_settings").select("*").eq("salon_id", salon!.id).single(),
    ]);
    setPrestations((pRes.data || []) as Prestation[]);
    if (sRes.data) setSettings(prev => ({
      ...prev,
      ...Object.fromEntries(Object.entries(sRes.data as Record<string, unknown>).map(([k, v]) => [k, v ?? prev[k as keyof Settings]])),
    }));
  }

  async function addPresta() {
    if (!newPresta.nom.trim()) return;
    const supabase = createSupabase();
    await supabase.from("prestations").insert({ salon_id: salon!.id, nom: newPresta.nom, duree_minutes: Number(newPresta.duree_minutes), tarif: Number(newPresta.tarif) });
    setNewPresta({ nom: "", duree_minutes: "60", tarif: "0" });
    load();
  }

  async function deletePresta(id: string) {
    if (!confirm("Supprimer cette prestation ?")) return;
    const supabase = createSupabase();
    await supabase.from("prestations").delete().eq("id", id);
    load();
  }

  async function saveEditPresta() {
    if (!editPresta) return;
    const supabase = createSupabase();
    await supabase.from("prestations").update({ nom: editPresta.nom, duree_minutes: editPresta.duree_minutes, tarif: editPresta.tarif }).eq("id", editPresta.id);
    setEditPrestaId(null);
    load();
  }

  async function saveSettings() {
    setSavingSettings(true);
    const supabase = createSupabase();
    await supabase.from("app_settings").update(settings).eq("salon_id", salon!.id);
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  return (
    <div style={{ padding: 32, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Paramètres</h1>

      <Section titre="Prestations">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {prestations.length === 0 && <div style={{ fontSize: 13, color: "#bbb" }}>Aucune prestation.</div>}
          {prestations.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8 }}>
              {editPrestaId === p.id && editPresta ? (
                <>
                  <input value={editPresta.nom} onChange={e => setEditPresta({ ...editPresta, nom: e.target.value })} style={{ flex: 2, ...miniInput }} />
                  <input type="number" value={editPresta.duree_minutes} onChange={e => setEditPresta({ ...editPresta, duree_minutes: Number(e.target.value) })} style={{ flex: 1, ...miniInput }} />
                  <input type="number" value={editPresta.tarif} onChange={e => setEditPresta({ ...editPresta, tarif: Number(e.target.value) })} style={{ flex: 1, ...miniInput }} />
                  <button onClick={saveEditPresta} style={btnSmall(m.couleur)}>✓</button>
                  <button onClick={() => setEditPrestaId(null)} style={btnSmallGhost}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 2, fontSize: 13, fontWeight: 500 }}>{p.nom}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#666" }}>{p.duree_minutes} min</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.tarif} €</span>
                  <button onClick={() => { setEditPrestaId(p.id); setEditPresta(p); }} style={btnSmallGhost}>Modifier</button>
                  <button onClick={() => deletePresta(p.id)} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c" }}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Nom *</label>
            <input value={newPresta.nom} onChange={e => setNewPresta(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Pose complète" style={{ ...miniInput, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Durée (min)</label>
            <input type="number" value={newPresta.duree_minutes} onChange={e => setNewPresta(p => ({ ...p, duree_minutes: e.target.value }))} style={{ ...miniInput, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Tarif (€)</label>
            <input type="number" value={newPresta.tarif} onChange={e => setNewPresta(p => ({ ...p, tarif: e.target.value }))} style={{ ...miniInput, width: "100%" }} />
          </div>
          <button onClick={addPresta} style={{ padding: "9px 16px", background: m.couleur, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ajouter</button>
        </div>
      </Section>

      <Section titre="Fidélité & parrainage" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Champ label="Visites pour récompense" value={String(settings.nb_visites_fidelite)} onChange={v => setSettings(s => ({ ...s, nb_visites_fidelite: Number(v) }))} type="number" />
          <Champ label="Montant récompense (€)" value={String(settings.montant_recompense)} onChange={v => setSettings(s => ({ ...s, montant_recompense: Number(v) }))} type="number" />
          <Champ label="Tarif minimum (€)" value={String(settings.tarif_minimum)} onChange={v => setSettings(s => ({ ...s, tarif_minimum: Number(v) }))} type="number" />
          <div />
          <Champ label="Bonus parrain (€)" value={String(settings.montant_parrain)} onChange={v => setSettings(s => ({ ...s, montant_parrain: Number(v) }))} type="number" />
          <Champ label="Bonus filleul·e (€)" value={String(settings.montant_filleul)} onChange={v => setSettings(s => ({ ...s, montant_filleul: Number(v) }))} type="number" />
        </div>
      </Section>

      <Section titre="Relances clients" style={{ marginTop: 16 }}>
        <Champ label="Délai avant relance (mois)" value={String(settings.delai_relance_mois)} onChange={v => setSettings(s => ({ ...s, delai_relance_mois: Number(v) }))} type="number" />
        <Champ label="Email expéditeur" value={settings.email_expediteur} onChange={v => setSettings(s => ({ ...s, email_expediteur: v }))} type="email" />
        <div>
          <label style={labelStyle}>Message (utilisez {"{prenom}"} pour personnaliser)</label>
          <textarea value={settings.message_relance} onChange={e => setSettings(s => ({ ...s, message_relance: e.target.value }))} rows={3} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>
      </Section>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={saveSettings} disabled={savingSettings} style={{ padding: "10px 28px", background: settingsSaved ? "#27ae60" : m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {savingSettings ? "Enregistrement..." : settingsSaved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Section({ titre, children, style }: { titre: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", ...style }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Champ({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };
const miniInput: React.CSSProperties = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
function btnSmall(bg: string): React.CSSProperties { return { padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer" }; }
const btnSmallGhost: React.CSSProperties = { padding: "5px 10px", background: "none", border: "1px solid #ddd", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#555" };

"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { PLAN_LABELS, PLAN_PRICES, type Plan } from "@/lib/plan";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number };
type Settings = { delai_relance_mois: number; message_relance: string; email_expediteur: string; email_expediteur_nom: string; email_confirmation_active: boolean; email_confirmation_objet: string; email_confirmation_contenu: string; email_rappel_active: boolean; email_rappel_objet: string; email_rappel_contenu: string; email_relance_objet: string; nb_visites_fidelite: number; montant_recompense: number; tarif_minimum: number; montant_parrain: number; montant_filleul: number };

export default function ParametresPage() {
  const salon = useSalon();
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [settings, setSettings] = useState<Settings>({ delai_relance_mois: 2, message_relance: "Bonjour {prenom}, cela fait un moment que nous ne vous avons pas vu !", email_expediteur: "", email_expediteur_nom: "rdvous", email_confirmation_active: true, email_confirmation_objet: "Confirmation de votre rendez-vous", email_confirmation_contenu: "Bonjour {prenom}, votre rendez-vous du {date} à {heure} est confirmé. À bientôt !", email_rappel_active: true, email_rappel_objet: "Rappel : votre rendez-vous demain", email_rappel_contenu: "Bonjour {prenom}, nous vous rappelons votre rendez-vous demain {date} à {heure}. À demain !", email_relance_objet: "On pense à vous !", nb_visites_fidelite: 10, montant_recompense: 10, tarif_minimum: 0, montant_parrain: 5, montant_filleul: 5 });
  const [newPresta, setNewPresta] = useState({ nom: "", duree_minutes: "60", tarif: "0" });
  const [editPrestaId, setEditPrestaId] = useState<string | null>(null);
  const [editPresta, setEditPresta] = useState<Prestation | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ ok: boolean; text: string } | null>(null);

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

  async function startCheckout() {
    setBillingLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ interval: billingInterval, salon_id: salon!.id }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setBillingLoading(false);
  }

  async function openPortal() {
    setBillingLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}` },
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setBillingLoading(false);
  }

  async function changePassword() {
    if (newPassword.length < 6) { setPwdMessage({ ok: false, text: "6 caractères minimum." }); return; }
    if (newPassword !== confirmPassword) { setPwdMessage({ ok: false, text: "Les mots de passe ne correspondent pas." }); return; }
    setPwdLoading(true);
    setPwdMessage(null);
    const supabase = createSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMessage({ ok: false, text: error.message });
    } else {
      setPwdMessage({ ok: true, text: "Mot de passe mis à jour." });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwdLoading(false);
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
  const plan = (salon.plan || "free") as Plan;
  const isFree = plan === "free";

  return (
    <div className="params-wrap" style={{ padding: 32, maxWidth: 760, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .params-wrap { padding: 16px !important; }
          .params-grid-2 { grid-template-columns: 1fr !important; }
          .params-abo { flex-direction: column !important; align-items: flex-start !important; }
          .params-abo-actions { align-items: flex-start !important; }
        }
      `}</style>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Paramètres</h1>

      {/* ── Abonnement ── */}
      <Section titre="Abonnement">
        <div className="params-abo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Plan {PLAN_LABELS[plan]}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: isFree ? "#f0f0f0" : m.couleur + "22", color: isFree ? "#999" : m.couleur }}>
                {PLAN_PRICES[plan]}
              </span>
            </div>
            {isFree && (
              <div style={{ fontSize: 12, color: "#999" }}>
                Limité à 30 rendez-vous/mois · Fidélité et cagnotte non disponibles
              </div>
            )}
            {!isFree && (
              <div style={{ fontSize: 12, color: "#999" }}>
                Accès complet · Rappels email · Fidélité & cagnotte inclus
              </div>
            )}
          </div>
          {isFree ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 3, gap: 3 }}>
                <button onClick={() => setBillingInterval("monthly")}
                  style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: billingInterval === "monthly" ? "#fff" : "transparent", color: billingInterval === "monthly" ? "#1a1a1a" : "#999", boxShadow: billingInterval === "monthly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  Mensuel — 19€
                </button>
                <button onClick={() => setBillingInterval("yearly")}
                  style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: billingInterval === "yearly" ? "#fff" : "transparent", color: billingInterval === "yearly" ? "#1a1a1a" : "#999", boxShadow: billingInterval === "yearly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  Annuel — 190€ <span style={{ color: m.couleur }}>-2 mois offerts</span>
                </button>
              </div>
              <button onClick={startCheckout} disabled={billingLoading}
                style={{ padding: "10px 22px", background: m.couleur, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {billingLoading ? "Chargement…" : `Passer à l'offre Indépendant`}
              </button>
            </div>
          ) : (
            <button onClick={openPortal} disabled={billingLoading}
              style={{ padding: "10px 22px", background: "#fff", color: "#555", border: "1px solid #ddd", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
              {billingLoading ? "Chargement…" : "Gérer mon abonnement"}
            </button>
          )}
        </div>
      </Section>

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
        <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Champ label="Visites pour récompense" value={String(settings.nb_visites_fidelite)} onChange={v => setSettings(s => ({ ...s, nb_visites_fidelite: Number(v) }))} type="number" />
          <Champ label="Montant récompense (€)" value={String(settings.montant_recompense)} onChange={v => setSettings(s => ({ ...s, montant_recompense: Number(v) }))} type="number" />
          <Champ label="Tarif minimum (€)" value={String(settings.tarif_minimum)} onChange={v => setSettings(s => ({ ...s, tarif_minimum: Number(v) }))} type="number" />
          <div />
          <Champ label="Bonus parrain (€)" value={String(settings.montant_parrain)} onChange={v => setSettings(s => ({ ...s, montant_parrain: Number(v) }))} type="number" />
          <Champ label="Bonus filleul·e (€)" value={String(settings.montant_filleul)} onChange={v => setSettings(s => ({ ...s, montant_filleul: Number(v) }))} type="number" />
        </div>
      </Section>

      <Section titre="Emails automatiques" style={{ marginTop: 16 }}>
        <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Champ label="Nom de l'expéditeur" value={settings.email_expediteur_nom} onChange={v => setSettings(s => ({ ...s, email_expediteur_nom: v }))} />
          <Champ label="Email expéditeur" value={settings.email_expediteur} onChange={v => setSettings(s => ({ ...s, email_expediteur: v }))} type="email" />
        </div>
        <div style={{ height: 1, background: "#f0f0f0" }} />
        <Toggle
          label="Confirmation de rendez-vous"
          description="Envoie un email au client dès qu'un RDV est créé"
          value={settings.email_confirmation_active}
          onChange={v => setSettings(s => ({ ...s, email_confirmation_active: v }))}
          couleur={m.couleur}
        />
        {settings.email_confirmation_active && (
          <>
            <Champ label="Objet" value={settings.email_confirmation_objet} onChange={v => setSettings(s => ({ ...s, email_confirmation_objet: v }))} />
            <ChampTextarea label="Contenu" value={settings.email_confirmation_contenu} onChange={v => setSettings(s => ({ ...s, email_confirmation_contenu: v }))} hint="{prenom}, {date}, {heure}, {prestations}, {salon}" />
          </>
        )}
        <div style={{ height: 1, background: "#f0f0f0" }} />
        <Toggle
          label="Rappel 24h avant"
          description="Envoie un rappel la veille à 9h UTC pour les RDVs confirmés"
          value={settings.email_rappel_active}
          onChange={v => setSettings(s => ({ ...s, email_rappel_active: v }))}
          couleur={m.couleur}
        />
        {settings.email_rappel_active && (
          <>
            <Champ label="Objet" value={settings.email_rappel_objet} onChange={v => setSettings(s => ({ ...s, email_rappel_objet: v }))} />
            <ChampTextarea label="Contenu" value={settings.email_rappel_contenu} onChange={v => setSettings(s => ({ ...s, email_rappel_contenu: v }))} hint="{prenom}, {date}, {heure}, {prestations}, {salon}" />
          </>
        )}
      </Section>

      <Section titre="Relances clients" style={{ marginTop: 16 }}>
        <Champ label="Délai avant relance (mois)" value={String(settings.delai_relance_mois)} onChange={v => setSettings(s => ({ ...s, delai_relance_mois: Number(v) }))} type="number" />
        <Champ label="Objet de l'email" value={settings.email_relance_objet} onChange={v => setSettings(s => ({ ...s, email_relance_objet: v }))} />
        <ChampTextarea label="Contenu" value={settings.message_relance} onChange={v => setSettings(s => ({ ...s, message_relance: v }))} hint="{prenom}" />
      </Section>

      <Section titre="Sécurité" style={{ marginTop: 16 }}>
        <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6 caractères minimum" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={labelStyle}>Confirmer le mot de passe</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>
        {pwdMessage && (
          <div style={{ fontSize: 13, color: pwdMessage.ok ? "#27ae60" : "#e74c3c", fontWeight: 500 }}>
            {pwdMessage.text}
          </div>
        )}
        <div>
          <button onClick={changePassword} disabled={pwdLoading || !newPassword}
            style={{ padding: "9px 20px", background: newPassword ? m.couleur : "#e0e0e0", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: newPassword ? "pointer" : "not-allowed" }}>
            {pwdLoading ? "Mise à jour…" : "Changer le mot de passe"}
          </button>
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

function ChampTextarea({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <label style={labelStyle}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "#bbb" }}>Variables : {hint}</span>}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
    </div>
  );
}

function Toggle({ label, description, value, onChange, couleur }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; couleur: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: "none", background: value ? couleur : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
      >
        <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };
const miniInput: React.CSSProperties = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
function btnSmall(bg: string): React.CSSProperties { return { padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer" }; }
const btnSmallGhost: React.CSSProperties = { padding: "5px 10px", background: "none", border: "1px solid #ddd", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#555" };

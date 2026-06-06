"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";

type Depense = { id: string; categorie: string; montant: number; date: string; note: string };
type RecettePresta = { nom: string; nb: number; ca: number };

const CATEGORIES = ["Loyer", "Logiciels", "Assurance", "Achat produits", "Prévoyance", "Charges sociales", "Autres"];
const TAUX_URSSAF = 0.22;

function getMois(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return {
    debut: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
    fin: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${dernier}`,
    label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
  };
}

function euro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function FinancesPage() {
  const salon = useSalon();
  const [moisOffset, setMoisOffset] = useState(0);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [recettes, setRecettes] = useState<RecettePresta[]>([]);
  const [caTotal, setCaTotal] = useState(0);
  const [objectif, setObjectif] = useState(0);
  const [objectifEdit, setObjectifEdit] = useState("");
  const [loading, setLoading] = useState(true);
  const [newDep, setNewDep] = useState({ categorie: "Loyer", montant: "", date: new Date().toISOString().split("T")[0], note: "" });
  const [savingObjectif, setSavingObjectif] = useState(false);
  const [savedObjectif, setSavedObjectif] = useState(false);
  const [adding, setAdding] = useState(false);

  const isFree = salon?.plan !== "business" && salon?.plan !== "team";

  useEffect(() => {
    if (!salon) return;
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon, moisOffset]);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const supabase = createSupabase();
    const { debut, fin } = getMois(moisOffset);

    const [rdvRes, depRes, settingsRes] = await Promise.all([
      supabase
        .from("rendez_vous")
        .select("rendez_vous_prestations(prestations(nom, tarif, sur_devis))")
        .eq("salon_id", salon.id)
        .in("statut", ["confirme", "termine"])
        .gte("date_heure", `${debut}T00:00:00`)
        .lte("date_heure", `${fin}T23:59:59`),
      supabase
        .from("depenses")
        .select("*")
        .eq("salon_id", salon.id)
        .gte("date", debut)
        .lte("date", fin)
        .order("date", { ascending: false }),
      supabase
        .from("app_settings")
        .select("objectif_ca_mensuel")
        .eq("salon_id", salon.id)
        .single(),
    ]);

    const map: Record<string, { nb: number; ca: number }> = {};
    let total = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rdvRes.data || []).forEach((rdv: any) => {
      (rdv.rendez_vous_prestations || []).forEach((rp: any) => {
        const p = rp.prestations;
        if (!p || p.sur_devis) return;
        if (!map[p.nom]) map[p.nom] = { nb: 0, ca: 0 };
        map[p.nom].nb++;
        map[p.nom].ca += p.tarif;
        total += p.tarif;
      });
    });

    setRecettes(Object.entries(map).map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.ca - a.ca));
    setCaTotal(total);
    setDepenses((depRes.data || []) as Depense[]);

    const obj = settingsRes.data?.objectif_ca_mensuel ?? 0;
    setObjectif(obj);
    setObjectifEdit(obj > 0 ? String(obj) : "");
    setLoading(false);
  }

  async function addDepense() {
    if (!salon || !newDep.montant || !newDep.date || adding) return;
    setAdding(true);
    const supabase = createSupabase();
    const { data } = await supabase
      .from("depenses")
      .insert({ salon_id: salon.id, categorie: newDep.categorie, montant: parseFloat(newDep.montant), date: newDep.date, note: newDep.note })
      .select()
      .single();
    if (data) setDepenses(prev => [data as Depense, ...prev]);
    setNewDep(prev => ({ ...prev, montant: "", note: "" }));
    setAdding(false);
  }

  async function deleteDepense(id: string) {
    const supabase = createSupabase();
    await supabase.from("depenses").delete().eq("id", id);
    setDepenses(prev => prev.filter(d => d.id !== id));
  }

  async function saveObjectif() {
    if (!salon) return;
    setSavingObjectif(true);
    const supabase = createSupabase();
    await supabase.from("app_settings").update({ objectif_ca_mensuel: parseFloat(objectifEdit) || 0 }).eq("salon_id", salon.id);
    setObjectif(parseFloat(objectifEdit) || 0);
    setSavingObjectif(false);
    setSavedObjectif(true);
    setTimeout(() => setSavedObjectif(false), 2000);
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  if (isFree) {
    return (
      <div style={{ padding: "60px 32px", maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>💰</div>
        <h2 style={{ fontFamily: T.heading, fontSize: 32, marginBottom: 12 }}>Suivi financier</h2>
        <p style={{ color: T.muted, lineHeight: 1.7, marginBottom: 28 }}>
          Suivez vos recettes et dépenses chaque mois, estimez votre URSSAF et pilotez votre bilan net — sans tableur.
        </p>
        <a href="/api/stripe/checkout?plan=business" style={{ background: m.couleur, color: T.white, padding: "12px 28px", borderRadius: T.radius, display: "inline-block", fontSize: 13, textDecoration: "none" }}>
          Passer à Business — 39€/mois
        </a>
      </div>
    );
  }

  const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0);
  const urssaf = Math.round(caTotal * TAUX_URSSAF * 100) / 100;
  const bilanNet = caTotal - totalDepenses - urssaf;
  const progression = objectif > 0 ? Math.min((caTotal / objectif) * 100, 100) : 0;
  const { label } = getMois(moisOffset);

  return (
    <div style={{ padding: "32px", maxWidth: 960, margin: "0 auto" }}>
      <style>{`
        .fin-kpis { display: flex; gap: 12px; flex-wrap: wrap; }
        .fin-kpi { flex: 1; background: ${T.white}; border: 1px solid ${T.border}; border-radius: ${T.radius}px; padding: 20px 24px; min-width: 160px; }
        .fin-section { background: ${T.white}; border: 1px solid ${T.border}; border-radius: ${T.radius}px; padding: 24px; margin-top: 20px; }
        .fin-table { width: 100%; border-collapse: collapse; }
        .fin-table th { text-align: left; padding: 8px 12px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.muted}; border-bottom: 1px solid ${T.border}; }
        .fin-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid ${T.border}; }
        .fin-table tr:last-child td { border-bottom: none; }
        .fin-add { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px; }
        .fin-add input, .fin-add select { border: 1px solid ${T.border}; border-radius: ${T.radiusSm}px; padding: 8px 10px; font-size: 13px; background: ${T.bg}; color: ${T.text}; font-family: ${T.body}; min-width: 0; }
        @media (max-width: 640px) {
          .fin-kpi { min-width: calc(50% - 6px); }
          .fin-add { flex-direction: column; }
          .fin-add input, .fin-add select, .fin-add button { width: 100% !important; }
          .fin-table th:nth-child(3), .fin-table td:nth-child(3) { display: none; }
        }
      `}</style>

      {/* Navigation mois */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => setMoisOffset(o => o - 1)}
          style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: "6px 14px", cursor: "pointer", color: T.muted, fontSize: 16, lineHeight: 1 }}
        >
          ←
        </button>
        <h1 style={{ fontFamily: T.heading, fontSize: 26, textTransform: "capitalize", flex: 1, textAlign: "center", margin: 0 }}>
          {label}
        </h1>
        <button
          onClick={() => setMoisOffset(o => Math.min(o + 1, 0))}
          disabled={moisOffset >= 0}
          style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: "6px 14px", cursor: moisOffset >= 0 ? "default" : "pointer", color: moisOffset >= 0 ? T.faint : T.muted, fontSize: 16, lineHeight: 1 }}
        >
          →
        </button>
      </div>

      {/* KPIs */}
      <div className="fin-kpis">
        <div className="fin-kpi">
          <div style={{ ...T.ls, color: T.muted, marginBottom: 6 }}>CA brut</div>
          <div style={{ fontFamily: T.heading, fontSize: 28, color: m.couleur }}>{euro(caTotal)}</div>
        </div>
        <div className="fin-kpi">
          <div style={{ ...T.ls, color: T.muted, marginBottom: 6 }}>Dépenses</div>
          <div style={{ fontFamily: T.heading, fontSize: 28, color: "#dc2626" }}>{euro(totalDepenses)}</div>
        </div>
        <div className="fin-kpi">
          <div style={{ ...T.ls, color: T.muted, marginBottom: 6 }}>URSSAF est.</div>
          <div style={{ fontFamily: T.heading, fontSize: 28, color: "#d97706" }}>{euro(urssaf)}</div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>22% du CA</div>
        </div>
        <div className="fin-kpi">
          <div style={{ ...T.ls, color: T.muted, marginBottom: 6 }}>Bilan net</div>
          <div style={{ fontFamily: T.heading, fontSize: 28, color: bilanNet >= 0 ? "#16a34a" : "#dc2626" }}>{euro(bilanNet)}</div>
        </div>
      </div>

      {/* Objectif */}
      <div className="fin-section">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: objectif > 0 ? 16 : 0 }}>
          <span style={{ ...T.ls, color: T.muted, flex: 1, minWidth: 120 }}>Objectif CA mensuel</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              value={objectifEdit}
              onChange={e => setObjectifEdit(e.target.value)}
              placeholder="ex : 3500"
              style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: "7px 10px", fontSize: 13, width: 120, background: T.bg, fontFamily: T.body }}
            />
            <span style={{ fontSize: 13, color: T.muted }}>€</span>
            <button
              onClick={saveObjectif}
              disabled={savingObjectif}
              style={{ background: m.couleur, color: T.white, border: "none", borderRadius: T.radiusSm, padding: "7px 16px", cursor: "pointer", fontSize: 12 }}
            >
              {savedObjectif ? "✓ Sauvegardé" : savingObjectif ? "..." : "Sauvegarder"}
            </button>
          </div>
        </div>
        {objectif > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 6 }}>
              <span>{euro(caTotal)}</span>
              <span>Objectif : {euro(objectif)}</span>
            </div>
            <div style={{ background: T.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${progression}%`, height: "100%", background: progression >= 100 ? "#16a34a" : m.couleur, borderRadius: 99, transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 6, textAlign: "right" }}>
              {Math.round(progression)}% — {euro(Math.max(objectif - caTotal, 0))} restant
            </div>
          </>
        )}
      </div>

      {/* Recettes */}
      <div className="fin-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontFamily: T.heading, fontSize: 20, margin: 0 }}>Recettes</h2>
          <span style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em" }}>Calculées depuis vos RDV confirmés</span>
        </div>
        {loading ? (
          <div style={{ color: T.muted, fontSize: 13 }}>Chargement...</div>
        ) : recettes.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13 }}>Aucun rendez-vous confirmé ce mois.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Prestation</th>
                <th style={{ textAlign: "right" }}>Nb</th>
                <th style={{ textAlign: "right" }}>CA</th>
              </tr>
            </thead>
            <tbody>
              {recettes.map(r => (
                <tr key={r.nom}>
                  <td>{r.nom}</td>
                  <td style={{ textAlign: "right", color: T.muted }}>{r.nb}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{euro(r.ca)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>Total</td>
                <td />
                <td style={{ textAlign: "right", fontWeight: 600, color: m.couleur }}>{euro(caTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Dépenses */}
      <div className="fin-section">
        <h2 style={{ fontFamily: T.heading, fontSize: 20, margin: "0 0 20px" }}>Dépenses</h2>

        <div className="fin-add">
          <select
            value={newDep.categorie}
            onChange={e => setNewDep(p => ({ ...p, categorie: e.target.value }))}
            style={{ width: 150 }}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            type="number"
            placeholder="Montant (€)"
            value={newDep.montant}
            onChange={e => setNewDep(p => ({ ...p, montant: e.target.value }))}
            style={{ width: 130 }}
          />
          <input
            type="date"
            value={newDep.date}
            onChange={e => setNewDep(p => ({ ...p, date: e.target.value }))}
            style={{ width: 150 }}
          />
          <input
            type="text"
            placeholder="Note (optionnel)"
            value={newDep.note}
            onChange={e => setNewDep(p => ({ ...p, note: e.target.value }))}
            style={{ flex: 1, minWidth: 140 }}
          />
          <button
            onClick={addDepense}
            disabled={adding || !newDep.montant || !newDep.date}
            style={{ background: m.couleur, color: T.white, border: "none", borderRadius: T.radiusSm, padding: "8px 20px", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", opacity: (!newDep.montant || !newDep.date) ? 0.5 : 1 }}
          >
            + Ajouter
          </button>
        </div>

        {depenses.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13 }}>Aucune dépense ce mois. Ajoutez votre première dépense ci-dessus.</div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Date</th>
                <th>Note</th>
                <th style={{ textAlign: "right" }}>Montant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {depenses.map(d => (
                <tr key={d.id}>
                  <td>{d.categorie}</td>
                  <td style={{ color: T.muted, whiteSpace: "nowrap" }}>
                    {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </td>
                  <td style={{ color: T.muted, fontSize: 12 }}>{d.note || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{euro(d.montant)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => deleteDepense(d.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, fontSize: 15, padding: "0 4px", lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ fontWeight: 600 }}>Total dépenses</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "#dc2626" }}>{euro(totalDepenses)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

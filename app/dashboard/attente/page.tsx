"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { T } from "@/lib/theme";

type Entry = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  prestation_ids: string[];
  date_souhaitee: string;
  statut: string;
  notifie_le: string | null;
  created_at: string;
  heure_debut: string | null;
  heure_fin: string | null;
};

const STATUT_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  en_attente: { label: "En attente", bg: "#fef3c7", color: "#92400e" },
  notifie: { label: "À contacter", bg: "#dbeafe", color: "#1e40af" },
  converti: { label: "A réservé", bg: "#dcfce7", color: "#166534" },
  expire: { label: "Expiré", bg: "#f3f4f6", color: "#6b7280" },
  annule: { label: "Annulé", bg: "#fee2e2", color: "#991b1b" },
};

export default function ListeAttentePage() {
  const salon = useSalon();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prestNames, setPrestNames] = useState<Record<string, string>>({});
  const [prestTarifs, setPrestTarifs] = useState<Record<string, number>>({});
  const [prestDurees, setPrestDurees] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filtreActif, setFiltreActif] = useState(true);
  const [planningEntry, setPlanningEntry] = useState<Entry | null>(null);
  const [planDate, setPlanDate] = useState("");
  const [planHeure, setPlanHeure] = useState("");
  const [planError, setPlanError] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const CRENEAUX = Array.from({ length: 30 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`);

  async function load() {
    if (!salon) return;
    const supabase = createSupabase();
    const [{ data: la }, { data: prest }] = await Promise.all([
      supabase.from("liste_attente").select("*").eq("salon_id", salon.id).order("date_souhaitee", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("prestations").select("id, nom, tarif, duree_minutes").eq("salon_id", salon.id),
    ]);
    const names: Record<string, string> = {};
    const tarifs: Record<string, number> = {};
    const durees: Record<string, number> = {};
    (prest || []).forEach((p: { id: string; nom: string; tarif: number; duree_minutes: number }) => { names[p.id] = p.nom; tarifs[p.id] = p.tarif; durees[p.id] = p.duree_minutes; });
    setPrestNames(names);
    setPrestTarifs(tarifs);
    setPrestDurees(durees);
    setEntries((la || []) as Entry[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [salon]);

  function ouvrirPlanification(e: Entry) {
    setPlanningEntry(e);
    setPlanDate(e.date_souhaitee);
    setPlanHeure(e.heure_debut || "");
    setPlanError("");
  }

  async function planifierRdv() {
    if (!planningEntry || !planDate || !planHeure || !salon) return;
    setSavingPlan(true); setPlanError("");
    const supabase = createSupabase();

    // Trouver ou créer le client
    let clientId: string;
    const { data: existing } = await supabase.from("clients").select("id").eq("salon_id", salon.id).eq("email", planningEntry.email).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: newClient, error: clientErr } = await supabase.from("clients").insert({ salon_id: salon.id, prenom: planningEntry.prenom, nom: planningEntry.nom, email: planningEntry.email, telephone: planningEntry.telephone }).select("id").single();
      if (clientErr || !newClient) { setPlanError("Erreur lors de la création du client."); setSavingPlan(false); return; }
      clientId = newClient.id;
    }

    // Créer le RDV — via create_rdv_safe pour bloquer les créneaux déjà occupés
    const duree = planningEntry.prestation_ids.reduce((s, pid) => s + (prestDurees[pid] || 0), 0) || 60;
    const { data: rdvId, error: rdvErr } = await supabase.rpc("create_rdv_safe", {
      p_salon_id: salon.id,
      p_client_id: clientId,
      p_date_heure: `${planDate}T${planHeure}:00`,
      p_duree_minutes: duree,
      p_statut: "planifie",
      p_cancel_token: crypto.randomUUID(),
      p_adresse_domicile: null,
      p_notes: null,
      p_tarif: null,
      p_montant_cagnotte_utilise: null,
      p_source: "salon",
    });
    if (rdvErr || !rdvId) {
      setPlanError(
        rdvErr?.message?.includes("CONFLIT_CRENEAU")
          ? "Ce créneau chevauche un rendez-vous existant. Choisissez une autre heure."
          : "Erreur lors de la création du rendez-vous."
      );
      setSavingPlan(false);
      return;
    }

    // Lier les prestations
    if (planningEntry.prestation_ids.length > 0) {
      await supabase.from("rendez_vous_prestations").insert(planningEntry.prestation_ids.map(pid => ({ rendez_vous_id: rdvId as string, prestation_id: pid })));
    }

    // Marquer comme converti
    await supabase.from("liste_attente").update({ statut: "converti" }).eq("id", planningEntry.id);
    setEntries(prev => prev.map(e => e.id === planningEntry!.id ? { ...e, statut: "converti" } : e));
    setPlanningEntry(null);
    setSavingPlan(false);
  }

  async function setStatut(id: string, statut: string) {
    const supabase = createSupabase();
    await supabase.from("liste_attente").update({ statut }).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, statut } : e));
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const today = new Date().toISOString().slice(0, 10);
  const visibles = entries.filter(e => {
    if (!filtreActif) return true;
    return e.date_souhaitee >= today && e.statut !== "converti" && e.statut !== "annule" && e.statut !== "expire";
  });

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <div className="att-wrap" style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .att-wrap { padding: 20px 16px !important; }
          .att-card { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Link href="/dashboard/agenda" style={{ fontSize: 13, color: T.muted, textDecoration: "none" }}>← Agenda</Link>
      </div>
      <h1 style={{ margin: "0 0 6px", fontFamily: T.heading, fontSize: 30, fontWeight: 600, color: T.text, letterSpacing: "-0.3px" }}>Liste d'attente</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: 600 }}>
        Quand un rendez-vous s'annule, vous recevez un email avec la liste des clientes en attente ce jour-là. À vous de les contacter directement.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setFiltreActif(true)}
          style={{ padding: "7px 16px", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${filtreActif ? m.couleur : T.border}`, background: filtreActif ? m.couleur : T.white, color: filtreActif ? "#fff" : T.muted }}>
          À venir
        </button>
        <button onClick={() => setFiltreActif(false)}
          style={{ padding: "7px 16px", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${!filtreActif ? m.couleur : T.border}`, background: !filtreActif ? m.couleur : T.white, color: !filtreActif ? "#fff" : T.muted }}>
          Tout l'historique
        </button>
      </div>

      {loading ? (
        <div style={{ color: T.faint, fontSize: 14 }}>Chargement...</div>
      ) : visibles.length === 0 ? (
        <div style={{ color: T.faint, fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          {filtreActif ? "Personne en attente pour le moment." : "Aucune inscription à ce jour."}
        </div>
      ) : (() => {
        // Grouper par jour, dans chaque groupe les entrées sont déjà triées par created_at ASC (premier arrivé en tête)
        const groups: Record<string, Entry[]> = {};
        for (const e of visibles) {
          if (!groups[e.date_souhaitee]) groups[e.date_souhaitee] = [];
          groups[e.date_souhaitee].push(e);
        }
        const sortedDates = Object.keys(groups).sort();
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {sortedDates.map(date => {
              const group = groups[date];
              const isToday = date === today;
              return (
                <div key={date}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: m.couleur, textTransform: "capitalize" }}>{formatDate(date)}</div>
                    {isToday && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>Aujourd'hui</span>}
                    <div style={{ fontSize: 12, color: T.faint }}>{group.filter(e => e.statut === "en_attente").length} en attente</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {group.map((e, idx) => {
                      const st = STATUT_LABEL[e.statut] || STATUT_LABEL.en_attente;
                      const prestations = (e.prestation_ids || []).map(id => prestNames[id]).filter(Boolean).join(" + ");
                      const tarifTotal = (e.prestation_ids || []).reduce((s, id) => s + (prestTarifs[id] || 0), 0);
                      const position = idx + 1;
                      const ordinal = position === 1 ? "1er" : `${position}e`;
                      return (
                        <div key={e.id} className="att-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: e.statut === "en_attente" ? m.couleurClaire : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: e.statut === "en_attente" ? m.couleur : T.muted }}>
                              {ordinal}
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{e.prenom} {e.nom}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                              {(e.heure_debut || e.heure_fin) && (
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#f0f9ff", color: "#0369a1", fontWeight: 600 }}>
                                  {e.heure_debut && e.heure_fin ? `${e.heure_debut} – ${e.heure_fin}` : e.heure_debut ? `Dès ${e.heure_debut}` : `Avant ${e.heure_fin}`}
                                </span>
                              )}
                            </div>
                            {prestations && (
                              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
                                {prestations}
                                {tarifTotal > 0 && <span style={{ marginLeft: 8, fontWeight: 600, color: T.text }}>{tarifTotal} €</span>}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.muted }}>
                              <a href={`tel:${e.telephone}`} style={{ color: T.muted, textDecoration: "none" }}>📞 {e.telephone}</a>
                              <a href={`mailto:${e.email}`} style={{ color: T.muted, textDecoration: "none" }}>✉️ {e.email}</a>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {e.statut !== "converti" && (
                              <button onClick={() => ouvrirPlanification(e)}
                                style={{ padding: "6px 12px", borderRadius: T.radiusSm, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${m.couleur}40`, background: `${m.couleur}10`, color: m.couleur }}>
                                Planifier
                              </button>
                            )}
                            {e.statut !== "annule" && (
                              <button onClick={() => setStatut(e.id, "annule")} title="Retirer de la liste"
                                style={{ padding: "6px 12px", borderRadius: T.radiusSm, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${T.border}`, background: T.white, color: T.muted }}>
                                Retirer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {planningEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setPlanningEntry(null)}>
          <div style={{ background: T.white, borderRadius: 14, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Planifier le rendez-vous</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
              {planningEntry.prenom} {planningEntry.nom}
              {planningEntry.prestation_ids.length > 0 && (
                <span style={{ marginLeft: 8, color: m.couleur, fontWeight: 600 }}>
                  · {planningEntry.prestation_ids.map(id => prestNames[id]).filter(Boolean).join(" + ")}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>Date *</label>
                <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>Heure *</label>
                <select value={planHeure} onChange={e => setPlanHeure(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, background: "#fff" }}>
                  <option value="">Choisir un créneau</option>
                  {CRENEAUX.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            {planError && <div style={{ marginTop: 12, fontSize: 13, color: "#dc2626" }}>{planError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setPlanningEntry(null)} style={{ flex: 1, padding: "10px", background: "#f0f0f0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={planifierRdv} disabled={savingPlan || !planDate || !planHeure}
                style={{ flex: 2, padding: "10px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (!planDate || !planHeure || savingPlan) ? 0.5 : 1 }}>
                {savingPlan ? "Création..." : "Créer le rendez-vous"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

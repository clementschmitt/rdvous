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
};

const STATUT_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  en_attente: { label: "En attente", bg: "#fef3c7", color: "#92400e" },
  notifie: { label: "Notifié·e", bg: "#dbeafe", color: "#1e40af" },
  converti: { label: "A réservé", bg: "#dcfce7", color: "#166534" },
  expire: { label: "Expiré", bg: "#f3f4f6", color: "#6b7280" },
  annule: { label: "Annulé", bg: "#fee2e2", color: "#991b1b" },
};

export default function ListeAttentePage() {
  const salon = useSalon();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prestNames, setPrestNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filtreActif, setFiltreActif] = useState(true);

  async function load() {
    if (!salon) return;
    const supabase = createSupabase();
    const [{ data: la }, { data: prest }] = await Promise.all([
      supabase.from("liste_attente").select("*").eq("salon_id", salon.id).order("date_souhaitee", { ascending: true }),
      supabase.from("prestations").select("id, nom").eq("salon_id", salon.id),
    ]);
    const names: Record<string, string> = {};
    (prest || []).forEach((p: { id: string; nom: string }) => { names[p.id] = p.nom; });
    setPrestNames(names);
    setEntries((la || []) as Entry[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [salon]);

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
        Les clientes inscrites ici sont prévenues automatiquement par email et SMS dès qu'un rendez-vous s'annule le jour qu'elles souhaitent.
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibles.map(e => {
            const st = STATUT_LABEL[e.statut] || STATUT_LABEL.en_attente;
            const prestations = (e.prestation_ids || []).map(id => prestNames[id]).filter(Boolean).join(" + ");
            return (
              <div key={e.id} className="att-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px", background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{e.prenom} {e.nom}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: m.couleur, fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>{formatDate(e.date_souhaitee)}</div>
                  {prestations && <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>{prestations}</div>}
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.muted }}>
                    <a href={`tel:${e.telephone}`} style={{ color: T.muted, textDecoration: "none" }}>📞 {e.telephone}</a>
                    <a href={`mailto:${e.email}`} style={{ color: T.muted, textDecoration: "none" }}>✉️ {e.email}</a>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {e.statut !== "converti" && (
                    <button onClick={() => setStatut(e.id, "converti")} title="Marquer comme ayant réservé"
                      style={{ padding: "6px 12px", borderRadius: T.radiusSm, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #16a34a40", background: "#16a34a10", color: "#166534" }}>
                      A réservé
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
      )}
    </div>
  );
}

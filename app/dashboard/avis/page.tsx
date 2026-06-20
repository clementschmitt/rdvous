"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";

type Avis = {
  id: string;
  token: string;
  note: number | null;
  commentaire: string | null;
  statut: string;
  created_at: string;
  rdv_id: string;
  rendez_vous: { date_heure: string; clients: { prenom: string; nom: string } | null } | null;
};

function Etoiles({ note, size = 16 }: { note: number; size?: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= note ? "#f5a623" : "#e0e0e0", lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

export default function AvisDashboardPage() {
  const salon = useSalon();
  const [avis, setAvis] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon]);

  async function load() {
    const supabase = createSupabase();
    const { data } = await supabase
      .from("avis")
      .select("id, token, note, commentaire, statut, created_at, rdv_id, rendez_vous(date_heure, clients(prenom, nom))")
      .eq("salon_id", salon!.id)
      .not("note", "is", null)
      .order("created_at", { ascending: false });
    setAvis((data || []) as unknown as Avis[]);
    setLoading(false);
  }

  async function toggleStatut(a: Avis) {
    const next = a.statut === "visible" ? "masque" : "visible";
    const supabase = createSupabase();
    await supabase.from("avis").update({ statut: next }).eq("id", a.id);
    setAvis(prev => prev.map(x => x.id === a.id ? { ...x, statut: next } : x));
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const avecNote = avis.filter(a => a.note !== null);
  const moyenne = avecNote.length > 0
    ? avecNote.reduce((s, a) => s + (a.note || 0), 0) / avecNote.length
    : null;

  const dist = [5, 4, 3, 2, 1].map(n => ({
    note: n,
    count: avecNote.filter(a => a.note === n).length,
  }));

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: "0 auto" }}>
      <style>{`@media (max-width: 640px) { .avis-wrap { padding: 16px !important; } }`}</style>
      <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700 }}>Avis clients</h1>

      {loading ? (
        <div style={{ color: "#aaa", fontSize: 14 }}>Chargement…</div>
      ) : avecNote.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", padding: "40px 32px", textAlign: "center", color: "#aaa" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 14 }}>Aucun avis pour l'instant. Les demandes sont envoyées automatiquement le lendemain de chaque rendez-vous.</div>
        </div>
      ) : (
        <>
          {/* Résumé */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", padding: "20px 24px", marginBottom: 20, display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: "#1a1a1a", lineHeight: 1 }}>{moyenne!.toFixed(1).replace(".", ",")}</div>
              <Etoiles note={Math.round(moyenne!)} size={18} />
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{avecNote.length} avis</div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              {dist.map(d => (
                <div key={d.note} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#888", width: 14, textAlign: "right" }}>{d.note}</span>
                  <span style={{ fontSize: 12, color: "#f5a623" }}>★</span>
                  <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: avecNote.length > 0 ? `${(d.count / avecNote.length) * 100}%` : "0%", background: m.couleur, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#aaa", width: 20 }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Liste */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {avis.map(a => {
              const rdv = a.rendez_vous as unknown as { date_heure: string; clients: { prenom: string; nom: string } | null } | null;
              const client = rdv?.clients;
              const dateRdv = rdv?.date_heure ? new Date(rdv.date_heure).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
              const masque = a.statut === "masque";
              return (
                <div key={a.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #ebebeb", padding: "16px 20px", opacity: masque ? 0.55 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <Etoiles note={a.note!} />
                        <span style={{ fontSize: 12, color: "#bbb" }}>· {dateRdv}</span>
                        {client && <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{client.prenom} {client.nom}</span>}
                      </div>
                      {a.commentaire && (
                        <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.6 }}>{a.commentaire}</p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleStatut(a)}
                      title={masque ? "Rendre visible" : "Masquer"}
                      style={{ flexShrink: 0, background: "none", border: `1px solid ${masque ? "#e0e0e0" : "#f0f0f0"}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer", color: masque ? "#aaa" : "#888", whiteSpace: "nowrap" }}>
                      {masque ? "Masqué" : "Visible"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

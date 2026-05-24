"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { T } from "@/lib/theme";

type Client = { id: string; prenom: string; nom: string; telephone: string | null; cagnotte: number };

export default function ClientsPage() {
  const salon = useSalon();
  const [clients, setClients] = useState<Client[]>([]);
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salon) return;
    (async () => {
      const supabase = createSupabase();
      const { data } = await supabase
        .from("clients")
        .select("id, prenom, nom, telephone, cagnotte")
        .eq("salon_id", salon.id)
        .order("nom");
      setClients((data || []) as Client[]);
      setLoading(false);
    })();
  }, [salon]);

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const filtrés = clients.filter(c =>
    `${c.prenom} ${c.nom} ${c.telephone || ""}`.toLowerCase().includes(recherche.toLowerCase())
  );

  function initiales(prenom: string, nom: string) {
    return `${prenom[0] || ""}${nom[0] || ""}`.toUpperCase();
  }

  return (
    <div className="clients-wrap" style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .clients-wrap { padding: 20px 16px !important; }
          .clients-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>
      <div className="clients-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontFamily: T.heading, fontSize: 30, fontWeight: 600, color: T.text, letterSpacing: "-0.3px" }}>{m.labelClients}</h1>
        <Link
          href="/dashboard/clients/nouveau"
          style={{ padding: "8px 20px", background: m.couleur, color: "#fff", borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          + Nouveau
        </Link>
      </div>

      <input
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder={`Rechercher parmi ${clients.length} ${m.labelClients.toLowerCase()}...`}
        style={{ width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, marginBottom: 16, boxSizing: "border-box", background: T.white, color: T.text, outline: "none" }}
      />

      {loading ? (
        <div style={{ color: T.faint, fontSize: 14 }}>Chargement...</div>
      ) : filtrés.length === 0 ? (
        <div style={{ color: T.faint, fontSize: 14 }}>{recherche ? "Aucun résultat" : `Aucun·e ${m.labelClients.toLowerCase()} pour l'instant.`}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtrés.map(c => (
            <Link
              key={c.id}
              href={`/dashboard/clients/${c.id}`}
              style={{ display: "flex", alignItems: "center", gap: 16, background: T.white, borderRadius: T.radius, padding: "14px 20px", textDecoration: "none", color: "inherit", boxShadow: T.shadow, border: `1px solid ${T.border}` }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${m.couleur}18`, color: m.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, fontFamily: T.body, flexShrink: 0 }}>
                {initiales(c.prenom, c.nom)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{c.prenom} {c.nom}</div>
                {c.telephone && <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{c.telephone}</div>}
              </div>
              {c.cagnotte > 0 && (
                <div style={{ fontSize: 12, fontWeight: 600, color: m.couleur, background: `${m.couleur}12`, padding: "3px 10px", borderRadius: 20 }}>
                  {c.cagnotte.toFixed(0)} € cagnotte
                </div>
              )}
              <span style={{ color: T.border, fontSize: 18 }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

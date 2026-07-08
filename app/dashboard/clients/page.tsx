"use client";
import { useEffect, useState, Suspense } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { T } from "@/lib/theme";

function MergedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("merged") !== "1") return null;
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#166534", fontWeight: 500 }}>
      Fusion effectuée. Les fiches ont été regroupées.
    </div>
  );
}

type Client = { id: string; prenom: string; nom: string; telephone: string | null; cagnotte: number };
type ClientTag = { id: string; nom: string; couleur: string };

export default function ClientsPage() {
  const salon = useSalon();
  const [clients, setClients] = useState<Client[]>([]);
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);
  const [salonTags, setSalonTags] = useState<ClientTag[]>([]);
  const [clientTagMap, setClientTagMap] = useState<Record<string, ClientTag[]>>({});
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    (async () => {
      const supabase = createSupabase();
      const [{ data: clientsData }, { data: tagsData }] = await Promise.all([
        supabase.from("clients").select("id, prenom, nom, telephone, cagnotte").eq("salon_id", salon.id).order("nom"),
        supabase.from("client_tags").select("id, nom, couleur").eq("salon_id", salon.id).order("created_at"),
      ]);
      const clientList = (clientsData || []) as Client[];
      setClients(clientList);
      setSalonTags((tagsData || []) as ClientTag[]);

      if (clientList.length > 0 && (tagsData || []).length > 0) {
        const clientIds = clientList.map(c => c.id);
        const { data: assignments } = await supabase
          .from("client_tag_assignments")
          .select("client_id, client_tags(id, nom, couleur)")
          .in("client_id", clientIds);
        const map: Record<string, ClientTag[]> = {};
        for (const a of (assignments || []) as unknown as { client_id: string; client_tags: ClientTag }[]) {
          if (!map[a.client_id]) map[a.client_id] = [];
          if (a.client_tags) map[a.client_id].push(a.client_tags);
        }
        setClientTagMap(map);
      }
      setLoading(false);
    })();
  }, [salon]);

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const filtrés = clients.filter(c => {
    const matchSearch = `${c.prenom} ${c.nom} ${c.telephone || ""}`.toLowerCase().includes(recherche.toLowerCase());
    const matchTag = !tagFilter || (clientTagMap[c.id] || []).some(t => t.id === tagFilter);
    return matchSearch && matchTag;
  });

  function initiales(prenom: string, nom: string) {
    return `${prenom[0] || ""}${nom[0] || ""}`.toUpperCase();
  }

  return (
    <div className="clients-wrap" style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .clients-wrap { padding: 20px 16px !important; }
          .clients-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>
      <Suspense><MergedBanner /></Suspense>
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
        style={{ width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, marginBottom: salonTags.length > 0 ? 10 : 16, boxSizing: "border-box", background: T.white, color: T.text, outline: "none" }}
      />
      {salonTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setTagFilter(null)}
            style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${tagFilter === null ? m.couleur : T.border}`, background: tagFilter === null ? m.couleur : T.white, color: tagFilter === null ? "#fff" : T.faint, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Tous
          </button>
          {salonTags.map(tag => (
            <button key={tag.id} onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, border: `1px solid ${tagFilter === tag.id ? tag.couleur : T.border}`, background: tagFilter === tag.id ? `${tag.couleur}18` : T.white, color: tagFilter === tag.id ? tag.couleur : T.faint, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: tag.couleur, display: "inline-block" }} />
              {tag.nom}
            </button>
          ))}
        </div>
      )}

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
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{c.prenom} {c.nom}</span>
                  {(clientTagMap[c.id] || []).map(tag => (
                    <span key={tag.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, background: `${tag.couleur}18`, border: `1px solid ${tag.couleur}50`, fontSize: 11, fontWeight: 700, color: tag.couleur }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tag.couleur, display: "inline-block" }} />
                      {tag.nom}
                    </span>
                  ))}
                </div>
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

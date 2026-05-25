"use client";
import { useState, useEffect } from "react";
import { createSupabase } from "@/lib/supabase";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";

const METIER_EMOJI: Record<string, string> = { manucure: "💅", coiffure: "✂️", toilettage: "🐾" };

type Salon = { id: string; nom: string; metier: string; ville: string | null; adresse: string | null; description: string | null; slug: string | null };

export default function RecherchePage() {
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [resultats, setResultats] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { if (nom.length >= 2 || ville.length >= 2) rechercher(); }, 350);
    return () => clearTimeout(t);
  }, [nom, ville]);

  async function rechercher() {
    setLoading(true);
    setSearched(true);
    const supabase = createSupabase();
    let query = supabase
      .from("salons")
      .select("id, nom, metier, ville, adresse, description, slug")
      .eq("visible_recherche", true)
      .order("nom")
      .limit(20);
    if (nom.trim()) query = query.ilike("nom", `%${nom.trim()}%`);
    if (ville.trim()) query = query.ilike("ville", `%${ville.trim()}%`);
    const { data } = await query;
    setResultats((data || []) as Salon[]);
    setLoading(false);
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data = await res.json();
        const cityName = data?.address?.city || data?.address?.town || data?.address?.village || "";
        setVille(cityName);
        setGeoLoading(false);
      },
      () => setGeoLoading(false)
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "0 40px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>
        <Link href="/pro" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>Vous êtes un professionnel ? →</Link>
      </div>

      {/* Search box */}
      <div style={{ background: "#1a1a1a", padding: "56px 40px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: "#fff", margin: "0 0 32px", textAlign: "center" }}>
            Retrouvez votre salon
          </h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Nom du salon..."
              style={{ flex: 2, minWidth: 200, padding: "12px 16px", borderRadius: 9, border: "none", fontSize: 14, outline: "none" }}
            />
            <div style={{ flex: 1, minWidth: 160, display: "flex", gap: 8 }}>
              <input
                value={ville}
                onChange={e => setVille(e.target.value)}
                placeholder="Ville..."
                style={{ flex: 1, padding: "12px 16px", borderRadius: 9, border: "none", fontSize: 14, outline: "none" }}
              />
              <button
                onClick={geolocate}
                disabled={geoLoading}
                title="Utiliser ma position"
                style={{ padding: "12px 14px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 16, color: "#fff" }}
              >
                {geoLoading ? "..." : "📍"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        {loading && <div style={{ textAlign: "center", color: "#aaa", fontSize: 14 }}>Recherche...</div>}

        {!loading && searched && resultats.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, color: "#999" }}>Aucun salon trouvé. Essayez avec un autre nom ou une autre ville.</div>
          </div>
        )}

        {!loading && !searched && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb", fontSize: 14 }}>
            Tapez le nom de votre salon pour commencer la recherche.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {resultats.map(salon => {
            const m = METIERS[salon.metier as keyof typeof METIERS];
            return (
              <Link key={salon.id} href={salon.slug ? `/${salon.slug}` : `/s/${salon.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "18px 22px", border: "1px solid #ebebeb", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: m ? `${m.couleur}18` : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {METIER_EMOJI[salon.metier] || "✂️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{salon.nom}</div>
                    <div style={{ fontSize: 13, color: "#999" }}>
                      {m?.label || salon.metier}{salon.ville ? ` · ${salon.ville}` : ""}{salon.adresse ? ` — ${salon.adresse}` : ""}
                    </div>
                    {salon.description && <div style={{ fontSize: 12, color: "#bbb", marginTop: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{salon.description}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: "#ccc", flexShrink: 0 }}>→</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

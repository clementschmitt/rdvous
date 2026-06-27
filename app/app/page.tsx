"use client";
import { useState, useEffect } from "react";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "manucure", label: "💅 Manucure" },
  { key: "coiffure", label: "✂️ Coiffure" },
  { key: "toilettage", label: "🐾 Toilettage" },
];

type Salon = {
  id: string;
  nom: string;
  metier: string;
  ville: string | null;
  adresse: string | null;
  description: string | null;
  slug: string | null;
};

export default function AppHomePage() {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("all");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const supabase = createSupabase();
      let query = supabase
        .from("salons_public")
        .select("id, nom, metier, ville, adresse, description, slug")
        .order("nom")
        .limit(30);
      if (search.trim()) query = query.ilike("nom", `%${search.trim()}%`);
      if (categorie !== "all") query = query.eq("metier", categorie);
      const { data } = await query;
      setSalons((data || []) as Salon[]);
      setLoading(false);
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, categorie]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#fafafa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "20px 20px 14px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: "#1a1a1a", marginBottom: 14 }}>
          rdvous
        </div>
        <div style={{ position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher un salon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 42px",
              borderRadius: 12, border: "1.5px solid #ebebeb", fontSize: 15,
              background: "#f8f8f8", outline: "none", color: "#1a1a1a",
            }}
          />
        </div>
      </div>

      {/* Catégories */}
      <div style={{
        padding: "12px 20px", display: "flex", gap: 8,
        overflowX: "auto", background: "#fff",
        borderBottom: "1px solid #f0f0f0",
        scrollbarWidth: "none",
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategorie(cat.key)}
            style={{
              padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              whiteSpace: "nowrap", fontSize: 14, fontWeight: 500,
              background: categorie === cat.key ? "#1a1a1a" : "#f2f2f2",
              color: categorie === cat.key ? "#fff" : "#555",
              flexShrink: 0,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb", fontSize: 14 }}>Chargement...</div>
        ) : salons.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb", fontSize: 14 }}>Aucun salon trouvé</div>
        ) : salons.map(salon => (
          <Link
            key={salon.id}
            href={salon.slug ? `/${salon.slug}` : `/s/${salon.id}`}
            style={{ textDecoration: "none" }}
          >
            <div style={{
              background: "#fff", borderRadius: 16, padding: "16px 18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
                    {salon.nom}
                  </div>
                  <div style={{ fontSize: 13, color: "#999" }}>
                    {salon.metier === "manucure" ? "💅" : salon.metier === "coiffure" ? "✂️" : "🐾"}{" "}
                    {salon.metier.charAt(0).toUpperCase() + salon.metier.slice(1)}
                    {salon.ville ? ` · ${salon.ville}` : ""}
                  </div>
                  {salon.description && (
                    <div style={{
                      fontSize: 13, color: "#777", marginTop: 6, lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                    }}>
                      {salon.description}
                    </div>
                  )}
                </div>
                <svg style={{ marginLeft: 12, flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

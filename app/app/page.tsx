"use client";
import { useState, useEffect } from "react";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useAccentColor } from "@/lib/accent-color";

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "manucure", label: "💅 Manucure" },
  { key: "coiffure", label: "✂️ Coiffure" },
];

const METIER_CONFIG: Record<string, { emoji: string; bg: string; color: string }> = {
  manucure:   { emoji: "💅", bg: "#fdf0f3", color: "#a0415a" },
  coiffure:   { emoji: "✂️", bg: "#f0f4fd", color: "#3a5ea0" },
  toilettage: { emoji: "🐾", bg: "#f0fdf4", color: "#3a7a50" },
};

type Salon = {
  id: string;
  nom: string;
  metier: string;
  ville: string | null;
  adresse: string | null;
  description: string | null;
  slug: string | null;
};

function SalonInitials({ nom, metier }: { nom: string; metier: string }) {
  const cfg = METIER_CONFIG[metier] || { bg: "#f5f5f5", color: "#888" };
  const initials = nom.split(" ").filter(w => /[a-zA-ZÀ-ÿ]/.test(w[0])).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 14, background: cfg.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 16, fontWeight: 700, color: cfg.color, flexShrink: 0,
      letterSpacing: "-0.5px",
    }}>
      {initials}
    </div>
  );
}

export default function AppHomePage() {
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("all");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [prenom, setPrenom] = useState<string | null>(null);
  const { color } = useAccentColor();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  useEffect(() => {
    localStorage.setItem("rdvous_app", "1");
    const supabase = createSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/mon-compte", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(json => { if (json.prenom) setPrenom(json.prenom); });
    });
  }, []);

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
      else query = query.neq("metier", "toilettage");
      const { data } = await query;
      setSalons((data || []) as Salon[]);
      setLoading(false);
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, categorie]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f7f7f7", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: color, padding: "20px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 56, height: 1.5, background: "rgba(255,255,255,0.5)", marginBottom: 5 }} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>rdvous</div>
          </div>
          {prenom && <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}>{greeting}, {prenom}</div>}
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" placeholder="Rechercher un salon..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "13px 16px 13px 42px",
              borderRadius: 14, border: "none", fontSize: 15,
              background: "#fff", outline: "none", color: "#1a1a1a",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            }}
          />
        </div>
      </div>

      {/* Catégories */}
      <div style={{ padding: "14px 20px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", background: "#f7f7f7" }}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setCategorie(cat.key)}
            style={{
              padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, flexShrink: 0,
              background: categorie === cat.key ? color : "#fff",
              color: categorie === cat.key ? "#fff" : "#555",
              boxShadow: categorie === cat.key ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Section title */}
      <div style={{ padding: "4px 20px 12px", fontSize: 13, fontWeight: 600, color: "#aaa", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {loading ? "" : `${salons.length} salon${salons.length !== 1 ? "s" : ""}`}
      </div>

      {/* Liste */}
      <div style={{ padding: "0 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 18, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#f0f0f0", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, background: "#f0f0f0", borderRadius: 6, width: "60%", marginBottom: 8 }} />
                <div style={{ height: 11, background: "#f5f5f5", borderRadius: 6, width: "40%" }} />
              </div>
            </div>
          ))
        ) : salons.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb", fontSize: 14 }}>Aucun salon trouvé</div>
        ) : salons.map(salon => {
          const cfg = METIER_CONFIG[salon.metier] || { emoji: "✨", bg: "#f5f5f5", color: "#888" };
          return (
            <Link key={salon.id} href={salon.slug ? `/${salon.slug}` : `/s/${salon.id}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <SalonInitials nom={salon.nom} metier={salon.metier} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {salon.nom}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 20 }}>
                      {cfg.emoji} {salon.metier.charAt(0).toUpperCase() + salon.metier.slice(1)}
                    </span>
                    {salon.ville && <span style={{ fontSize: 12, color: "#bbb" }}>{salon.ville}</span>}
                  </div>
                  {salon.description && (
                    <div style={{ fontSize: 12, color: "#999", marginTop: 5, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>
                      {salon.description}
                    </div>
                  )}
                </div>
                <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

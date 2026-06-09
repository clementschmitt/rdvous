"use client";
import { useState, useEffect, useRef } from "react";
import { createSupabase } from "@/lib/supabase";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";

type Salon = { id: string; nom: string; metier: string; ville: string | null; adresse: string | null; description: string | null; slug: string | null };

const METIER_EMOJI: Record<string, string> = { manucure: "💅", coiffure: "✂️", toilettage: "🐾" };

const CATEGORIES = [
  { label: "Instituts",      emoji: "✨", gradient: "linear-gradient(145deg,#f5c8b8,#e8a090,#d47a78)", filtre: null },
  { label: "Massage",        emoji: "🙌", gradient: "linear-gradient(145deg,#b8d4c0,#90b898,#6a9070)", filtre: null },
  { label: "Coiffure",       emoji: "✂️", gradient: "linear-gradient(145deg,#f0d8a0,#d8b870,#c09050)", filtre: "coiffure" },
  { label: "Barber",         emoji: "🪒", gradient: "linear-gradient(145deg,#aab8c8,#7890a8,#506882)", filtre: null },
  { label: "Onglerie",       emoji: "💅", gradient: "linear-gradient(145deg,#f0c0c8,#d89098,#c07078)", filtre: "manucure" },
  { label: "Spa & détente",  emoji: "🛁", gradient: "linear-gradient(145deg,#e8d4b8,#d0b890,#b89060)", filtre: null },
  { label: "Soins du corps", emoji: "🌿", gradient: "linear-gradient(145deg,#c8d8c0,#a8c0a0,#88a080)", filtre: null },
  { label: "Bien-être",      emoji: "🧘", gradient: "linear-gradient(145deg,#c8c0d8,#a8a0c0,#888098)", filtre: null },
  { label: "Vos animaux aussi 🐾", emoji: "🐶", gradient: "linear-gradient(145deg,#c8e0c8,#90b890,#5a8a5a)", filtre: "toilettage" },
];

const MOCK_ETABLISSEMENTS = [
  { nom: "Institut Lumière",    metier: "Soins visage",  ville: "Paris 11e",    note: 4.9, avis: 124, gradient: "linear-gradient(145deg,#f5c8b8,#e8a090)" },
  { nom: "Salon Atelier",       metier: "Coiffure",      ville: "Lyon 2e",      note: 4.8, avis:  87, gradient: "linear-gradient(145deg,#f0d8a0,#d8b870)" },
  { nom: "Bien-être & Co",      metier: "Massage",       ville: "Bordeaux",     note: 5.0, avis:  43, gradient: "linear-gradient(145deg,#b8d4c0,#90b898)" },
  { nom: "Nail Studio Élise",   metier: "Onglerie",      ville: "Toulouse",     note: 4.7, avis: 211, gradient: "linear-gradient(145deg,#f0c0c8,#d89098)" },
];

const WHY = [
  { icon: "🗺️", titre: "Près de chez vous",     desc: "Des artisans locaux soigneusement référencés dans votre quartier." },
  { icon: "⚡", titre: "Réservation rapide",     desc: "Trouvez et prenez rendez-vous en moins de 30 secondes." },
  { icon: "⭐", titre: "Artisans de confiance",  desc: "Des professionnels indépendants, des avis vérifiés, zéro surprise." },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [nom, setNom]           = useState("");
  const [ville, setVille]       = useState("");
  const [resultats, setResultats] = useState<Salon[]>([]);
  const [loading, setLoading]   = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (nom.length >= 2 || ville.length >= 2) { rechercher(); setShowResults(true); }
      else { setSearched(false); setResultats([]); setShowResults(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [nom, ville]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function rechercher() {
    setLoading(true); setSearched(true);
    const supabase = createSupabase();
    let q = supabase.from("salons").select("id,nom,metier,ville,adresse,description,slug").eq("visible_recherche", true).order("nom").limit(8);
    if (nom.trim())   q = q.ilike("nom",  `%${nom.trim()}%`);
    if (ville.trim()) q = q.ilike("ville",`%${ville.trim()}%`);
    const { data } = await q;
    setResultats((data || []) as Salon[]);
    setLoading(false);
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
      const data = await res.json();
      setVille(data?.address?.city || data?.address?.town || data?.address?.village || "");
      setGeoLoading(false);
    }, () => setGeoLoading(false));
  }

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f5", fontFamily:"'Inter',system-ui,sans-serif", color:"#1a1614", overflowX:"clip" }}>
      <style>{`
        .rdv-hamburger { display: none; }
        @media (max-width: 640px) {
          .rdv-nav { padding: 0 16px !important; }
          .rdv-nav-links { display: none !important; }
          .rdv-hamburger { display: block !important; }
          .rdv-section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 60px !important; padding-bottom: 60px !important; }
          .rdv-search-bar { flex-direction: column !important; }
          .rdv-search-nom { border-right: none !important; border-bottom: 1px solid rgba(200,180,160,0.3) !important; }
          .rdv-search-btn { margin: 0 !important; border-radius: 0 0 10px 10px !important; padding: 13px 28px !important; }
          .rdv-ville-row { position: relative !important; padding-right: 50px !important; padding-bottom: 14px !important; }
          .rdv-geo-btn { position: absolute !important; right: 8px !important; top: 50% !important; transform: translateY(-50%) !important; }
          .rdv-cat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .rdv-etab-grid { grid-template-columns: 1fr !important; }
          .rdv-why-grid { grid-template-columns: 1fr !important; }
          .rdv-cta-pro-inner { flex-direction: column !important; padding: 32px 24px !important; align-items: flex-start !important; }
          .rdv-footer { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (min-width: 641px) and (max-width: 960px) {
          .rdv-cat-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .rdv-etab-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <div style={{ position:"sticky", top:0, zIndex:200 }}>
        <nav className="rdv-nav" style={{ background:"rgba(250,248,245,0.92)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(200,180,160,0.25)", padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, letterSpacing:"0.03em", color:"#1a1614" }}>rdvous</span>
          <div className="rdv-nav-links" style={{ display:"flex", alignItems:"center", gap:20 }}>
            <Link href="/pro" style={{ fontSize:13, color:"#8a7a6a", textDecoration:"none" }}>Espace pro</Link>
            <Link href="/login" style={{ fontSize:13, fontWeight:600, color:"#fff", background:"#1a1614", padding:"9px 20px", borderRadius:10, textDecoration:"none", display:"flex", alignItems:"center", gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              Se connecter
            </Link>
          </div>
          <button className="rdv-hamburger" onClick={() => setMenuOpen(o => !o)}
            style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#1a1614", padding:"4px 8px", lineHeight:1 }}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>
        {menuOpen && (
          <div style={{ background:"rgba(250,248,245,0.98)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(200,180,160,0.25)", padding:"4px 24px 12px", display:"flex", flexDirection:"column" }}>
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ padding:"14px 0", fontSize:15, color:"#6a5a4a", textDecoration:"none", borderBottom:"1px solid rgba(200,180,160,0.15)", display:"block" }}>Se connecter</Link>
            <Link href="/pro" onClick={() => setMenuOpen(false)} style={{ padding:"14px 0", fontSize:15, fontWeight:700, color:"#1a1614", textDecoration:"none", display:"block" }}>Espace pro →</Link>
          </div>
        )}
      </div>

      {/* ── HERO ── */}
      <section style={{ position:"relative", minHeight:"88vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>

        {/* Fond dégradé immersif */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, #f5ede0 0%, #ede0d4 30%, #e0d0c0 60%, #d4c4b0 100%)" }} />
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 60% at 70% 40%, rgba(200,160,96,0.18) 0%, transparent 70%)" }} />
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 60% 80% at 20% 80%, rgba(168,200,160,0.15) 0%, transparent 60%)" }} />

        {/* Texte décoratif background */}
        <div aria-hidden style={{ position:"absolute", bottom:-60, right:-60, fontFamily:"'Cormorant Garamond',serif", fontSize:"28vw", fontWeight:700, color:"rgba(255,255,255,0.25)", lineHeight:1, userSelect:"none", pointerEvents:"none", letterSpacing:"-0.04em" }}>
          rdv
        </div>

        {/* Contenu hero */}
        <div style={{ position:"relative", zIndex:2, maxWidth:760, width:"100%", padding:"0 24px", textAlign:"center" }}>

          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.6)", backdropFilter:"blur(8px)", border:"1px solid rgba(200,160,96,0.35)", borderRadius:24, padding:"6px 16px", fontSize:12, fontWeight:600, color:"#8a6a3a", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:28 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#c9a060", display:"inline-block" }} />
            Artisans locaux du bien-être
          </div>

          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(44px,6.5vw,76px)", fontWeight:500, lineHeight:1.08, margin:"0 0 20px", color:"#1a1614", letterSpacing:"-0.01em" }}>
            Le bien-être<br />
            <span style={{ color:"#8a6a3a", fontStyle:"italic" }}>près de chez vous.</span>
          </h1>

          <p style={{ fontSize:17, color:"#6a5a4a", lineHeight:1.7, maxWidth:520, margin:"0 auto 44px" }}>
            Découvrez et réservez les meilleurs professionnels locaux de la beauté, du soin et du bien-être.
          </p>

          {/* Barre de recherche glassmorphism */}
          <div ref={searchRef} style={{ position:"relative" }}>
            <div className="rdv-search-bar" style={{ display:"flex", gap:0, background:"rgba(255,255,255,0.75)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.9)", borderRadius:18, padding:8, boxShadow:"0 20px 60px rgba(100,80,60,0.15), 0 2px 8px rgba(100,80,60,0.08)", overflow:"hidden" }}>
              <div className="rdv-search-nom" style={{ flex:2, display:"flex", alignItems:"center", gap:10, padding:"8px 16px", borderRight:"1px solid rgba(200,180,160,0.3)" }}>
                <span style={{ fontSize:16, opacity:0.5 }}>🔍</span>
                <input
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  onFocus={() => { if(resultats.length > 0) setShowResults(true); }}
                  placeholder="Institut, salon, spa…"
                  style={{ flex:1, border:"none", background:"transparent", fontSize:15, color:"#1a1614", outline:"none", fontFamily:"inherit" }}
                />
              </div>
              <div className="rdv-ville-row" style={{ flex:1, display:"flex", alignItems:"center", gap:10, padding:"8px 16px" }}>
                <span style={{ fontSize:16, opacity:0.5 }}>📍</span>
                <input
                  value={ville}
                  onChange={e => setVille(e.target.value)}
                  placeholder="Ville, quartier…"
                  style={{ flex:1, border:"none", background:"transparent", fontSize:15, color:"#1a1614", outline:"none", fontFamily:"inherit" }}
                />
                <button onClick={geolocate} disabled={geoLoading} title="Me géolocaliser" className="rdv-geo-btn"
                  style={{ padding:"8px 10px", background:"rgba(200,180,160,0.2)", border:"1px solid rgba(200,180,160,0.4)", borderRadius:10, cursor:"pointer", fontSize:15, color:"#6a5a4a", flexShrink:0 }}>
                  {geoLoading ? "…" : (
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="7" cy="7" r="5.5" stroke="#6a5a4a" strokeWidth="1.5"/>
                      <circle cx="7" cy="7" r="2" fill="#6a5a4a"/>
                      <line x1="7" y1="12.5" x2="7" y2="17" stroke="#6a5a4a" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
              <button className="rdv-search-btn" onClick={() => { if(nom||ville) rechercher(); setShowResults(true); }}
                style={{ padding:"0 28px", background:"#1a1614", color:"#fff", border:"none", borderRadius:"0 12px 12px 0", fontSize:14, fontWeight:600, cursor:"pointer", flexShrink:0, fontFamily:"inherit", alignSelf:"stretch", margin:"-8px -8px -8px 8px" }}>
                Rechercher
              </button>
            </div>

            {/* Dropdown résultats */}
            {showResults && (nom.length >= 2 || ville.length >= 2) && (
              <div style={{ position:"absolute", top:"calc(100% + 10px)", left:0, right:0, background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(100,80,60,0.18)", border:"1px solid rgba(200,180,160,0.25)", overflow:"hidden", zIndex:100 }}>
                {loading && <div style={{ padding:20, textAlign:"center", color:"#aaa", fontSize:13 }}>Recherche…</div>}
                {!loading && searched && resultats.length === 0 && (
                  <div style={{ padding:20, textAlign:"center", color:"#aaa", fontSize:13 }}>Aucun résultat trouvé.</div>
                )}
                {resultats.map(salon => {
                  const m = METIERS[salon.metier as keyof typeof METIERS];
                  return (
                    <Link key={salon.id} href={salon.slug ? `/${salon.slug}` : `/s/${salon.id}`} style={{ textDecoration:"none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderBottom:"1px solid #f5f0ea", cursor:"pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#faf8f5")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width:36, height:36, borderRadius:10, background: m ? `${m.couleur}20` : "#f5f0ea", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
                          {METIER_EMOJI[salon.metier] || "✨"}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:"#1a1614" }}>{salon.nom}</div>
                          <div style={{ fontSize:12, color:"#8a7a6a" }}>{m?.label}{salon.ville ? ` · ${salon.ville}` : ""}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop:20, fontSize:12, color:"rgba(100,80,60,0.5)", display:"flex", gap:20, justifyContent:"center" }}>
            <span>✓ Gratuit</span>
            <span>✓ Sans inscription</span>
            <span>✓ Artisans vérifiés</span>
          </div>
        </div>
      </section>

      {/* ── CATÉGORIES ── */}
      <section className="rdv-section" style={{ padding:"80px 40px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(30px,4vw,44px)", fontWeight:500, margin:"0 0 12px", color:"#1a1614" }}>
              Explorer par catégorie
            </h2>
            <p style={{ fontSize:15, color:"#8a7a6a", margin:0 }}>Des professionnels pour chaque besoin.</p>
          </div>
          <div className="rdv-cat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.label}
                style={{ background:cat.gradient, borderRadius:20, padding:"28px 20px 24px", cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s", overflow:"hidden", position:"relative" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(100,80,60,0.18)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform="none"; (e.currentTarget as HTMLDivElement).style.boxShadow="none"; }}>
                <div aria-hidden style={{ position:"absolute", bottom:-16, right:-10, fontSize:80, opacity:0.2, lineHeight:1 }}>{cat.emoji}</div>
                <div style={{ fontSize:28, marginBottom:14 }}>{cat.emoji}</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:4, textShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>{cat.label}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)" }}>Découvrir →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUTOUR DE VOUS ── */}
      <section className="rdv-section" style={{ padding:"0 40px 80px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:40 }}>
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,40px)", fontWeight:500, margin:"0 0 8px", color:"#1a1614" }}>
                Établissements populaires
              </h2>
              <p style={{ fontSize:15, color:"#8a7a6a", margin:0 }}>Les adresses qui font la différence.</p>
            </div>
            <Link href="#" style={{ fontSize:13, color:"#8a6a3a", fontWeight:600, textDecoration:"none" }}>Tout voir →</Link>
          </div>
          <div className="rdv-etab-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:20 }}>
            {MOCK_ETABLISSEMENTS.map(e => (
              <div key={e.nom} style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 12px rgba(100,80,60,0.08)", border:"1px solid rgba(200,180,160,0.2)", cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={el => { (el.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (el.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(100,80,60,0.15)"; }}
                onMouseLeave={el => { (el.currentTarget as HTMLDivElement).style.transform="none"; (el.currentTarget as HTMLDivElement).style.boxShadow="0 2px 12px rgba(100,80,60,0.08)"; }}>
                {/* Photo simulée */}
                <div style={{ height:160, background:e.gradient, position:"relative", display:"flex", alignItems:"flex-end", padding:12 }}>
                  <span style={{ background:"rgba(255,255,255,0.9)", backdropFilter:"blur(6px)", borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:600, color:"#1a1614" }}>{e.ville}</span>
                </div>
                <div style={{ padding:"16px 16px 20px" }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#1a1614", marginBottom:4 }}>{e.nom}</div>
                  <div style={{ fontSize:12, color:"#8a7a6a", marginBottom:10 }}>{e.metier}</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"#8a6a3a", fontWeight:600 }}>
                      ★ {e.note} <span style={{ color:"#b8a898", fontWeight:400 }}>({e.avis})</span>
                    </div>
                    <button style={{ fontSize:11, fontWeight:600, color:"#fff", background:"#1a1614", border:"none", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                      Réserver
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POURQUOI RDVOUS ── */}
      <section className="rdv-section" style={{ background:"#f0ece5", padding:"80px 40px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:500, textAlign:"center", margin:"0 0 56px", color:"#1a1614" }}>
            Pourquoi RDVOUS ?
          </h2>
          <div className="rdv-why-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:32 }}>
            {WHY.map(w => (
              <div key={w.titre} style={{ textAlign:"center" }}>
                <div style={{ width:64, height:64, borderRadius:20, background:"#fff", boxShadow:"0 4px 20px rgba(100,80,60,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 20px" }}>
                  {w.icon}
                </div>
                <div style={{ fontSize:17, fontWeight:700, color:"#1a1614", marginBottom:10 }}>{w.titre}</div>
                <div style={{ fontSize:14, color:"#8a7a6a", lineHeight:1.7 }}>{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION ÉMOTIONNELLE ── */}
      <section className="rdv-section" style={{ position:"relative", overflow:"hidden", padding:"100px 40px", background:"linear-gradient(135deg,#2d1f1a 0%,#3d2a20 40%,#2a2030 100%)" }}>
        <div aria-hidden style={{ position:"absolute", top:-80, left:-80, width:400, height:400, borderRadius:"50%", background:"rgba(201,160,96,0.08)" }} />
        <div aria-hidden style={{ position:"absolute", bottom:-60, right:-40, width:320, height:320, borderRadius:"50%", background:"rgba(168,200,160,0.06)" }} />
        <div style={{ maxWidth:680, margin:"0 auto", textAlign:"center", position:"relative", zIndex:2 }}>
          <div style={{ fontSize:36, marginBottom:24 }}>🌿</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(32px,5vw,56px)", fontWeight:400, color:"#fff", margin:"0 0 20px", lineHeight:1.15 }}>
            Prenez du temps<br />
            <span style={{ color:"#c9a060", fontStyle:"italic" }}>pour vous.</span>
          </h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.5)", lineHeight:1.8, marginBottom:40, maxWidth:500, margin:"0 auto 40px" }}>
            Le meilleur du bien-être local réuni au même endroit. Des artisans passionnés, une expérience soignée.
          </p>
          <button onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}
            style={{ padding:"14px 36px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.25)", backdropFilter:"blur(8px)", color:"#fff", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Trouver mon artisan
          </button>
        </div>
      </section>

      {/* ── CTA PRO ── */}
      <section className="rdv-section" style={{ padding:"72px 40px" }}>
        <div className="rdv-cta-pro-inner" style={{ maxWidth:800, margin:"0 auto", background:"#faf0e6", border:"1px solid rgba(200,160,96,0.3)", borderRadius:24, padding:"48px 56px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:32, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#c9a060", marginBottom:12 }}>Pour les professionnels</div>
            <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:500, color:"#1a1614", margin:"0 0 10px" }}>
              Rejoignez RDVOUS
            </h3>
            <p style={{ fontSize:14, color:"#8a7a6a", margin:0, lineHeight:1.6, maxWidth:380 }}>
              Agenda, emails automatiques, fidélité clients — tout ce dont vous avez besoin pour gérer et développer votre activité.
            </p>
          </div>
          <Link href="/pro" style={{ flexShrink:0, padding:"14px 32px", background:"#1a1614", color:"#fff", borderRadius:12, fontSize:14, fontWeight:600, textDecoration:"none" }}>
            Inscrire mon entreprise →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="rdv-footer" style={{ borderTop:"1px solid rgba(200,180,160,0.3)", padding:"32px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:"#1a1614" }}>rdvous</span>
        <div style={{ display:"flex", gap:24 }}>
          <Link href="/pro" style={{ fontSize:13, color:"#8a7a6a", textDecoration:"none" }}>Espace pro</Link>
          <Link href="/mon-compte" style={{ fontSize:13, color:"#8a7a6a", textDecoration:"none" }}>Mon compte</Link>
          <Link href="/mentions-legales" style={{ fontSize:13, color:"#8a7a6a", textDecoration:"none" }}>Mentions légales</Link>
        </div>
        <span style={{ fontSize:12, color:"#b8a898" }}>© 2026 rdvous</span>
      </footer>

    </div>
  );
}

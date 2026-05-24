"use client";
import { useState } from "react";
import Link from "next/link";

/* ── palette ── */
const C = {
  cream:  "#faf8f5",
  warm:   "#f0ece5",
  border: "#e2d8ce",
  text:   "#1a1614",
  muted:  "#6a5a4a",
  light:  "#a89880",
  gold:   "#c9a060",
  sage:   "#7a9e8a",
  dark:   "#1a1614",
};

/* ── data ── */
const PAIN_POINTS = [
  { icon: "📅", pb: "Un agenda surchargé",       sol: "Planning clair, réservations automatisées, zéro double-booking." },
  { icon: "💸", pb: "Des outils trop chers",      sol: "19€/mois. Pas de commission. Pas de frais cachés." },
  { icon: "🔕", pb: "Les annulations de dernière minute", sol: "Rappels SMS & email automatiques pour réduire les no-shows." },
  { icon: "🌐", pb: "Invisible en ligne",          sol: "Un profil local référencé, visible dès votre inscription." },
  { icon: "🗂️", pb: "Des fiches clients éparpillées", sol: "Tout centralisé : historique, notes, cagnotte, mesures." },
  { icon: "⏰", pb: "Des heures perdues en gestion", sol: "Automatisations intelligentes pour vous libérer du temps." },
];

const METIERS_LIST = [
  { emoji: "💅", label: "Onglerie",    couleur: "#6b2d42", fields: ["Mesures capsules", "Type de pose", "Couleur habituelle"] },
  { emoji: "✂️", label: "Coiffure",    couleur: "#1A3A8B", fields: ["Type de cheveux", "Couleur actuelle", "Fréquence"] },
  { emoji: "🧖", label: "Institut",    couleur: "#7a9e8a", fields: ["Type de peau", "Allergies", "Soins habituels"] },
  { emoji: "🪒", label: "Barber",      couleur: "#4a3a2a", fields: ["Style de coupe", "Longueur habituelle", "Produits"] },
  { emoji: "🛁", label: "Spa",         couleur: "#9a7a5a", fields: ["Préférences massage", "Pression souhaitée", "Aromathérapie"] },
  { emoji: "🙌", label: "Massage",     couleur: "#5a7a6a", fields: ["Tensions ciblées", "Technique préférée", "Fréquence"] },
];

const FEATURES = [
  { icon: "📆", titre: "Agenda intelligent",         desc: "Vue semaine et mois. Créez un RDV en 10 secondes." },
  { icon: "🔗", titre: "Réservation en ligne",        desc: "Vos clients réservent directement depuis votre profil RDVOUS." },
  { icon: "✉️", titre: "Emails & rappels auto",       desc: "Confirmation, rappel 24h avant, relance client automatiques." },
  { icon: "👥", titre: "Fiches clients",               desc: "Historique complet, notes, mesures, cagnotte par client." },
  { icon: "⭐", titre: "Programme fidélité",           desc: "Récompensez vos fidèles automatiquement selon vos règles." },
  { icon: "🤝", titre: "Parrainage intégré",           desc: "Vos clients vous recommandent, les deux sont récompensés." },
  { icon: "📍", titre: "Visibilité locale",             desc: "Profil public référencé sur rdvous.fr, visible par vos clients." },
  { icon: "🎨", titre: "Adapté à votre métier",        desc: "Champs, outils et logique spécifiques à votre activité." },
  { icon: "📊", titre: "Statistiques",                  desc: "CA, fréquentation, fidélité — suivez votre activité en un coup d'œil." },
  { icon: "💬", titre: "Notes de rendez-vous",          desc: "Consignez les observations à chaque passage client." },
  { icon: "💰", titre: "Gestion cagnotte",              desc: "Les clients déduisent leur cagnotte directement au rendez-vous." },
  { icon: "🔒", titre: "Données sécurisées",            desc: "Hébergées en Europe, isolées par salon, jamais revendues." },
];

const PLANS = [
  {
    nom: "Gratuit", prix: "0€", duree: "/mois", badge: "Pour démarrer",
    badgeColor: C.sage, highlight: false,
    desc: "Lancez-vous sans engagement. Aucune carte requise.",
    items: ["Jusqu'à 30 rendez-vous/mois", "Profil public sur rdvous.fr", "Fiches clients", "Emails de confirmation & rappels", "Agenda simple"],
    cta: "Commencer gratuitement", ctaBg: "#fff", ctaColor: C.dark, ctaBorder: C.border,
  },
  {
    nom: "Indépendant", prix: "19€", duree: "/mois", badge: "Prix de lancement",
    badgeColor: C.gold, highlight: true,
    desc: "Offre de lancement — profitez-en avant que le prix augmente.",
    items: ["Agenda intelligent & illimité", "Prise de RDV en ligne", "Emails & rappels automatiques", "Fiches clients personnalisées", "Fidélité & parrainage", "Visibilité locale", "Adapté à votre métier", "Support inclus"],
    cta: "Commencer", ctaBg: C.dark, ctaColor: "#fff", ctaBorder: "transparent",
  },
  {
    nom: "Équipe", prix: "Bientôt", duree: "", badge: "Offre à venir",
    badgeColor: C.light, highlight: false, comingSoon: true,
    desc: "Pour les instituts avec plusieurs collaborateurs. Agendas individuels, gestion d'équipe, réservations multi-agendas.",
    items: ["Tout l'offre Indépendant", "Plusieurs collaborateurs", "Agenda individuel par collaborateur", "Réservations multi-agendas", "Gestion d'équipe"],
    cta: "Être notifié en priorité", ctaBg: "#fff", ctaColor: C.muted, ctaBorder: C.border,
  },
];

const TEMOIGNAGES = [
  { prenom: "Marie-Sophie", metier: "Onglérie, Lyon", note: 5, texte: "J'ai arrêté de perdre du temps avec mon carnet papier. Les rappels automatiques ont divisé mes annulations par trois. Je ne reviendrai pas en arrière." },
  { prenom: "Karim", metier: "Barber, Paris 10e", note: 5, texte: "19€ par mois et j'ai l'impression d'avoir une assistante. Le système de fidélité a vraiment fidélisé mes clients réguliers." },
  { prenom: "Élise", metier: "Institut de beauté, Bordeaux", note: 5, texte: "Ce qui m'a convaincu c'est que l'outil comprend mon métier. Les fiches capsules pour mes clientes gel, ça change tout." },
];

const FAQ_ITEMS = [
  { q: "Puis-je arrêter quand je veux ?", r: "Oui, sans engagement. Vous résiliez en un clic depuis votre espace, sans frais ni pénalité." },
  { q: "Est-ce compliqué à mettre en place ?", r: "Non. L'inscription prend moins de 5 minutes. Vos prestations, votre profil et votre agenda sont configurables immédiatement, sans formation." },
  { q: "Puis-je gérer plusieurs collaborateurs ?", r: "Oui, avec l'offre Équipe. Chaque collaborateur a son propre agenda, visible et gérable depuis le même espace." },
  { q: "Y a-t-il une commission sur les réservations ?", r: "Aucune commission. Vous payez uniquement l'abonnement mensuel. Chaque euro encaissé est à vous." },
  { q: "Mes clients peuvent-ils réserver seuls ?", r: "Oui. Votre profil public est accessible via rdvous.fr. Vos clients peuvent vous trouver, voir vos prestations et vous contacter directement." },
  { q: "Puis-je personnaliser mon profil selon mon métier ?", r: "Oui. Selon votre activité (onglerie, coiffure, spa…), des champs et outils spécifiques sont activés automatiquement." },
];

/* ── Dashboard mockup ── */
function DashboardMockup() {
  const rdvs = [
    { heure: "09:00", prenom: "Sophie M.", duree: 2, color: "#6b2d42" },
    { heure: "11:00", prenom: "Anaïs R.",  duree: 1, color: "#7a9e8a" },
    { heure: "14:30", prenom: "Laura T.",  duree: 3, color: "#6b2d42" },
    { heure: "17:00", prenom: "Jade K.",   duree: 2, color: "#7a9e8a" },
  ];
  return (
    <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 24px 80px rgba(100,80,60,0.18)", border:"1px solid rgba(200,180,160,0.2)", width:340, flexShrink:0 }}>
      {/* Header mockup */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:12, color:C.light, fontWeight:500 }}>Mercredi 21 mai</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.text }}>Agenda du jour</div>
        </div>
        <div style={{ background:`${C.gold}20`, borderRadius:10, padding:"4px 10px", fontSize:11, fontWeight:700, color:C.gold }}>4 RDVs</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
        {[["Cette semaine","12 RDVs"],["Clients actifs","38"],["CA estimé","486 €"]].map(([label, val]) => (
          <div key={label} style={{ background:C.warm, borderRadius:10, padding:"8px 10px" }}>
            <div style={{ fontSize:10, color:C.light, marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {rdvs.map(r => (
          <div key={r.heure} style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:10, color:C.light, width:36, flexShrink:0, fontWeight:600 }}>{r.heure}</div>
            <div style={{ flex:1, background:`${r.color}12`, border:`1px solid ${r.color}30`, borderRadius:8, padding:"6px 10px", borderLeft:`3px solid ${r.color}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:r.color }}>{r.prenom}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Notification */}
      <div style={{ marginTop:14, background:`${C.sage}12`, border:`1px solid ${C.sage}30`, borderRadius:10, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14 }}>✅</span>
        <div style={{ fontSize:11, color:C.sage, fontWeight:600 }}>Rappel envoyé à Sophie M.</div>
      </div>
    </div>
  );
}

/* ── FAQ accordion ── */
function FAQItem({ q, r }: { q: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom:`1px solid ${C.border}`, padding:"0" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 0", background:"none", border:"none", cursor:"pointer", textAlign:"left", fontFamily:"inherit", gap:16 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.text }}>{q}</span>
        <span style={{ fontSize:18, color:C.light, flexShrink:0, transform:open?"rotate(45deg)":"none", transition:"transform 0.2s" }}>+</span>
      </button>
      {open && <div style={{ fontSize:14, color:C.muted, lineHeight:1.75, paddingBottom:20 }}>{r}</div>}
    </div>
  );
}

/* ── PAGE ── */
export default function ProPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ minHeight:"100vh", background:C.cream, fontFamily:"'Inter',system-ui,sans-serif", color:C.text, overflowX:"clip" }}>
      <style>{`
        .pro-hamburger { display: none; }
        @media (max-width: 640px) {
          .pro-nav { padding: 0 16px !important; }
          .pro-nav-links { display: none !important; }
          .pro-hamburger { display: block !important; }
          .pro-section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 60px !important; padding-bottom: 60px !important; }
          .pro-hero { padding: 48px 20px 60px !important; }
          .pro-hero-mockup { display: none !important; }
          .pro-hero-actions { flex-direction: column !important; }
          .pro-grid-3 { grid-template-columns: 1fr !important; }
          .pro-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .pro-grid-plans { grid-template-columns: 1fr !important; }
          .pro-grid-2 { grid-template-columns: 1fr !important; }
          .pro-cta-inner { padding: 40px 24px !important; }
          .pro-footer { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (min-width: 641px) and (max-width: 960px) {
          .pro-section { padding-left: 30px !important; padding-right: 30px !important; }
          .pro-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .pro-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .pro-grid-plans { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <div style={{ position:"sticky", top:0, zIndex:200 }}>
        <nav className="pro-nav" style={{ background:"rgba(250,248,245,0.93)", backdropFilter:"blur(16px)", borderBottom:`1px solid ${C.border}`, padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
          <Link href="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, color:C.text, textDecoration:"none", letterSpacing:"0.03em" }}>rdvous</Link>
          <div className="pro-nav-links" style={{ display:"flex", alignItems:"center", gap:24 }}>
            <a href="#tarifs" style={{ fontSize:13, color:C.muted, textDecoration:"none" }}>Tarifs</a>
            <Link href="/login" style={{ fontSize:13, color:C.muted, textDecoration:"none" }}>Connexion</Link>
            <Link href="/login" style={{ fontSize:13, fontWeight:700, color:"#fff", background:C.dark, padding:"9px 22px", borderRadius:10, textDecoration:"none" }}>
              Essayer gratuitement
            </Link>
          </div>
          <button className="pro-hamburger" onClick={() => setMenuOpen(o => !o)}
            style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text, padding:"4px 8px", lineHeight:1 }}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>
        {menuOpen && (
          <div style={{ background:"rgba(250,248,245,0.98)", backdropFilter:"blur(16px)", borderBottom:`1px solid ${C.border}`, padding:"4px 24px 12px", display:"flex", flexDirection:"column" }}>
            <a href="#tarifs" onClick={() => setMenuOpen(false)} style={{ padding:"14px 0", fontSize:15, color:C.muted, textDecoration:"none", borderBottom:`1px solid ${C.border}`, display:"block" }}>Tarifs</a>
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ padding:"14px 0", fontSize:15, color:C.muted, textDecoration:"none", borderBottom:`1px solid ${C.border}`, display:"block" }}>Connexion</Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ padding:"14px 0", fontSize:15, fontWeight:700, color:C.text, textDecoration:"none", display:"block" }}>Essayer gratuitement →</Link>
          </div>
        )}
      </div>

      {/* ── HERO ── */}
      <section className="pro-hero" style={{ padding:"80px 60px 100px", maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", gap:60, flexWrap:"wrap" }}>
        {/* Texte */}
        <div style={{ flex:"1 1 400px", minWidth:0 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:`${C.sage}18`, border:`1px solid ${C.sage}40`, borderRadius:24, padding:"6px 16px", fontSize:12, fontWeight:700, color:C.sage, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:28 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:C.sage, display:"inline-block" }} />
            Pensé pour les artisans du bien-être
          </div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(38px,5vw,60px)", fontWeight:500, lineHeight:1.1, margin:"0 0 22px", color:C.text }}>
            Développez votre activité.<br />
            <span style={{ color:C.gold, fontStyle:"italic" }}>Pas vos contraintes.</span>
          </h1>
          <p style={{ fontSize:17, color:C.muted, lineHeight:1.75, maxWidth:480, margin:"0 0 40px" }}>
            RDVOUS aide les professionnels indépendants à gérer leurs rendez-vous, fidéliser leurs clients et gagner en visibilité locale — sans commissions abusives ni frais cachés.
          </p>
          <div className="pro-hero-actions" style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <Link href="/login" style={{ padding:"14px 32px", background:C.dark, color:"#fff", borderRadius:12, fontSize:14, fontWeight:700, textDecoration:"none" }}>
              Essayer gratuitement
            </Link>
            <a href="#tarifs" style={{ padding:"14px 32px", background:"transparent", color:C.text, border:`1px solid ${C.border}`, borderRadius:12, fontSize:14, fontWeight:600, textDecoration:"none" }}>
              Voir les offres
            </a>
          </div>
          <div style={{ marginTop:28, display:"flex", gap:24, flexWrap:"wrap" }}>
            {["Sans engagement","Aucune commission","Mise en place en 5 min"].map(t => (
              <div key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.muted }}>
                <span style={{ color:C.sage, fontWeight:700 }}>✓</span> {t}
              </div>
            ))}
          </div>
        </div>
        {/* Dashboard mockup */}
        <div className="pro-hero-mockup" style={{ flex:"0 0 auto" }}>
          <DashboardMockup />
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="pro-section" style={{ background:C.warm, padding:"80px 60px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:500, margin:"0 0 14px", color:C.text }}>
              On connaît votre quotidien.
            </h2>
            <p style={{ fontSize:15, color:C.muted, maxWidth:520, margin:"0 auto" }}>
              RDVOUS a été conçu par des gens qui comprennent les contraintes réelles d'un indépendant du bien-être.
            </p>
          </div>
          <div className="pro-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:20 }}>
            {PAIN_POINTS.map(p => (
              <div key={p.pb} style={{ background:"#fff", borderRadius:18, padding:28, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:28, marginBottom:14 }}>{p.icon}</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#c06060", marginBottom:8, textDecoration:"line-through", textDecorationColor:"#e09090" }}>{p.pb}</div>
                <div style={{ fontSize:14, color:C.muted, lineHeight:1.65 }}>{p.sol}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADAPTÉ AU MÉTIER ── */}
      <section className="pro-section" style={{ padding:"80px 60px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:500, margin:"0 0 14px", color:C.text }}>
              Une plateforme qui s'adapte<br />à <span style={{ color:C.gold, fontStyle:"italic" }}>votre</span> métier.
            </h2>
            <p style={{ fontSize:15, color:C.muted, maxWidth:500, margin:"0 auto" }}>
              Ce n'est pas un logiciel générique. Chaque activité a ses outils, ses champs, sa logique propre.
            </p>
          </div>
          <div className="pro-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
            {METIERS_LIST.map(m => (
              <div key={m.label} style={{ background:"#fff", borderRadius:18, padding:24, border:`1px solid ${C.border}`, transition:"box-shadow 0.2s, transform 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow="0 12px 40px rgba(100,80,60,0.12)"; (e.currentTarget as HTMLDivElement).style.transform="translateY(-3px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow="none"; (e.currentTarget as HTMLDivElement).style.transform="none"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${m.couleur}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{m.emoji}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{m.label}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {m.fields.map(f => (
                    <div key={f} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.muted }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:m.couleur, flexShrink:0 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="pro-section" style={{ background:C.warm, padding:"80px 60px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:500, margin:"0 0 14px", color:C.text }}>
              Tout ce dont vous avez besoin.
            </h2>
          </div>
          <div className="pro-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
            {FEATURES.map(f => (
              <div key={f.titre} style={{ background:"#fff", borderRadius:16, padding:"22px 20px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:24, marginBottom:12 }}>{f.icon}</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>{f.titre}</div>
                <div style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TARIFS ── */}
      <section id="tarifs" className="pro-section" style={{ padding:"80px 60px" }}>
        <div style={{ maxWidth:960, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:500, margin:"0 0 14px", color:C.text }}>
              Simple, transparent, honnête.
            </h2>
            <p style={{ fontSize:15, color:C.muted }}>Sans commissions abusives. Sans frais cachés.</p>
          </div>
          <div className="pro-grid-plans" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:20 }}>
            {PLANS.map(p => (
              <div key={p.nom} style={{ background: p.highlight ? C.dark : "#fff", borderRadius:20, padding:"32px 28px", border: p.highlight ? "none" : `1px solid ${C.border}`, position:"relative", boxShadow: p.highlight ? "0 20px 60px rgba(26,22,20,0.25)" : "none", opacity: (p as any).comingSoon ? 0.85 : 1 }}>
                {p.badge && (
                  <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:p.badgeColor!, color: p.highlight ? C.dark : "#fff", padding:"4px 16px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                    {p.badge}
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color: p.highlight ? "rgba(255,255,255,0.5)" : C.light, marginBottom:12 }}>{p.nom}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:6 }}>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:44, fontWeight:600, color: p.highlight ? "#fff" : (p as any).comingSoon ? C.light : C.text, lineHeight:1 }}>{p.prix}</span>
                  {p.duree && <span style={{ fontSize:14, color: p.highlight ? "rgba(255,255,255,0.5)" : C.light }}>{p.duree}</span>}
                </div>
                {p.highlight && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${C.gold}22`, border:`1px solid ${C.gold}50`, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700, color:C.gold, marginBottom:12 }}>
                    ⚡ Prix de lancement
                  </div>
                )}
                <div style={{ fontSize:13, color: p.highlight ? "rgba(255,255,255,0.55)" : C.muted, marginBottom:28, lineHeight:1.5 }}>{p.desc}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
                  {p.items.map(item => (
                    <div key={item} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color: p.highlight ? "rgba(255,255,255,0.8)" : (p as any).comingSoon ? C.light : C.muted }}>
                      <span style={{ color: p.highlight ? C.gold : (p as any).comingSoon ? C.light : C.sage, fontWeight:700, flexShrink:0 }}>{(p as any).comingSoon ? "·" : "✓"}</span>
                      {item}
                    </div>
                  ))}
                </div>
                {(p as any).comingSoon
                  ? <div style={{ display:"block", textAlign:"center", padding:"13px", background:C.warm, color:C.light, border:`1px solid ${C.border}`, borderRadius:12, fontSize:14, fontWeight:600 }}>Bientôt disponible</div>
                  : <Link href={p.nom === "Indépendant" ? "/signup?plan=solo" : "/signup"} style={{ display:"block", textAlign:"center", padding:"13px", background:p.ctaBg, color:p.ctaColor, border:`1px solid ${p.ctaBorder}`, borderRadius:12, fontSize:14, fontWeight:700, textDecoration:"none" }}>{p.cta}</Link>
                }
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POURQUOI DIFFÉRENT ── */}
      <section className="pro-section" style={{ background:C.warm, padding:"80px 60px" }}>
        <div className="pro-grid-2" style={{ maxWidth:900, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"center" }}>
          <div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(26px,3.5vw,38px)", fontWeight:500, margin:"0 0 24px", color:C.text }}>
              Pourquoi RDVOUS<br />est <span style={{ color:C.gold, fontStyle:"italic" }}>différent</span> ?
            </h2>
            <p style={{ fontSize:15, color:C.muted, lineHeight:1.75, margin:"0 0 28px" }}>
              La plupart des plateformes vous prennent une commission sur chaque réservation. Elles vous imposent leurs tarifs, leur interface, leur logique. Vous devenez un prestataire parmi d'autres.
            </p>
            <p style={{ fontSize:15, color:C.muted, lineHeight:1.75 }}>
              RDVOUS fonctionne différemment. Vous payez un abonnement fixe. Chaque euro encaissé est à vous. Votre activité reste la vôtre.
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[
              ["🚫 Ailleurs", "Commission sur chaque RDV", "#fee2e2", "#e74c3c"],
              ["✅ RDVOUS",   "Abonnement fixe, 0% commission", "#f0fdf4", C.sage],
              ["🚫 Ailleurs", "Interface générique, peu adaptée", "#fee2e2", "#e74c3c"],
              ["✅ RDVOUS",   "Outils spécifiques à votre métier", "#f0fdf4", C.sage],
              ["🚫 Ailleurs", "Support impersonnel et lent", "#fee2e2", "#e74c3c"],
              ["✅ RDVOUS",   "Accompagnement humain et proche", "#f0fdf4", C.sage],
            ].map(([label, text, bg, color], i) => (
              <div key={i} style={{ background:bg, borderRadius:12, padding:"12px 16px", display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, color, flexShrink:0, minWidth:80 }}>{label}</span>
                <span style={{ fontSize:13, color:C.text }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section className="pro-section" style={{ padding:"80px 60px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,40px)", fontWeight:500, textAlign:"center", margin:"0 0 52px", color:C.text }}>
            Ils font confiance à RDVOUS.
          </h2>
          <div className="pro-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
            {TEMOIGNAGES.map(t => (
              <div key={t.prenom} style={{ background:"#fff", borderRadius:20, padding:28, border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", gap:2, marginBottom:16 }}>
                  {Array(t.note).fill(0).map((_, i) => <span key={i} style={{ color:C.gold, fontSize:14 }}>★</span>)}
                </div>
                <p style={{ fontSize:14, color:C.muted, lineHeight:1.75, margin:"0 0 20px", fontStyle:"italic" }}>"{t.texte}"</p>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{t.prenom}</div>
                  <div style={{ fontSize:12, color:C.light }}>{t.metier}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pro-section" style={{ background:C.warm, padding:"80px 60px" }}>
        <div style={{ maxWidth:720, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(28px,4vw,40px)", fontWeight:500, textAlign:"center", margin:"0 0 48px", color:C.text }}>
            Questions fréquentes.
          </h2>
          {FAQ_ITEMS.map(item => <FAQItem key={item.q} q={item.q} r={item.r} />)}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="pro-section" style={{ padding:"80px 60px" }}>
        <div className="pro-cta-inner" style={{ maxWidth:760, margin:"0 auto", background:C.dark, borderRadius:24, padding:"60px 56px", textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div aria-hidden style={{ position:"absolute", top:-60, right:-60, width:280, height:280, borderRadius:"50%", background:`${C.gold}10` }} />
          <div aria-hidden style={{ position:"absolute", bottom:-40, left:-40, width:200, height:200, borderRadius:"50%", background:`${C.sage}08` }} />
          <div style={{ position:"relative", zIndex:2 }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(30px,4vw,46px)", fontWeight:400, color:"#fff", margin:"0 0 16px" }}>
              Prêt à simplifier<br />votre quotidien ?
            </h2>
            <p style={{ fontSize:15, color:"rgba(255,255,255,0.5)", margin:"0 0 36px" }}>
              Démarrez gratuitement. Passez en illimité à 19€/mois — prix de lancement.
            </p>
            <Link href="/login" style={{ display:"inline-block", padding:"15px 40px", background:"#fff", color:C.dark, borderRadius:12, fontSize:15, fontWeight:700, textDecoration:"none" }}>
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="pro-footer" style={{ borderTop:`1px solid ${C.border}`, padding:"32px 60px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <Link href="/" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:C.text, textDecoration:"none" }}>rdvous</Link>
        <div style={{ display:"flex", gap:24 }}>
          <Link href="/"      style={{ fontSize:13, color:C.light, textDecoration:"none" }}>Trouver un salon</Link>
          <Link href="/login" style={{ fontSize:13, color:C.light, textDecoration:"none" }}>Connexion</Link>
        </div>
        <span style={{ fontSize:12, color:C.light }}>© 2025 rdvous</span>
      </footer>
    </div>
  );
}

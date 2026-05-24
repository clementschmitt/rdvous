"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";

const NAV_ICONS: Record<string, string> = {
  "/dashboard": "🏠",
  "/dashboard/agenda": "📅",
  "/dashboard/clients": "👥",
  "/dashboard/parametres": "⚙️",
};

export default function Header() {
  const salon = useSalon();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!salon) return <div style={{ height: 60, background: T.white, borderBottom: `1px solid ${T.border}` }} />;

  const m = METIERS[salon.metier];

  const links = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/dashboard/agenda", label: "Agenda" },
    { href: "/dashboard/clients", label: m.labelClients },
    { href: "/dashboard/parametres", label: "Params" },
  ];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .hdr-bar { padding: 0 16px !important; }
          .hdr-nav { display: none !important; }
          .hdr-salon-sep { display: none !important; }
          .hdr-salon-name { display: none !important; }
          .hdr-bottom-nav { display: flex !important; }
          body { padding-bottom: 64px; }
        }
      `}</style>

      {/* Barre du haut */}
      <div className="hdr-bar" style={{ background: T.white, borderBottom: `1px solid ${m.couleurClaire}`, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/dashboard" style={{ fontFamily: T.heading, fontWeight: 600, fontSize: 22, color: m.couleur, letterSpacing: "-0.2px" }}>
            rdvous
          </Link>
          <div className="hdr-salon-sep" style={{ width: 1, height: 16, background: m.couleurClaire }} />
          <span className="hdr-salon-name" style={{ ...T.ls, fontSize: "10px", color: m.couleurMuted }}>{salon.nom}</span>
          <nav className="hdr-nav" style={{ display: "flex", gap: 0 }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{ padding: "5px 14px", borderRadius: T.radiusSm, ...T.ls, fontSize: "10px", color: isActive(l.href) ? m.couleur : T.muted, background: isActive(l.href) ? `${m.couleur}12` : "transparent", fontWeight: isActive(l.href) ? 600 : 400 }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <button onClick={handleLogout} style={{ ...T.ls, fontSize: "9px", background: "none", border: `1px solid ${m.couleurClaire}`, borderRadius: T.radiusSm, padding: "5px 14px", cursor: "pointer", color: T.muted }}>
          Déconnexion
        </button>
      </div>

      {/* Navigation bas — mobile uniquement */}
      <nav className="hdr-bottom-nav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: T.white, borderTop: `2px solid ${m.couleurClaire}` }}>
        {links.map(l => {
          const active = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none", padding: "8px 0 10px", color: active ? m.couleur : T.muted }}>
              <span style={{ fontSize: 20 }}>{NAV_ICONS[l.href] || "•"}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

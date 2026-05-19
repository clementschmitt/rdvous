"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";

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
    ...(salon.metier === "manucure" ? [{ href: "/dashboard/vernis", label: "Vernis" }] : []),
    { href: "/dashboard/parametres", label: "Paramètres" },
  ];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div style={{ background: T.white, borderBottom: `1px solid ${m.couleurClaire}`, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Link href="/dashboard" style={{ fontFamily: T.heading, fontWeight: 600, fontSize: 22, color: m.couleur, letterSpacing: "-0.2px" }}>
          rdvous
        </Link>
        <div style={{ width: 1, height: 16, background: m.couleurClaire }} />
        <span style={{ ...T.ls, fontSize: "10px", color: m.couleurMuted }}>{salon.nom}</span>
        <nav style={{ display: "flex", gap: 0 }}>
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "5px 14px",
                borderRadius: T.radiusSm,
                ...T.ls,
                fontSize: "10px",
                color: isActive(l.href) ? m.couleur : T.muted,
                background: isActive(l.href) ? `${m.couleur}12` : "transparent",
                fontWeight: isActive(l.href) ? 600 : 400,
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        style={{ ...T.ls, fontSize: "9px", background: "none", border: `1px solid ${m.couleurClaire}`, borderRadius: T.radiusSm, padding: "5px 14px", cursor: "pointer", color: T.muted }}
      >
        Déconnexion
      </button>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabase } from "@/lib/supabase";

type NavItem = { label: string; href: string };

export default function SiteHeader({ links = [], cta, account = true, context = "public" }: { links?: NavItem[]; cta?: NavItem; account?: boolean; context?: "public" | "pro" }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAppMode, setIsAppMode] = useState(false);

  useEffect(() => {
    setIsAppMode(localStorage.getItem("rdvous_app") === "1");
    createSupabase().auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setLoggedIn(!!user);
      setIsPro(!!user && user.user_metadata?.user_type !== "client");
    });
  }, []);

  if (isAppMode) return null;

  const accountHref = context === "pro"
    ? (loggedIn ? (isPro ? "/dashboard" : "/onboarding") : "/login?next=/dashboard")
    : (loggedIn ? "/mon-compte" : "/login?next=/mon-compte");

  const accountLabel = context === "pro"
    ? (loggedIn ? (isPro ? "Mon espace pro" : "Créer mon espace pro") : "Connexion")
    : (loggedIn ? "Mon compte" : "Connexion");

  const allLinks: NavItem[] = [...links, ...(account ? [{ label: accountLabel, href: accountHref }] : [])];

  return (
    <>
      <div style={{ height: 56, position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#fff", boxShadow: "0 1px 0 #ebebeb" }}>
        <style>{`@media (max-width: 640px) { .sh-link { display: none !important; } .sh-burger { display: flex !important; } } @media (min-width: 641px) { .sh-burger { display: none !important; } }`}</style>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: "100%", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} className="sh-link" style={{ fontSize: 13, fontWeight: 500, color: "#555", textDecoration: "none" }}>{l.label}</Link>
            ))}
            {cta && (
              <Link href={cta.href} className="sh-link" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#1a1614", padding: "8px 16px", borderRadius: 9, textDecoration: "none" }}>{cta.label}</Link>
            )}
            {account && (
              <Link href={accountHref} className="sh-link" style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", padding: "6px 15px", borderRadius: 8, border: "1px solid #e2e2e2", textDecoration: "none", background: "#fff" }}>
                {accountLabel}
              </Link>
            )}

            {/* Hamburger mobile */}
            <button className="sh-burger" onClick={() => setMenuOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5, alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "block", width: 22, height: 2, background: "#1a1a1a", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#1a1a1a", borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: "all 0.2s" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#1a1a1a", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div style={{ position: "fixed", top: 56, left: 0, right: 0, zIndex: 49, background: "#fff", borderBottom: "1px solid #ebebeb", padding: "8px 0" }}>
          {allLinks.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              style={{ display: "block", padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#1a1a1a", textDecoration: "none", borderBottom: "1px solid #f5f5f5" }}>
              {l.label}
            </Link>
          ))}
          {cta && (
            <Link href={cta.href} onClick={() => setMenuOpen(false)}
              style={{ display: "block", margin: "12px 16px 8px", padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1a1614", borderRadius: 9, textDecoration: "none", textAlign: "center" }}>
              {cta.label}
            </Link>
          )}
        </div>
      )}
    </>
  );
}

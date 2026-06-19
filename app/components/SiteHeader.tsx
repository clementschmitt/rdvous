"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabase } from "@/lib/supabase";

type NavItem = { label: string; href: string };

export default function SiteHeader({ links = [], cta, account = true, context = "public" }: { links?: NavItem[]; cta?: NavItem; account?: boolean; context?: "public" | "pro" }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    createSupabase().auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setLoggedIn(!!user);
      setIsPro(!!user && user.user_metadata?.user_type !== "client");
    });
  }, []);

  const accountHref = context === "pro"
    ? (loggedIn ? (isPro ? "/dashboard" : "/onboarding") : "/login?next=/dashboard")
    : (loggedIn ? "/mon-compte" : "/login?next=/mon-compte");

  const accountLabel = context === "pro"
    ? (loggedIn ? (isPro ? "Mon espace pro" : "Créer mon espace pro") : "Connexion")
    : (loggedIn ? "Mon compte" : "Connexion");

  return (
    <div style={{ height: 56, position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#fff", boxShadow: "0 1px 0 #ebebeb" }}>
      <style>{`@media (max-width: 640px) { .sh-link { display: none !important; } }`}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", height: "100%", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} className="sh-link" style={{ fontSize: 13, fontWeight: 500, color: "#555", textDecoration: "none" }}>{l.label}</Link>
          ))}
          {cta && (
            <Link href={cta.href} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#1a1614", padding: "8px 16px", borderRadius: 9, textDecoration: "none" }}>{cta.label}</Link>
          )}
          {account && (
            <Link href={accountHref} style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", padding: "6px 15px", borderRadius: 8, border: "1px solid #e2e2e2", textDecoration: "none", background: "#fff" }}>
              {accountLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

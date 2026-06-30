"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccentColor } from "@/lib/accent-color";

export default function AppBottomNav() {
  const pathname = usePathname();
  const { color } = useAccentColor();

  const isHome = pathname === "/app";
  const isRdv = pathname.startsWith("/mon-compte") && !pathname.startsWith("/mon-compte/parametres");
  const isProfil = pathname.startsWith("/mon-compte/parametres");

  const active = (on: boolean) => ({ stroke: on ? color : "#aaa", color: on ? color : "#aaa", fontWeight: on ? 600 : 400 });

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "#fff", borderTop: "1px solid #f0f0f0",
      display: "flex", justifyContent: "space-around",
      padding: "10px 0 24px", zIndex: 200,
    }}>
      <Link href="/app" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill={isHome ? color : "none"} stroke={active(isHome).stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"/>
        </svg>
        <span style={{ fontSize: 11, color: active(isHome).color, fontWeight: active(isHome).fontWeight }}>Accueil</span>
      </Link>

      <Link href="/mon-compte" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active(isRdv).stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize: 11, color: active(isRdv).color, fontWeight: active(isRdv).fontWeight }}>Mes RDV</span>
      </Link>

      <Link href="/mon-compte/parametres" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active(isProfil).stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <span style={{ fontSize: 11, color: active(isProfil).color, fontWeight: active(isProfil).fontWeight }}>Profil</span>
      </Link>
    </div>
  );
}

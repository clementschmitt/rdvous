"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppBottomNav from "./AppBottomNav";
import { useAccentColor } from "@/lib/accent-color";

function AppTopBar() {
  const router = useRouter();
  const { color } = useAccentColor();
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: color, height: 56,
      display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
    }}>
      <button onClick={() => router.back()}
        style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 500 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Retour
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 40, height: 1.5, background: "rgba(255,255,255,0.5)", marginBottom: 4 }} />
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>rdvous</div>
      </div>
      <div style={{ width: 70 }} />
    </div>
  );
}

export default function AppNavConditional() {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => {
    setIsApp(localStorage.getItem("rdvous_app") === "1");
  }, []);
  if (!isApp) return null;
  return (
    <>
      <AppTopBar />
      <AppBottomNav />
    </>
  );
}

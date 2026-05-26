"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function VitrineHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{
      padding: "0 24px",
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      transition: "background 0.25s, box-shadow 0.25s",
      background: scrolled ? "#fff" : "transparent",
      boxShadow: scrolled ? "0 1px 0 #ebebeb" : "none",
    }}>
      <Link href="/recherche" style={{
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
        color: scrolled ? "#555" : "rgba(255,255,255,0.88)",
        textShadow: scrolled ? "none" : "0 1px 3px rgba(0,0,0,0.4)",
        transition: "color 0.25s",
      }}>← Recherche</Link>
      <Link href="/" style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 20,
        fontWeight: 600,
        textDecoration: "none",
        color: scrolled ? "#1a1a1a" : "#fff",
        textShadow: scrolled ? "none" : "0 1px 3px rgba(0,0,0,0.4)",
        transition: "color 0.25s",
      }}>rdvous</Link>
    </div>
  );
}

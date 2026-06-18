"use client";
import { useEffect, useRef, useState } from "react";

export default function PrestationDescription({ text, couleur }: { text: string; couleur: string }) {
  const [open, setOpen] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [measured, setMeasured] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const COLLAPSED = 34; // ~2 lignes

  // On mesure la hauteur réelle du texte (selon la largeur de l'écran) pour
  // savoir s'il déborde vraiment des 2 lignes. Re-mesuré au redimensionnement.
  useEffect(() => {
    const check = () => {
      const el = innerRef.current;
      if (!el) return;
      setNeedsToggle(el.scrollHeight > COLLAPSED + 4);
      setMeasured(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  // Avant mesure : clampé (évite un flash). Après : plein si court, repliable si long.
  const maxHeight = !measured
    ? COLLAPSED
    : !needsToggle
      ? undefined
      : open
        ? (innerRef.current?.scrollHeight ?? 600)
        : COLLAPSED;

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ maxHeight, overflow: "hidden", transition: "max-height 0.35s ease" }}>
        <div ref={innerRef} style={{ fontSize: 12, color: "#999", lineHeight: 1.4 }}>
          {text}
        </div>
      </div>
      {needsToggle && (
        <button onClick={() => setOpen(o => !o)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 11, color: "#aaa", fontWeight: 500, cursor: "pointer" }}>
          {open ? "Moins de détails" : "Plus de détails"}
          <span style={{ fontSize: 8, lineHeight: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}>▼</span>
        </button>
      )}
    </div>
  );
}

"use client";
import { useRef, useState } from "react";

export default function PrestationDescription({ text, couleur }: { text: string; couleur: string }) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const long = text.length > 90;
  const COLLAPSED = 34; // ~2 lignes

  // Hauteur animée : repliée = 2 lignes, dépliée = hauteur réelle du texte
  const maxHeight = !long ? undefined : open ? (innerRef.current?.scrollHeight ?? 600) : COLLAPSED;

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ maxHeight, overflow: "hidden", transition: "max-height 0.35s ease" }}>
        <div ref={innerRef} style={{ fontSize: 12, color: "#999", lineHeight: 1.4 }}>
          {text}
        </div>
      </div>
      {long && (
        <button onClick={() => setOpen(o => !o)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 11, color: "#aaa", fontWeight: 500, cursor: "pointer" }}>
          {open ? "Moins de détails" : "Plus de détails"}
          <span style={{ fontSize: 8, lineHeight: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}>▼</span>
        </button>
      )}
    </div>
  );
}

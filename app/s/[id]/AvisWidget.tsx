"use client";
import { useState } from "react";

type Avis = { note: number; commentaire: string | null; created_at: string };

export default function AvisWidget({ avis, avisMoyenne }: { avis: Avis[]; avisMoyenne: number }) {
  const [ouvert, setOuvert] = useState(false);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const avecCommentaire = avis.filter(a => a.commentaire);
  const current = avecCommentaire[index];
  const total = avecCommentaire.length;

  function navigate(next: number) {
    setVisible(false);
    setTimeout(() => {
      setIndex(next);
      setVisible(true);
    }, 350);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", overflow: "hidden" }}>
      <button
        onClick={() => { setOuvert(o => !o); setIndex(0); setVisible(true); }}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}
      >
        <div style={{ background: "#1a1a1a", borderRadius: 8, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{avisMoyenne.toFixed(1).replace(".", ",")}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 2, marginBottom: 3 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ fontSize: 15, color: i <= Math.round(avisMoyenne) ? "#f5a623" : "#e0e0e0" }}>★</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#aaa" }}>{avis.length} avis clients rdvous</div>
        </div>
        <span style={{ fontSize: 11, color: "#ccc", display: "inline-block", transition: "transform 0.4s ease", transform: ouvert ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>

      <div style={{
        maxHeight: ouvert && total > 0 ? "300px" : "0px",
        opacity: ouvert && total > 0 ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.9s ease, opacity 0.7s ease",
        borderTop: "1px solid #f5f5f5",
      }}>
        {current && (
          <div style={{ padding: "14px 18px" }}>
            <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.35s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} style={{ fontSize: 13, color: i <= current.note ? "#f5a623" : "#e0e0e0" }}>★</span>
                ))}
                <span style={{ fontSize: 11, color: "#ccc" }}>
                  {new Date(current.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </span>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>{current.commentaire}</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                onClick={() => navigate(Math.max(0, index - 1))}
                disabled={index === 0}
                style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 7, width: 30, height: 30, cursor: index === 0 ? "not-allowed" : "pointer", color: index === 0 ? "#ddd" : "#555", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s, border-color 0.15s" }}
              >‹</button>
              <span style={{ fontSize: 11, color: "#bbb" }}>{index + 1} / {total}</span>
              <button
                onClick={() => navigate(Math.min(total - 1, index + 1))}
                disabled={index === total - 1}
                style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 7, width: 30, height: 30, cursor: index === total - 1 ? "not-allowed" : "pointer", color: index === total - 1 ? "#ddd" : "#555", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s, border-color 0.15s" }}
              >›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

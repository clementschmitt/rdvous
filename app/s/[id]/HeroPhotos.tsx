"use client";
import { useEffect, useState } from "react";

// Mosaïque cliquable + diaporama plein écran (lightbox) pour les photos du salon.
export default function HeroPhotos({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") setIndex(i => (i === null ? i : (i + 1) % photos.length));
      else if (e.key === "ArrowLeft") setIndex(i => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, photos.length]);

  const prev = () => setIndex(i => (i === null ? i : (i - 1 + photos.length) % photos.length));
  const next = () => setIndex(i => (i === null ? i : (i + 1) % photos.length));

  const navBtn: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 2,
    background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
    width: 50, height: 50, borderRadius: "50%", cursor: "pointer", fontSize: 26, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };

  return (
    <>
      {/* Mosaïque */}
      {photos.length === 1 ? (
        <div onClick={() => setIndex(0)} style={{ position: "absolute", inset: 0, backgroundImage: `url(${photos[0]})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", gap: 3 }}>
          <div onClick={() => setIndex(0)} style={{ flex: 2, backgroundImage: `url(${photos[0]})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            {photos.slice(1, 3).map((url, i, arr) => (
              <div key={i} onClick={() => setIndex(i + 1)} style={{ position: "relative", flex: 1, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }}>
                {/* Dernière vignette : voile + accès au diaporama */}
                {i === arr.length - 1 && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#fff", transition: "background 0.2s" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    <span style={{ fontSize: 12, fontWeight: 700, textAlign: "center", padding: "0 6px" }}>Voir les {photos.length} photos</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diaporama plein écran */}
      {open && (
        <div onClick={() => setIndex(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setIndex(null)} aria-label="Fermer" style={{ position: "absolute", top: 18, right: 24, zIndex: 2, background: "none", border: "none", color: "#fff", fontSize: 34, cursor: "pointer", lineHeight: 1 }}>×</button>
          <div style={{ position: "absolute", top: 26, left: 26, color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600 }}>{(index ?? 0) + 1} / {photos.length}</div>

          {photos.length > 1 && <button aria-label="Précédente" onClick={e => { e.stopPropagation(); prev(); }} style={{ ...navBtn, left: 16 }}>‹</button>}

          <div onClick={e => e.stopPropagation()} style={{ width: "88vw", height: "84vh", backgroundImage: `url(${photos[index ?? 0]})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />

          {photos.length > 1 && <button aria-label="Suivante" onClick={e => { e.stopPropagation(); next(); }} style={{ ...navBtn, right: 16 }}>›</button>}

          {/* Miniatures */}
          {photos.length > 1 && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", gap: 8, justifyContent: "center", padding: "0 16px", overflowX: "auto" }}>
              {photos.map((url, i) => (
                <div key={i} onClick={() => setIndex(i)} style={{ width: 62, height: 46, flexShrink: 0, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 5, cursor: "pointer", opacity: i === (index ?? 0) ? 1 : 0.45, border: i === (index ?? 0) ? "2px solid #fff" : "2px solid transparent", transition: "opacity 0.2s" }} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

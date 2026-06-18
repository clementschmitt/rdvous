"use client";
import { useEffect, useState } from "react";

// Contact du sidebar : caché tant que la barre de contact du haut est visible,
// révélé quand on scrolle au-delà (la barre du haut sort de l'écran).
// Sur mobile, la barre du haut est masquée, donc on affiche toujours le contact ici.
export default function SidebarContact({ telephone, telFormate, mapsUrl, adresseLabel }: {
  telephone: string | null;
  telFormate: string | null;
  mapsUrl: string | null;
  adresseLabel: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) { setShow(true); return; }
    const target = document.getElementById("vitrine-contact-top");
    if (!target) { setShow(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  if (!telephone && !mapsUrl) return null;

  return (
    <div style={{
      maxHeight: show ? 120 : 0,
      opacity: show ? 1 : 0,
      marginTop: show ? 10 : 0,
      paddingTop: show ? 10 : 0,
      borderTop: show ? "1px solid #f5f5f5" : "none",
      overflow: "hidden",
      transition: "max-height 0.3s ease, opacity 0.25s ease, margin-top 0.3s ease, padding-top 0.3s ease",
      display: "flex",
      flexDirection: "column",
      gap: 7,
    }}>
      {telephone && (
        <a href={`tel:${telephone}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555", textDecoration: "none" }}>
          📞 {telFormate}
        </a>
      )}
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555", textDecoration: "none" }}>
          📍 {adresseLabel}
        </a>
      )}
    </div>
  );
}

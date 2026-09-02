"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccueilHref } from "@/lib/accueil";
import { useDansApp } from "@/lib/contexte-app";

/**
 * Barre du haut de la coquille mobile, partagée par l'accueil et l'espace client.
 *
 * Jamais sur le web bureau, qui a sa propre mise en page large. Les pages
 * restent communes aux deux mondes : on ne duplique pas les routes sous `/app`,
 * c'est le cadre qui s'adapte au contexte, pas l'arborescence.
 *
 * `capacitorSeulement` sert aux pages qui portent déjà SiteHeader, la page salon
 * notamment : sur le web mobile c'est SiteHeader qui s'affiche, et sans cette
 * option les deux barres se superposeraient.
 */
export default function AppHeader({ retour = false, retourVers, retourAccueil = false, action, capacitorSeulement = false }: { retour?: boolean; retourVers?: string; retourAccueil?: boolean; action?: "compte" | "parametres" | null; capacitorSeulement?: boolean }) {
  const router = useRouter();
  const accueil = useAccueilHref();
  const dansApp = useDansApp();
  const [etroit, setEtroit] = useState(false);

  useEffect(() => { setEtroit(window.innerWidth < 1024); }, []);

  const visible = dansApp || (!capacitorSeulement && etroit);

  if (!visible) return null;

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50, background: "#fff",
      borderBottom: "1px solid #efeae6", padding: "14px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      {retour ? (
        // Jamais un simple router.back() : l'historique peut être vide, quand
        // l'application est ouverte depuis une notification par exemple, et le
        // bouton ne mènerait alors nulle part. On revient à l'accueil à défaut.
        <button onClick={() => {
          if (retourAccueil) { router.push(accueil); return; }
          if (retourVers) { router.push(retourVers); return; }
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push(accueil);
        }} aria-label="Retour"
          style={{ width: 38, height: 38, borderRadius: 11, background: "#f5f1ee", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1a1614" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : <div style={{ width: 38 }} />}

      <Link href={accueil} style={{ textDecoration: "none", fontFamily: "'Cormorant Garamond', serif", fontSize: 25, fontWeight: 500, color: "#1a1614", letterSpacing: "0.06em", lineHeight: 1 }}>
        rdvous
      </Link>

      {action ? (
        <Link href={action === "compte" ? "/mon-compte" : "/mon-compte/parametres"}
          aria-label={action === "compte" ? "Mon compte" : "Paramètres"}
          style={{ width: 38, height: 38, borderRadius: 11, background: "#f5f1ee", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          {action === "compte" ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1a1614" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1614" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}
        </Link>
      ) : <div style={{ width: 38 }} />}
    </div>
  );
}

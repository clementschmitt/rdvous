"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function AnnulerPage() {
  const params = useParams();
  const token = params.token as string;
  const [step, setStep] = useState<"confirm" | "loading" | "done" | "error">("confirm");
  const [result, setResult] = useState<{ salon_nom?: string; dateStr?: string; heureStr?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function confirmerAnnulation() {
    setStep("loading");
    const res = await fetch("/api/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json();
    if (json.ok) {
      setResult(json);
      setStep("done");
    } else {
      setErrorMsg(json.error || "Une erreur est survenue.");
      setStep("error");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 440, width: "100%", boxShadow: "0 2px 20px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <div style={{ fontFamily: "serif", fontSize: 28, fontWeight: 700, color: "#1a1a1a", marginBottom: 32 }}>rdvous</div>

        {step === "confirm" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Annuler mon rendez-vous</h1>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 32px", lineHeight: 1.6 }}>
              Êtes-vous sûr(e) de vouloir annuler ce rendez-vous ?<br />
              Cette action est irréversible.
            </p>
            <button onClick={confirmerAnnulation}
              style={{ width: "100%", padding: "14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
              Oui, annuler mon rendez-vous
            </button>
            <a href="/" style={{ display: "block", fontSize: 13, color: "#999", textDecoration: "none" }}>Retour à l'accueil</a>
          </>
        )}

        {step === "loading" && (
          <p style={{ fontSize: 14, color: "#666" }}>Annulation en cours…</p>
        )}

        {step === "done" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", color: "#16a34a" }}>Rendez-vous annulé</h1>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
              Votre rendez-vous {result?.dateStr ? `du ${result.dateStr} à ${result.heureStr}` : ""} chez <strong>{result?.salon_nom}</strong> a bien été annulé.
            </p>
          </>
        )}

        {step === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px", color: "#dc2626" }}>Impossible d'annuler</h1>
            <p style={{ fontSize: 14, color: "#666" }}>{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}

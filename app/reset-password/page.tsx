"use client";
import { useState } from "react";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { T } from "@/lib/theme";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createSupabase();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: T.heading, fontSize: 38, fontWeight: 600, color: T.text, marginBottom: 8, letterSpacing: "-0.5px" }}>rdvous</h1>
          <p style={{ fontSize: 14, color: T.muted }}>Réinitialiser votre mot de passe</p>
        </div>

        <div style={{ background: T.white, borderRadius: T.radius, padding: 36, boxShadow: T.shadowMd, border: `1px solid ${T.border}` }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
              <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
                Un email vous a été envoyé à <strong>{email}</strong>.<br />
                Cliquez sur le lien pour choisir un nouveau mot de passe.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{ padding: "11px", background: T.text, color: T.white, border: "none", borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.muted }}>
          <Link href="/login" style={{ color: T.text, fontWeight: 600 }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, background: T.bg, color: T.text, outline: "none" };

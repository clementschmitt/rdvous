"use client";
import { useEffect, useState, Suspense } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createSupabase();
    const code = searchParams.get("code");

    if (code) {
      // PKCE flow : échange le code contre une session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) setReady(true);
      });
      return;
    }

    // Fallback : ancien flow implicite (PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (pw !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const supabase = createSupabase();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    setTimeout(() => router.push("/mon-compte"), 2000);
  }

  if (success) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Mot de passe mis à jour</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>Redirection en cours...</div>
      </div>
    </div>
  );

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: T.muted, fontSize: 14 }}>Vérification du lien...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontFamily: T.heading, fontSize: 28, fontWeight: 600, color: T.text, margin: "0 0 8px" }}>Nouveau mot de passe</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Choisissez un mot de passe sécurisé.</p>
        </div>
        <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "24px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nouveau mot de passe</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} required
                  style={{ width: "100%", padding: "10px 40px 10px 13px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", padding: 0 }}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirmer</label>
              <div style={{ position: "relative" }}>
                <input type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} required
                  style={{ width: "100%", padding: "10px 40px 10px 13px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.muted, display: "flex", padding: 0 }}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ padding: "11px", background: T.text, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: T.muted }}>
          <Link href="/mon-compte" style={{ color: T.text }}>← Retour</Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>;
}

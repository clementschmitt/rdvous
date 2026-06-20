"use client";
import { useState, useEffect } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { Suspense } from "react";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const isClient = next.startsWith("/mon-compte");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[a-zA-Z0-9_%+\-]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9_%+\-])?@[a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}$/.test(email) || email.includes("..")) { setError("Adresse email invalide."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setLoading(true);
    const supabase = createSupabase();
    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(isClient ? (next || "/mon-compte") : "/onboarding")}`;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { user_type: isClient ? "client" : "artisan" }, emailRedirectTo: redirectTo } });
    if (error) { setError(error.message); setLoading(false); return; }
    if (!isClient && searchParams.get("plan") === "solo") sessionStorage.setItem("upgrade_intent", "solo");
    // Si session null → confirmation email envoyée
    if (!data.session) { setEmailSent(true); setLoading(false); return; }
    router.push(isClient ? (next || "/mon-compte") : "/onboarding");
  }

  if (emailSent) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: T.heading, fontSize: 38, fontWeight: 600, color: T.text, marginBottom: 8, letterSpacing: "-0.5px" }}>rdvous</h1>
        <div style={{ background: T.white, borderRadius: T.radius, padding: 36, boxShadow: T.shadowMd, border: `1px solid ${T.border}`, marginTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: T.text, marginBottom: 10 }}>Vérifiez votre email</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
            Un lien de confirmation a été envoyé à <strong>{email}</strong>.<br />
            Cliquez dessus pour activer votre compte.
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: T.heading, fontSize: 38, fontWeight: 600, color: T.text, marginBottom: 8, letterSpacing: "-0.5px" }}>rdvous</h1>
          <p style={{ fontSize: 14, color: T.muted }}>{isClient ? "Créez votre compte client" : "Créez votre espace professionnel"}</p>
        </div>

        <div style={{ background: T.white, borderRadius: T.radius, padding: 36, boxShadow: T.shadowMd, border: `1px solid ${T.border}` }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            </div>
            {error && <p style={{ color: "#B91C1C", fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ padding: "11px", background: T.text, color: T.white, border: "none", borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.muted }}>
          Déjà un compte ?{" "}
          <Link href="/login" style={{ color: T.text, fontWeight: 600 }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupContent /></Suspense>;
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, background: T.bg, color: T.text, outline: "none" };

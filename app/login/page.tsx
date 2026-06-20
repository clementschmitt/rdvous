"use client";
import { useState, Suspense } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    const next = searchParams.get("next");
    const userType = data.user?.user_metadata?.user_type;
    router.push(next || (userType === "client" ? "/mon-compte" : "/dashboard"));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: T.heading, fontSize: 38, fontWeight: 600, color: T.text, marginBottom: 8, letterSpacing: "-0.5px" }}>rdvous</h1>
          <p style={{ fontSize: 14, color: T.muted }}>Connectez-vous à votre espace</p>
        </div>

        <div style={{ background: T.white, borderRadius: T.radius, padding: 36, boxShadow: T.shadowMd, border: `1px solid ${T.border}` }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={labelStyle}>Mot de passe</label>
                <Link href="/reset-password" style={{ fontSize: 11, color: T.muted, textDecoration: "none" }}>Mot de passe oublié ?</Link>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
            {error && <p style={{ color: "#B91C1C", fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ padding: "11px", background: T.text, color: T.white, border: "none", borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.muted }}>
          Pas encore de compte ?{" "}
          <Link href={`/signup${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`} style={{ color: T.text, fontWeight: 600 }}>Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, background: T.bg, color: T.text, outline: "none" };

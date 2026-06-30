"use client";
import { useEffect, useState } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";
import { useAccentColor, ACCENT_COLORS } from "@/lib/accent-color";

export default function ParametresPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { color: accentColor, setColor: setAccentColor } = useAccentColor();

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (user.user_metadata?.user_type === "artisan") { router.push("/dashboard"); return; }
      setEmail(user.email || "");
      setReady(true);
    })();
  }, [router]);

  async function handleReset() {
    setLoading(true);
    const supabase = createSupabase();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/mon-compte/reset-password`,
    });
    setSent(true);
    setLoading(false);
  }

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px 64px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <Link href="/mon-compte" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: `1px solid ${T.border}`, color: T.text, textDecoration: "none", fontSize: 18, flexShrink: 0 }}>
            ←
          </Link>
          <h1 style={{ fontFamily: T.heading, fontSize: 26, fontWeight: 600, color: T.text, margin: 0, letterSpacing: "-0.3px" }}>Paramètres</h1>
        </div>

        {/* Compte */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Compte</div>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Adresse email</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{email}</div>
          </div>
        </div>

        {/* Couleur personnalisée */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Couleur</div>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "16px" }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>Personnalisez votre expérience</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ACCENT_COLORS.map(c => (
                <button key={c.key} onClick={() => setAccentColor(c.hex)} title={c.label}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", background: c.hex,
                    border: accentColor === c.hex ? `3px solid ${c.hex}` : "3px solid transparent",
                    outline: accentColor === c.hex ? `2px solid ${c.hex}` : "2px solid transparent",
                    outlineOffset: 2,
                    cursor: "pointer", transition: "transform 0.15s",
                    transform: accentColor === c.hex ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mot de passe */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Mot de passe</div>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "18px 16px" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>Email envoyé</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>Vérifiez votre boite mail et cliquez sur le lien pour définir un nouveau mot de passe.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
                  Vous recevrez un lien par email pour définir un nouveau mot de passe.
                </div>
                <button onClick={handleReset} disabled={loading}
                  style={{ width: "100%", padding: "11px", background: T.text, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Envoi..." : "Modifier mon mot de passe"}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

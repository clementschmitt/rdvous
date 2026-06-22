"use client";
import { useEffect, useState } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";

export default function ParametresPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [pwForm, setPwForm] = useState({ new: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

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

  async function handlePwChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwSuccess(false);
    if (pwForm.new.length < 8) { setPwError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (pwForm.new !== pwForm.confirm) { setPwError("Les mots de passe ne correspondent pas."); return; }
    setPwLoading(true);
    const supabase = createSupabase();
    const { error } = await supabase.auth.updateUser({ password: pwForm.new });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setPwSuccess(true);
    setPwForm({ new: "", confirm: "" });
  }

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px 64px" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <Link href="/mon-compte" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", border: `1px solid ${T.border}`, color: T.text, textDecoration: "none", fontSize: 18, flexShrink: 0 }}>
            ←
          </Link>
          <h1 style={{ fontFamily: T.heading, fontSize: 26, fontWeight: 600, color: T.text, margin: 0, letterSpacing: "-0.3px" }}>Paramètres</h1>
        </div>

        {/* Compte */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Compte</div>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Adresse email</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{email}</div>
          </div>
        </div>

        {/* Mot de passe */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Mot de passe</div>
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "18px 16px" }}>
            <form onSubmit={handlePwChange} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nouveau mot de passe</label>
                <input type="password" value={pwForm.new} onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))} required
                  style={{ width: "100%", padding: "10px 13px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirmer</label>
                <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required
                  style={{ width: "100%", padding: "10px 13px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }} />
              </div>
              {pwError && <div style={{ fontSize: 12, color: "#dc2626" }}>{pwError}</div>}
              {pwSuccess && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Mot de passe mis à jour.</div>}
              <button type="submit" disabled={pwLoading}
                style={{ padding: "11px", background: T.text, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: pwLoading ? "not-allowed" : "pointer", opacity: pwLoading ? 0.6 : 1, marginTop: 2 }}>
                {pwLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

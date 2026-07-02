"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabase } from "@/lib/supabase";
import { METIERS, type Metier } from "@/lib/metiers";
import { T } from "@/lib/theme";

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [metier, setMetier] = useState<Metier | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [deplacement, setDeplacement] = useState<"non" | "possible" | "uniquement">("non");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const metierKeys = Object.keys(METIERS) as Metier[];

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/onboarding"); return; }
      if (user.user_metadata?.user_type === "client") { router.push("/mon-compte"); return; }
      setReady(true);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!metier) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, metier, telephone, adresse, ville, deplacement }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Erreur lors de la création du salon."); setLoading(false); return; }
    router.push("/dashboard");
  }

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ width: "100%", maxWidth: 500, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontFamily: T.heading, fontSize: 38, fontWeight: 600, color: T.text, letterSpacing: "-0.5px", marginBottom: 8 }}>rdvous</h1>
          <p style={{ fontSize: 13, color: T.muted }}>Étape {step}/2 — {step === 1 ? "Votre métier" : "Votre établissement"}</p>
        </div>

        <div style={{ background: T.white, borderRadius: T.radius, padding: 36, boxShadow: T.shadowMd, border: `1px solid ${T.border}` }}>
          {step === 1 && (
            <div>
              <p style={{ fontFamily: T.heading, fontSize: 20, fontWeight: 600, marginBottom: 20, color: T.text }}>Vous exercez en tant que...</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                {metierKeys.map(m => (
                  <button
                    key={m}
                    onClick={() => setMetier(m)}
                    style={{ padding: "20px 16px", border: `2px solid ${metier === m ? METIERS[m].couleur : T.border}`, borderRadius: T.radiusSm, background: metier === m ? `${METIERS[m].couleur}10` : T.white, cursor: "pointer", fontWeight: 600, fontSize: 14, color: metier === m ? METIERS[m].couleur : T.text, transition: "all 0.15s", fontFamily: T.body }}
                  >
                    {METIERS[m].label}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} disabled={!metier} style={{ width: "100%", padding: "12px", background: T.text, color: T.white, border: "none", borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: metier ? "pointer" : "not-allowed", opacity: metier ? 1 : 0.35, fontFamily: T.body }}>
                Continuer
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nom de votre établissement *</label>
                <input value={nom} onChange={e => setNom(e.target.value)} required placeholder="Ex : Nails by Onyxia" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Téléphone</label>
                <input value={telephone} onChange={e => setTelephone(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input value={adresse} onChange={e => setAdresse(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ville</label>
                <input value={ville} onChange={e => setVille(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Déplacements à domicile</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    { value: "non", label: "Non — je reçois uniquement en salon" },
                    { value: "possible", label: "Oui, en option — salon et domicile" },
                    { value: "uniquement", label: "Oui, uniquement à domicile" },
                  ] as { value: "non" | "possible" | "uniquement"; label: string }[]).map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: T.text, padding: "10px 12px", border: `1.5px solid ${deplacement === opt.value ? (metier ? METIERS[metier].couleur : T.text) : T.border}`, borderRadius: T.radiusSm, background: deplacement === opt.value ? (metier ? `${METIERS[metier].couleur}10` : "#f5f5f5") : T.white }}>
                      <input type="radio" name="deplacement" value={opt.value} checked={deplacement === opt.value} onChange={() => setDeplacement(opt.value)} style={{ accentColor: metier ? METIERS[metier].couleur : T.text }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              {error && <p style={{ color: "#B91C1C", fontSize: 13, margin: 0 }}>{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: "11px", background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>
                  Retour
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", background: T.text, color: T.white, border: "none", borderRadius: T.radiusSm, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: T.body }}>
                  {loading ? "Création..." : "Créer mon espace"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.muted }}>
          Vous cherchez à réserver un rendez-vous ?{" "}
          <a href="/mon-compte" style={{ color: T.text, fontWeight: 600, textDecoration: "none" }}>Accéder à mon espace</a>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, background: T.bg, color: T.text, outline: "none" };

"use client";
import { useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CapsulesMesures, parseCapsules, type Capsules } from "@/app/components/CapsulesMesures";

function normaliserPrenom(prenom: string): string {
  return prenom.trim()
    .split(/[-\s]/)[0]
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .replace(/^(.)/, c => c.toUpperCase());
}

async function genererCode(supabase: ReturnType<typeof import("@/lib/supabase").createSupabase>, salonId: string, prenom: string, dateNaissance: string): Promise<string> {
  const base = normaliserPrenom(prenom);
  if (!dateNaissance) return `${base}${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`;
  const [, mois, jour] = dateNaissance.split("-");
  const simple = `${base}${jour}`;
  const { data } = await supabase.from("clients").select("id").eq("salon_id", salonId).eq("code_parrainage", simple);
  if (!data || data.length === 0) return simple;
  return `${base}${jour}${mois}`;
}

export default function NouveauClientPage() {
  const salon = useSalon();
  const router = useRouter();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [adresse, setAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [notes, setNotes] = useState("");
  const [preferences, setPreferences] = useState("");
  const [codeParrain, setCodeParrain] = useState("");
  const [champsMetier, setChampsMetier] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!salon) return null;
  const m = METIERS[salon.metier];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabase();

    let parrain_id: string | null = null;
    if (codeParrain.trim()) {
      const { data: parrain } = await supabase
        .from("clients")
        .select("id")
        .eq("salon_id", salon!.id)
        .eq("code_parrainage", codeParrain.trim())
        .single();
      if (!parrain) {
        setError("Code de parrainage invalide.");
        setLoading(false);
        return;
      }
      parrain_id = parrain.id;
    }

    const code_parrainage = await genererCode(supabase, salon!.id, prenom, dateNaissance);

    const { error: err } = await supabase.from("clients").insert({
      salon_id: salon!.id,
      prenom,
      nom,
      telephone: telephone || null,
      email: email || null,
      date_naissance: dateNaissance || null,
      adresse: adresse || null,
      code_postal: codePostal || null,
      ville: ville || null,
      notes: notes || null,
      preferences: preferences || null,
      parrain_id,
      champs_metier: champsMetier,
      code_parrainage,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard/clients");
  }

  const labelSingulier = "Client";

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/clients" style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← {m.labelClients}</Link>
      </div>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Nouveau client</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Section titre="Identité">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Champ label="Prénom *" value={prenom} onChange={setPrenom} required />
            <Champ label="Nom *" value={nom} onChange={setNom} required />
          </div>
          <Champ label="Téléphone" value={telephone} onChange={setTelephone} />
          <Champ label="Email" value={email} onChange={setEmail} type="email" />
          <Champ label="Date de naissance" value={dateNaissance} onChange={setDateNaissance} type="date" />
        </Section>

        <Section titre="Adresse">
          <Champ label="Adresse" value={adresse} onChange={setAdresse} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <Champ label="Code postal" value={codePostal} onChange={setCodePostal} />
            <Champ label="Ville" value={ville} onChange={setVille} />
          </div>
        </Section>

        {m.champsClient.length > 0 && (
          <Section titre="Informations métier">
            {m.champsClient.map(champ => {
              if (champ.key === "mesures_capsules") {
                const caps = parseCapsules(champsMetier[champ.key]);
                return (
                  <div key={champ.key}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Mesures capsules</label>
                    <CapsulesMesures
                      value={caps}
                      onChange={v => setChampsMetier(prev => ({ ...prev, mesures_capsules: v as unknown as string }))}
                      editing={true}
                      couleur={m.couleur}
                    />
                  </div>
                );
              }
              return (
                <Champ
                  key={champ.key}
                  label={champ.label}
                  value={champsMetier[champ.key] || ""}
                  onChange={v => setChampsMetier(prev => ({ ...prev, [champ.key]: v }))}
                  type={(champ.type as string) === "number" ? "number" : "text"}
                />
              );
            })}
          </Section>
        )}

        <Section titre="Notes & préférences">
          <ChampTextarea label="Préférences" value={preferences} onChange={setPreferences} />
          <ChampTextarea label="Notes internes" value={notes} onChange={setNotes} />
        </Section>

        <Section titre="Parrainage">
          <Champ label="Code parrain (optionnel)" value={codeParrain} onChange={setCodeParrain} placeholder="Ex: a1b2c3d4" />
        </Section>

        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard/clients" style={{ flex: 1, padding: "11px", background: "#f0f0f0", color: "#333", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Annuler
          </Link>
          <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Enregistrement..." : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Champ({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
      />
    </div>
  );
}

function ChampTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
      />
    </div>
  );
}

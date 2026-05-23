"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type Client = { id: string; prenom: string; nom: string; cagnotte: number };
type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number };

function NouveauRDVContent() {
  const salon = useSalon();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("client") || "");
  const [date, setDate] = useState(searchParams.get("date") || new Date().toISOString().split("T")[0]);
  const [heure, setHeure] = useState(searchParams.get("heure") || "09:00");
  const [selectedPrests, setSelectedPrests] = useState<string[]>([]);
  const [cagnotteAUtiliser, setCagnotteAUtiliser] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const clientSelectionne = clients.find(c => c.id === clientId);
  const prestasSelectionnees = prestations.filter(p => selectedPrests.includes(p.id));
  const tarifTotal = prestasSelectionnees.reduce((s, p) => s + p.tarif, 0);
  const dureeTotal = prestasSelectionnees.reduce((s, p) => s + p.duree_minutes, 0);
  const cagnotteMax = clientSelectionne ? Math.min(clientSelectionne.cagnotte, tarifTotal) : 0;
  const tarifFinal = Math.max(0, tarifTotal - cagnotteAUtiliser);

  useEffect(() => {
    if (!salon) return;
    (async () => {
      const supabase = createSupabase();
      const [cRes, pRes] = await Promise.all([
        supabase.from("clients").select("id, prenom, nom, cagnotte").eq("salon_id", salon!.id).order("nom"),
        supabase.from("prestations").select("*").eq("salon_id", salon!.id).order("nom"),
      ]);
      setClients((cRes.data || []) as Client[]);
      setPrestations((pRes.data || []) as Prestation[]);
    })();
  }, [salon]);

  useEffect(() => {
    setCagnotteAUtiliser(0);
  }, [clientId]);

  function togglePresta(id: string) {
    setSelectedPrests(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError("Sélectionnez un client."); return; }
    if (selectedPrests.length === 0) { setError("Sélectionnez au moins une prestation."); return; }
    setLoading(true);
    setError("");

    const supabase = createSupabase();

    // Gate plan free : max 30 RDV/mois
    if ((salon!.plan || "free") === "free") {
      const debut = new Date(); debut.setDate(1); debut.setHours(0, 0, 0, 0);
      const fin = new Date(debut); fin.setMonth(fin.getMonth() + 1);
      const { count } = await supabase
        .from("rendez_vous")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon!.id)
        .gte("date_heure", debut.toISOString())
        .lt("date_heure", fin.toISOString());
      if ((count ?? 0) >= 30) {
        setError("Limite de 30 rendez-vous/mois atteinte. Passez à l'offre Indépendant pour continuer.");
        setLoading(false);
        return;
      }
    }
    const { data: rdv, error: rdvErr } = await supabase
      .from("rendez_vous")
      .insert({ salon_id: salon!.id, client_id: clientId, date_heure: `${date}T${heure}:00`, montant_cagnotte_utilise: cagnotteAUtiliser, notes: notes || null })
      .select()
      .single();

    if (rdvErr || !rdv) { setError(rdvErr?.message || "Erreur"); setLoading(false); return; }

    await supabase.from("rendez_vous_prestations").insert(
      selectedPrests.map(pid => ({ rendez_vous_id: rdv.id, prestation_id: pid }))
    );

    if (cagnotteAUtiliser > 0) {
      await supabase.from("clients").update({ cagnotte: (clientSelectionne!.cagnotte - cagnotteAUtiliser) }).eq("id", clientId);
      await supabase.from("cagnotte_mouvements").insert({ salon_id: salon!.id, client_id: clientId, montant: -cagnotteAUtiliser, type: "utilisation", reference_id: rdv.id });
    }

    // Fire-and-forget — ne bloque pas la navigation
    fetch("/api/email/confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rdv_id: rdv.id }),
    });

    router.push(`/dashboard/agenda/${rdv.id}`);
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const clientsFiltres = clients.filter(c =>
    `${c.prenom} ${c.nom}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const CRENEAUX = Array.from({ length: 25 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`).filter(h => h <= "20:00");

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard/agenda" style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← Agenda</Link>
      </div>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Nouveau rendez-vous</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section titre="Date & heure">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Heure *</label>
              <select value={heure} onChange={e => setHeure(e.target.value)} style={inputStyle}>
                {CRENEAUX.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </Section>

        <Section titre={`${m.labelClients.replace(/s$/, "")} *`}>
          <input
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder={`Rechercher...`}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 7 }}>
            {clientsFiltres.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: "#bbb" }}>Aucun résultat</div>
            ) : clientsFiltres.map(c => (
              <div
                key={c.id}
                onClick={() => { setClientId(c.id); setClientSearch(`${c.prenom} ${c.nom}`); }}
                style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", background: clientId === c.id ? `${m.couleur}12` : "transparent", color: clientId === c.id ? m.couleur : "#333", fontWeight: clientId === c.id ? 600 : 400 }}
              >
                {c.prenom} {c.nom}
                {c.cagnotte > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: m.couleur }}>{c.cagnotte.toFixed(0)} € cagnotte</span>}
              </div>
            ))}
          </div>
        </Section>

        <Section titre="Prestations *">
          {prestations.length === 0 ? (
            <div style={{ fontSize: 13, color: "#bbb" }}>Aucune prestation. <Link href="/dashboard/parametres" style={{ color: m.couleur }}>Créez-en d'abord.</Link></div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {prestations.map(p => {
                const sel = selectedPrests.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePresta(p.id)}
                    style={{ padding: "7px 14px", border: `2px solid ${sel ? m.couleur : "#e0e0e0"}`, borderRadius: 20, background: sel ? `${m.couleur}15` : "#fff", color: sel ? m.couleur : "#555", fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer" }}
                  >
                    {p.nom} — {p.duree_minutes}min — {p.tarif}€
                  </button>
                );
              })}
            </div>
          )}
          {selectedPrests.length > 0 && (
            <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
              Total : <b>{dureeTotal} min</b> — <b>{tarifTotal} €</b>
            </div>
          )}
        </Section>

        {clientSelectionne && clientSelectionne.cagnotte > 0 && tarifTotal > 0 && (
          <Section titre="Cagnotte">
            <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
              Cagnotte disponible : <b style={{ color: m.couleur }}>{clientSelectionne.cagnotte.toFixed(2)} €</b>
            </div>
            <div>
              <label style={labelStyle}>Montant à déduire</label>
              <input
                type="range"
                min={0}
                max={cagnotteMax}
                step={0.5}
                value={cagnotteAUtiliser}
                onChange={e => setCagnotteAUtiliser(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                <span>0 €</span>
                <span style={{ fontWeight: 600, color: m.couleur }}>- {cagnotteAUtiliser.toFixed(2)} €</span>
                <span>{cagnotteMax.toFixed(2)} €</span>
              </div>
              {cagnotteAUtiliser > 0 && (
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, color: "#333" }}>
                  <span style={{ textDecoration: "line-through", color: "#aaa", marginRight: 8 }}>{tarifTotal} €</span>
                  <span>{tarifFinal.toFixed(2)} €</span>
                </div>
              )}
            </div>
          </Section>
        )}

        <Section titre="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes optionnelles..." style={{ ...inputStyle, resize: "vertical" }} />
        </Section>

        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/dashboard/agenda" style={{ flex: 1, padding: "11px", background: "#f0f0f0", color: "#333", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            Annuler
          </Link>
          <button type="submit" disabled={loading} style={{ flex: 2, padding: "11px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Création..." : "Créer le RDV"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NouveauRDVPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#bbb" }}>Chargement...</div>}>
      <NouveauRDVContent />
    </Suspense>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" };

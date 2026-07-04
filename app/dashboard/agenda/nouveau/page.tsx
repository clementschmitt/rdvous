"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type Client = { id: string; prenom: string; nom: string; cagnotte: number };
type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; categorie_id: string | null };
type Category = { id: string; nom: string; ordre: number };

function NouveauRDVContent() {
  const salon = useSalon();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("client") || "");
  const [date, setDate] = useState(searchParams.get("date") || new Date().toISOString().split("T")[0]);
  const [heure, setHeure] = useState(searchParams.get("heure") || "09:00");
  const [selectedPrests, setSelectedPrests] = useState<string[]>([]);
  const [cagnotteAUtiliser, setCagnotteAUtiliser] = useState(0);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [overrideActif, setOverrideActif] = useState(false);
  const [montantOverride, setMontantOverride] = useState<number | "">("");
  const [dureeOverrideActif, setDureeOverrideActif] = useState(false);
  const [dureeOverride, setDureeOverride] = useState<number | "">(60);
  const [notes, setNotes] = useState("");
  const [forcerConflit, setForcerConflit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ prenom: "", nom: "", telephone: "", email: "" });
  const [savingNewClient, setSavingNewClient] = useState(false);

  const clientSelectionne = clients.find(c => c.id === clientId);
  const prestasSelectionnees = prestations.filter(p => selectedPrests.includes(p.id));
  const tarifTotal = prestasSelectionnees.reduce((s, p) => s + p.tarif, 0);
  const dureeTotal = prestasSelectionnees.reduce((s, p) => s + p.duree_minutes, 0);
  const dureeFinal = dureeOverrideActif && dureeOverride !== "" ? Number(dureeOverride) : dureeTotal || 60;
  const tarifBase = overrideActif && montantOverride !== "" ? Number(montantOverride) : tarifTotal;
  const cagnotteMax = clientSelectionne ? Math.min(clientSelectionne.cagnotte, tarifBase) : 0;
  const tarifFinal = Math.max(0, tarifBase - cagnotteAUtiliser);

  useEffect(() => {
    if (!salon) return;
    (async () => {
      const supabase = createSupabase();
      const [cRes, pRes, catRes] = await Promise.all([
        supabase.from("clients").select("id, prenom, nom, cagnotte").eq("salon_id", salon!.id).order("nom"),
        supabase.from("prestations").select("id, nom, duree_minutes, tarif, categorie_id").eq("salon_id", salon!.id).eq("actif", true).order("nom"),
        supabase.from("prestation_categories").select("id, nom, ordre").eq("salon_id", salon!.id).order("ordre"),
      ]);
      setClients((cRes.data || []) as Client[]);
      setPrestations((pRes.data || []) as Prestation[]);
      setCategories((catRes.data || []) as Category[]);
    })();
  }, [salon]);

  useEffect(() => {
    setCagnotteAUtiliser(0);
  }, [clientId, overrideActif]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientForm.prenom.trim() || !newClientForm.nom.trim()) return;
    setSavingNewClient(true);
    const supabase = createSupabase();
    const { normalizePhone, normalizeEmail } = await import("@/lib/normalize");
    const tel = normalizePhone(newClientForm.telephone);
    const mail = normalizeEmail(newClientForm.email);

    // Dédup : cherche d'abord par email, puis par téléphone
    type DedupClient = { id: string; prenom: string; nom: string; cagnotte: number };
    let existing: DedupClient | null = null;
    if (mail) {
      const { data } = await supabase.from("clients").select("id, prenom, nom, cagnotte").eq("salon_id", salon!.id).eq("email", mail).maybeSingle();
      existing = data as DedupClient | null;
    }
    if (!existing && tel) {
      const { data } = await supabase.from("clients").select("id, prenom, nom, cagnotte").eq("salon_id", salon!.id).eq("telephone", tel).maybeSingle();
      existing = data as DedupClient | null;
    }
    if (existing) {
      setClients(prev => prev.some(c => c.id === existing!.id) ? prev : [...prev, existing!].sort((a, b) => a.nom.localeCompare(b.nom)));
      setClientId(existing.id);
      setClientSearch(`${existing.prenom} ${existing.nom}`);
      setShowNewClient(false);
      setNewClientForm({ prenom: "", nom: "", telephone: "", email: "" });
      setSavingNewClient(false);
      return;
    }

    const { data } = await supabase.from("clients").insert({
      salon_id: salon!.id,
      prenom: newClientForm.prenom.trim(),
      nom: newClientForm.nom.trim(),
      telephone: tel,
      email: mail,
    }).select("id, prenom, nom, cagnotte").single();
    if (data) {
      const newC = data as Client;
      setClients(prev => [...prev, newC].sort((a, b) => a.nom.localeCompare(b.nom)));
      setClientId(newC.id);
      setClientSearch(`${newC.prenom} ${newC.nom}`);
    }
    setShowNewClient(false);
    setNewClientForm({ prenom: "", nom: "", telephone: "", email: "" });
    setSavingNewClient(false);
  }

  function togglePresta(id: string) {
    setSelectedPrests(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError("Sélectionnez un client."); return; }
    if (selectedPrests.length === 0 && !dureeOverrideActif) { setError("Sélectionnez au moins une prestation, ou activez une durée personnalisée."); return; }
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
        setError("Limite de 30 rendez-vous/mois atteinte. Passez à l'offre Pro pour continuer.");
        setLoading(false);
        return;
      }
    }

    const tarifInsert = overrideActif && montantOverride !== "" ? Number(montantOverride) : null;
    const cancelToken = crypto.randomUUID();

    let rdvId: string | null = null;

    if (forcerConflit) {
      // Insert direct — bypass la vérification de conflit de créneau
      const { data: inserted, error: insertErr } = await supabase
        .from("rendez_vous")
        .insert({
          salon_id: salon!.id,
          client_id: clientId,
          date_heure: `${date}T${heure}:00`,
          duree_minutes: dureeFinal,
          statut: "planifie",
          cancel_token: cancelToken,
          adresse_domicile: null,
          notes: notes || null,
          tarif: tarifInsert,
          montant_cagnotte_utilise: cagnotteAUtiliser || null,
          source: "salon",
        })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        setError(insertErr?.message || "Erreur");
        setLoading(false);
        return;
      }
      rdvId = inserted.id;
    } else {
      const { data, error: rdvErr } = await supabase.rpc("create_rdv_safe", {
        p_salon_id: salon!.id,
        p_client_id: clientId,
        p_date_heure: `${date}T${heure}:00`,
        p_duree_minutes: dureeTotal || 60,
        p_statut: "planifie",
        p_cancel_token: cancelToken,
        p_adresse_domicile: null,
        p_notes: notes || null,
        p_tarif: tarifInsert,
        p_montant_cagnotte_utilise: cagnotteAUtiliser || null,
        p_source: "salon",
      });
      if (rdvErr || !data) {
        if (rdvErr?.message?.includes("CONFLIT_CRENEAU")) {
          setError("Créneau déjà occupé. Cochez \"Forcer le créneau\" si vous souhaitez quand même créer ce rendez-vous.");
        } else {
          setError(rdvErr?.message || "Erreur");
        }
        setLoading(false);
        return;
      }
      rdvId = data as string;
    }

    const rdv = { id: rdvId! };

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

  // 08:00 → 22:45, pas de 15min
  const CRENEAUX = Array.from({ length: 60 }, (_, i) => {
    const total = 8 * 60 + i * 15;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }).filter(t => t <= "22:45");

  const activeCat = selectedCat ?? categories[0]?.id ?? null;
  const uncategorized = prestations.filter(p => !p.categorie_id);
  const visiblePrestas = activeCat === "__autres"
    ? uncategorized
    : activeCat
      ? prestations.filter(p => p.categorie_id === activeCat)
      : prestations;

  const renderPrestaList = (items: Prestation[]) => (
    <div style={{ border: "1px solid #e8e8e8", borderRadius: 8, overflow: "hidden" }}>
      {items.length === 0
        ? <div style={{ padding: "14px 16px", fontSize: 13, color: "#bbb" }}>Aucune prestation dans cette catégorie</div>
        : items.map((p, i) => {
          const sel = selectedPrests.includes(p.id);
          return (
            <div key={p.id} onClick={() => togglePresta(p.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: sel ? `${m.couleur}08` : "#fff", borderBottom: i < items.length - 1 ? "1px solid #f5f5f5" : "none" }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${sel ? m.couleur : "#d0d0d0"}`, background: sel ? m.couleur : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sel && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: "#1a1a1a" }}>{p.nom}</span>
              <span style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>{p.duree_minutes}min</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: sel ? m.couleur : "#555", flexShrink: 0, minWidth: 36, textAlign: "right" }}>{p.tarif}€</span>
            </div>
          );
        })
      }
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", userSelect: "none", marginTop: 12 }}>
            <input type="checkbox" checked={forcerConflit} onChange={e => setForcerConflit(e.target.checked)} style={{ accentColor: m.couleur }} />
            Forcer le créneau (ignorer les chevauchements)
          </label>
        </Section>

        <Section titre={`${m.labelClients.replace(/s$/, "")} *`}>
          <input
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 7 }}>
            {clientsFiltres.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: "#bbb" }}>Aucun résultat</div>
            ) : clientsFiltres.map(c => (
              <div key={c.id}
                onClick={() => { setClientId(c.id); setClientSearch(`${c.prenom} ${c.nom}`); }}
                style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", background: clientId === c.id ? `${m.couleur}12` : "transparent", color: clientId === c.id ? m.couleur : "#333", fontWeight: clientId === c.id ? 600 : 400 }}>
                {c.prenom} {c.nom}
                {c.cagnotte > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: m.couleur }}>{c.cagnotte.toFixed(0)} € cagnotte</span>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setShowNewClient(true)} style={{ marginTop: 8, background: "none", border: `1px dashed ${m.couleur}`, borderRadius: 7, padding: "7px 12px", fontSize: 12, color: m.couleur, cursor: "pointer", width: "100%", fontWeight: 600 }}>
            + Nouveau client
          </button>
        </Section>

        <Section titre="Prestations *">
          {prestations.length === 0 ? (
            <div style={{ fontSize: 13, color: "#bbb" }}>Aucune prestation. <Link href="/dashboard/parametres" style={{ color: m.couleur }}>Créez-en d'abord.</Link></div>
          ) : (
            <>
              {categories.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {categories.map(cat => {
                    const isActive = activeCat === cat.id;
                    const count = selectedPrests.filter(id => prestations.find(p => p.id === id && p.categorie_id === cat.id)).length;
                    return (
                      <button key={cat.id} type="button" onClick={() => setSelectedCat(cat.id)}
                        style={{ padding: "5px 12px", border: `1.5px solid ${isActive ? m.couleur : "#e0e0e0"}`, borderRadius: 20, background: isActive ? m.couleur : "#fff", color: isActive ? "#fff" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                        {cat.nom}
                        {count > 0 && <span style={{ background: isActive ? "rgba(255,255,255,0.35)" : m.couleur, color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{count}</span>}
                      </button>
                    );
                  })}
                  {uncategorized.length > 0 && (
                    <button type="button" onClick={() => setSelectedCat("__autres")}
                      style={{ padding: "5px 12px", border: `1.5px solid ${activeCat === "__autres" ? m.couleur : "#e0e0e0"}`, borderRadius: 20, background: activeCat === "__autres" ? m.couleur : "#fff", color: activeCat === "__autres" ? "#fff" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Autres
                    </button>
                  )}
                </div>
              )}
              {renderPrestaList(visiblePrestas)}
              {selectedPrests.length > 0 && (
                <div style={{ fontSize: 13, color: "#666", marginTop: 10 }}>
                  Total : <b>{dureeTotal} min</b> — <b>{tarifTotal} €</b>
                </div>
              )}
            </>
          )}
        </Section>

        <Section titre="Durée">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={dureeOverrideActif} onChange={e => setDureeOverrideActif(e.target.checked)} style={{ accentColor: m.couleur }} />
            Durée personnalisée{dureeTotal > 0 ? ` (calculée depuis les prestations : ${dureeTotal} min)` : ""}
          </label>
          {dureeOverrideActif && (
            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>Durée (minutes)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={dureeOverride}
                onChange={e => setDureeOverride(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="60"
                style={inputStyle}
              />
            </div>
          )}
        </Section>

        {selectedPrests.length > 0 && (
          <Section titre="Montant">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={overrideActif} onChange={e => setOverrideActif(e.target.checked)} style={{ accentColor: m.couleur }} />
              Modifier le montant (tarif calculé : {tarifTotal} €)
            </label>
            {overrideActif && (
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Montant personnalisé (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={montantOverride}
                  onChange={e => setMontantOverride(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder={String(tarifTotal)}
                  style={inputStyle}
                />
              </div>
            )}
          </Section>
        )}

        {clientSelectionne && clientSelectionne.cagnotte > 0 && tarifBase > 0 && (
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
                  <span style={{ textDecoration: "line-through", color: "#aaa", marginRight: 8 }}>{tarifBase} €</span>
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

      {showNewClient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setShowNewClient(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nouveau client</div>
            <form onSubmit={createClient} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input autoFocus type="text" placeholder="Prénom *" required value={newClientForm.prenom} onChange={e => setNewClientForm(p => ({ ...p, prenom: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                <input type="text" placeholder="Nom *" required value={newClientForm.nom} onChange={e => setNewClientForm(p => ({ ...p, nom: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <input type="tel" placeholder="Téléphone" value={newClientForm.telephone} onChange={e => setNewClientForm(p => ({ ...p, telephone: e.target.value }))} style={inputStyle} />
              <input type="email" placeholder="Email" value={newClientForm.email} onChange={e => setNewClientForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowNewClient(false)} style={{ flex: 1, padding: "9px", background: "#f0f0f0", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                <button type="submit" disabled={savingNewClient} style={{ flex: 2, padding: "9px", background: m.couleur, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: savingNewClient ? 0.6 : 1 }}>
                  {savingNewClient ? "Création..." : "Créer et sélectionner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CapsulesMesures, parseCapsules, type Capsules } from "@/app/components/CapsulesMesures";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; categorie_id: string | null };
type Category = { id: string; nom: string; ordre: number };
type TagTarifMap = Record<string, number>; // prestation_id → prix_override
type RDV = {
  id: string; date_heure: string; statut: string; notes: string | null;
  montant_cagnotte_utilise: number; tarif: number | null; client_id: string;
  clients: { id: string; prenom: string; nom: string; nb_visites: number; cagnotte: number; email: string | null; champs_metier: Record<string, string> } | null;
  rendez_vous_prestations: { prestation_id: string; prestations: Prestation | null }[];
};

const STATUTS = [
  { value: "planifie", label: "Planifié", color: "#2980b9" },
  { value: "effectue", label: "Effectué", color: "#27ae60" },
  { value: "annule", label: "Annulé", color: "#e74c3c" },
];

export default function RDVDetailPage() {
  const salon = useSalon();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const id = params.id as string;

  const [rdv, setRdv] = useState<RDV | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  const [editingPrestations, setEditingPrestations] = useState(false);
  const [allPrestations, setAllPrestations] = useState<Prestation[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagTarifMap, setTagTarifMap] = useState<TagTarifMap>({});
  const [discountTags, setDiscountTags] = useState<{ id: string; nom: string; couleur: string }[]>([]);

  const [capsules, setCapsules] = useState<Capsules>({ g: [0,0,0,0,0], d: [0,0,0,0,0] });
  const [editingCapsules, setEditingCapsules] = useState(false);
  const [savingCapsules, setSavingCapsules] = useState(false);

  const [cagnotteInput, setCagnotteInput] = useState(0);
  const [editingCagnotte, setEditingCagnotte] = useState(false);

  const [montantInput, setMontantInput] = useState(0);
  const [editingMontant, setEditingMontant] = useState(false);

  const [editingDateHeure, setEditingDateHeure] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newHeure, setNewHeure] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon, id]);

  async function load() {
    const supabase = createSupabase();
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, notes, montant_cagnotte_utilise, tarif, client_id, clients(id, prenom, nom, nb_visites, cagnotte, email, champs_metier), rendez_vous_prestations(prestation_id, prestations(id, nom, duree_minutes, tarif))")
      .eq("id", id)
      .single();
    if (!data) { router.push("/dashboard/agenda"); return; }
    const parsed = data as unknown as RDV;
    setRdv(parsed);
    setNotes(data.notes || "");
    setNewDate(data.date_heure.slice(0, 10));
    setNewHeure(data.date_heure.slice(11, 16));
    setCagnotteInput(parsed.montant_cagnotte_utilise || 0);
    const client = parsed.clients;
    if (client) setCapsules(parseCapsules(client.champs_metier?.mesures_capsules));

    // Charger les tarifs préférentiels du client
    if (parsed.client_id) {
      const { data: assignments } = await supabase.from("client_tag_assignments").select("tag_id").eq("client_id", parsed.client_id);
      if (assignments && assignments.length > 0) {
        const tagIds = assignments.map((a: { tag_id: string }) => a.tag_id);
        const [{ data: tarifs }, { data: tags }] = await Promise.all([
          supabase.from("tag_tarifs").select("tag_id, prestation_id, prix_override").in("tag_id", tagIds),
          supabase.from("client_tags").select("id, nom, couleur").in("id", tagIds),
        ]);
        const map: TagTarifMap = {};
        const tagByPresta: Record<string, string> = {}; // prestation_id → tag_id gagnant
        for (const t of (tarifs || []) as { tag_id: string; prestation_id: string; prix_override: number }[]) {
          if (map[t.prestation_id] === undefined || t.prix_override < map[t.prestation_id]) {
            map[t.prestation_id] = t.prix_override;
            tagByPresta[t.prestation_id] = t.tag_id;
          }
        }
        setTagTarifMap(map);
        // Tags qui s'appliquent à au moins une prestation du RDV
        const rdvPrestaIds = new Set(parsed.rendez_vous_prestations.map(rp => rp.prestation_id));
        const activeTagIds = new Set(Object.entries(tagByPresta).filter(([pid]) => rdvPrestaIds.has(pid)).map(([, tid]) => tid));
        setDiscountTags(((tags || []) as { id: string; nom: string; couleur: string }[]).filter(t => activeTagIds.has(t.id)));
      } else {
        setTagTarifMap({});
        setDiscountTags([]);
      }
    }
  }

  async function startEditPrestations() {
    const supabase = createSupabase();
    const [{ data: pData }, { data: cData }] = await Promise.all([
      supabase.from("prestations").select("id, nom, duree_minutes, tarif, categorie_id").eq("salon_id", salon!.id).eq("actif", true).order("nom"),
      supabase.from("prestation_categories").select("id, nom, ordre").eq("salon_id", salon!.id).order("ordre"),
    ]);
    setAllPrestations((pData || []) as Prestation[]);
    setAllCategories((cData || []) as Category[]);
    setSelectedCat(null);
    setSelectedIds(new Set(rdv!.rendez_vous_prestations.map(rp => rp.prestation_id)));

    // Charger les tarifs préférentiels du client
    const clientId = rdv!.client_id;
    if (clientId) {
      const { data: assignments } = await supabase.from("client_tag_assignments").select("tag_id").eq("client_id", clientId);
      if (assignments && assignments.length > 0) {
        const tagIds = assignments.map((a: { tag_id: string }) => a.tag_id);
        const { data: tarifs } = await supabase.from("tag_tarifs").select("prestation_id, prix_override").in("tag_id", tagIds);
        const map: TagTarifMap = {};
        for (const t of (tarifs || []) as { prestation_id: string; prix_override: number }[]) {
          if (map[t.prestation_id] === undefined || t.prix_override < map[t.prestation_id]) map[t.prestation_id] = t.prix_override;
        }
        setTagTarifMap(map);
      } else {
        setTagTarifMap({});
      }
    }

    setEditingPrestations(true);
  }

  function togglePresta(pid: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }

  async function savePrestations() {
    if (!rdv) return;
    setSaving(true);
    const supabase = createSupabase();
    await supabase.from("rendez_vous_prestations").delete().eq("rendez_vous_id", id);
    if (selectedIds.size > 0) {
      await supabase.from("rendez_vous_prestations").insert([...selectedIds].map(pid => ({ rendez_vous_id: id, prestation_id: pid })));
    }
    const selected = allPrestations.filter(p => selectedIds.has(p.id));
    const tarifBase = selected.reduce((s, p) => s + p.tarif, 0);
    const tarifTags = selected.reduce((s, p) => s + (tagTarifMap[p.id] ?? p.tarif), 0);
    await supabase.from("rendez_vous").update({
      tarif: tarifTags < tarifBase ? tarifTags : tarifBase,
      duree_minutes: selected.reduce((s, p) => s + p.duree_minutes, 0),
    }).eq("id", id);
    setEditingPrestations(false);
    load();
    setSaving(false);
  }

  async function saveCapsules() {
    if (!rdv?.clients) return;
    setSavingCapsules(true);
    const supabase = createSupabase();
    await supabase.from("clients").update({
      champs_metier: { ...(rdv.clients.champs_metier || {}), mesures_capsules: capsules },
    }).eq("id", rdv.clients.id);
    setEditingCapsules(false);
    load();
    setSavingCapsules(false);
  }

  async function saveCagnotte() {
    if (!rdv?.clients) return;
    setSaving(true);
    const supabase = createSupabase();
    const oldAmount = rdv.montant_cagnotte_utilise || 0;
    const newAmount = cagnotteInput;
    const diff = newAmount - oldAmount;
    await supabase.from("rendez_vous").update({ montant_cagnotte_utilise: newAmount }).eq("id", id);
    if (diff !== 0) {
      await supabase.from("clients").update({ cagnotte: rdv.clients.cagnotte - diff }).eq("id", rdv.clients.id);
      await supabase.from("cagnotte_mouvements").insert({
        salon_id: salon!.id, client_id: rdv.clients.id,
        montant: Math.abs(diff), type: diff > 0 ? "utilisation" : "remboursement", reference_id: id,
      });
    }
    setEditingCagnotte(false);
    load();
    setSaving(false);
  }

  async function changeStatut(statut: string, montant?: number) {
    if (!rdv) return;
    setSaving(true);
    const supabase = createSupabase();
    const ancienStatut = rdv.statut;
    const updates: { statut: string; notes: string; tarif?: number } = { statut, notes };
    if (statut === "effectue" && montant != null) updates.tarif = montant;
    await supabase.from("rendez_vous").update(updates).eq("id", id);
    const client = rdv.clients;
    if (client) {
      const { data: settings } = await supabase.from("app_settings").select("nb_visites_fidelite, montant_recompense, montant_parrain, montant_filleul").eq("salon_id", salon!.id).single();
      if (statut === "effectue" && ancienStatut !== "effectue") {
        const nbVisites = client.nb_visites + 1;
        let cagnotte = client.cagnotte;
        await supabase.from("clients").update({ nb_visites: nbVisites }).eq("id", client.id);
        if (settings && nbVisites % settings.nb_visites_fidelite === 0) {
          cagnotte += settings.montant_recompense;
          await supabase.from("clients").update({ cagnotte }).eq("id", client.id);
          await supabase.from("cagnotte_mouvements").insert({ salon_id: salon!.id, client_id: client.id, montant: settings.montant_recompense, type: "recompense", reference_id: id });
          // Email récompense au client (fire-and-forget)
          const { data: { session } } = await supabase.auth.getSession();
          fetch("/api/fidelite/recompense", {
            method: "POST",
            headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ salon_id: salon!.id, client_id: client.id, montant: settings.montant_recompense }),
          });
        }


        const { data: clientFull } = await supabase.from("clients").select("parrain_id, parrainage_utilise, cagnotte").eq("id", client.id).single();
        if (clientFull && !clientFull.parrainage_utilise && clientFull.parrain_id && settings) {
          const { data: parrain } = await supabase.from("clients").select("cagnotte").eq("id", clientFull.parrain_id).single();
          if (parrain) {
            await Promise.all([
              supabase.from("clients").update({ cagnotte: clientFull.cagnotte + settings.montant_filleul, parrainage_utilise: true }).eq("id", client.id),
              supabase.from("clients").update({ cagnotte: parrain.cagnotte + settings.montant_parrain }).eq("id", clientFull.parrain_id),
              supabase.from("cagnotte_mouvements").insert([
                { salon_id: salon!.id, client_id: client.id, montant: settings.montant_filleul, type: "parrainage_filleul", reference_id: clientFull.parrain_id },
                { salon_id: salon!.id, client_id: clientFull.parrain_id, montant: settings.montant_parrain, type: "parrainage_parrain", reference_id: client.id },
              ]),
            ]);
          }
        }
      } else if (ancienStatut === "effectue" && statut !== "effectue") {
        await supabase.from("clients").update({ nb_visites: Math.max(0, client.nb_visites - 1) }).eq("id", client.id);
      }
    }
    load();
    setSaving(false);
  }

  async function saveDateHeure() {
    setSaving(true);
    await fetch("/api/rdv/deplacer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rdv_id: id, old_date_heure: rdv?.date_heure, new_date: newDate, new_heure: newHeure, notify: notifyClient && !!rdv?.clients?.email }),
    });
    setEditingDateHeure(false);
    load();
    setSaving(false);
  }

  async function saveNotes() {
    setSaving(true);
    const supabase = createSupabase();
    await supabase.from("rendez_vous").update({ notes }).eq("id", id);
    load();
    setSaving(false);
  }

  // Ouvre la saisie du montant avant de marquer effectué
  function demarrerEffectue() {
    if (!rdv) return;
    setMontantInput(rdv.tarif != null ? rdv.tarif : tarifTotal);
    setEditingMontant(true);
  }

  async function saveMontant() {
    if (!rdv) return;
    if (rdv.statut !== "effectue") {
      await changeStatut("effectue", montantInput);
    } else {
      setSaving(true);
      const supabase = createSupabase();
      await supabase.from("rendez_vous").update({ tarif: montantInput }).eq("id", id);
      await load();
      setSaving(false);
    }
    setEditingMontant(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    const supabase = createSupabase();
    await supabase.from("rendez_vous").delete().eq("id", id);
    router.push("/dashboard/agenda");
  }

  if (!salon || !rdv) return <div style={{ padding: 40, color: "#bbb" }}>Chargement...</div>;
  const m = METIERS[salon.metier];

  const tarifTotal = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.tarif || 0), 0);
  const dureeTotal = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0);
  const statutInfo = STATUTS.find(s => s.value === rdv.statut);
  const selectedPrests = allPrestations.filter(p => selectedIds.has(p.id));

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href={from === "dashboard" ? "/dashboard" : "/dashboard/agenda"} style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← {from === "dashboard" ? "Dashboard" : "Agenda"}</Link>
        <button onClick={handleDelete} style={{ background: "none", border: "1px solid #e74c3c", borderRadius: 7, padding: "5px 14px", fontSize: 13, color: "#e74c3c", cursor: "pointer" }}>Supprimer</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            {editingDateHeure ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 14 }} />
                  <select value={newHeure} onChange={e => setNewHeure(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 14 }}>
                    {Array.from({ length: 30 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                {rdv?.clients?.email && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555", cursor: "pointer" }}>
                    <input type="checkbox" checked={notifyClient} onChange={e => setNotifyClient(e.target.checked)} />
                    Prévenir le client par email
                  </label>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveDateHeure} disabled={saving} style={{ ...btnGhost, borderColor: m.couleur, color: m.couleur }}>{saving ? "..." : "Enregistrer"}</button>
                  <button onClick={() => setEditingDateHeure(false)} style={btnGhost}>Annuler</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 16, color: "#666" }}>{rdv.date_heure.slice(11, 16)}</span>
                  <button onClick={() => setEditingDateHeure(true)} style={btnGhost}>Déplacer</button>
                </div>
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: statutInfo?.color, background: `${statutInfo?.color}18`, padding: "4px 12px", borderRadius: 20, flexShrink: 0, marginLeft: 12 }}>
            {statutInfo?.label}
          </span>
        </div>

        {rdv.clients && (
          <Link href={`/dashboard/clients/${rdv.clients.id}?from=rdv&rdv_id=${rdv.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f9f9f9", borderRadius: 8, textDecoration: "none", color: "inherit", marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${m.couleur}20`, color: m.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
              {rdv.clients.prenom[0]}{rdv.clients.nom[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{rdv.clients.prenom} {rdv.clients.nom}</div>
              <div style={{ fontSize: 12, color: "#999" }}>Voir la fiche →</div>
            </div>
          </Link>
        )}

        {salon.metier === "manucure" && rdv.clients && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase" }}>Mesures capsules</div>
              {!editingCapsules
                ? <button onClick={() => setEditingCapsules(true)} style={btnGhost}>Modifier</button>
                : <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingCapsules(false)} style={btnGhost}>Annuler</button>
                    <button onClick={saveCapsules} disabled={savingCapsules} style={{ ...btnGhost, borderColor: m.couleur, color: m.couleur }}>{savingCapsules ? "..." : "Enregistrer"}</button>
                  </div>
              }
            </div>
            <CapsulesMesures value={capsules} onChange={setCapsules} editing={editingCapsules} couleur={m.couleur} />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase" }}>Prestations</div>
            {!editingPrestations
              ? <button onClick={startEditPrestations} style={btnGhost}>Modifier</button>
              : <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditingPrestations(false)} style={btnGhost}>Annuler</button>
                  <button onClick={savePrestations} disabled={saving || selectedIds.size === 0} style={{ ...btnGhost, borderColor: m.couleur, color: m.couleur }}>{saving ? "..." : "Enregistrer"}</button>
                </div>
            }
          </div>

          {editingPrestations ? (
            <div>
              {allCategories.length > 0 && (() => {
                const uncategorized = allPrestations.filter(p => !p.categorie_id);
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {allCategories.map(cat => {
                      const isActive = selectedCat === cat.id;
                      const count = [...selectedIds].filter(id => allPrestations.find(p => p.id === id && p.categorie_id === cat.id)).length;
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
                        style={{ padding: "5px 12px", border: `1.5px solid ${selectedCat === "__autres" ? m.couleur : "#e0e0e0"}`, borderRadius: 20, background: selectedCat === "__autres" ? m.couleur : "#fff", color: selectedCat === "__autres" ? "#fff" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Autres
                      </button>
                    )}
                  </div>
                );
              })()}
              <div style={{ border: "1px solid #e8e8e8", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                {(() => {
                  const uncategorized = allPrestations.filter(p => !p.categorie_id);
                  const activeCat = selectedCat ?? allCategories[0]?.id ?? null;
                  const visible = activeCat === "__autres" ? uncategorized : activeCat ? allPrestations.filter(p => p.categorie_id === activeCat) : allPrestations;
                  return visible.length === 0
                    ? <div style={{ padding: "14px 16px", fontSize: 13, color: "#bbb" }}>Aucune prestation</div>
                    : visible.map((p, i) => {
                        const sel = selectedIds.has(p.id);
                        return (
                          <div key={p.id} onClick={() => togglePresta(p.id)}
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: sel ? `${m.couleur}08` : "#fff", borderBottom: i < visible.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                            <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${sel ? m.couleur : "#d0d0d0"}`, background: sel ? m.couleur : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {sel && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ flex: 1, fontSize: 13, color: "#1a1a1a" }}>{p.nom}</span>
                            <span style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>{p.duree_minutes}min</span>
                            {tagTarifMap[p.id] !== undefined ? (
                              <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 36, textAlign: "right" }}>
                                <span style={{ color: "#e74c3c", textDecoration: "line-through", fontWeight: 400, fontSize: 11, marginRight: 4 }}>{p.tarif}€</span>
                                <span style={{ color: "#27ae60" }}>{tagTarifMap[p.id]}€</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 600, color: sel ? m.couleur : "#555", flexShrink: 0, minWidth: 36, textAlign: "right" }}>{p.tarif}€</span>
                            )}
                          </div>
                        );
                      });
                })()}
              </div>
              {selectedIds.size > 0 && (() => {
                const duree = selectedPrests.reduce((s, p) => s + p.duree_minutes, 0);
                const tarifBase = selectedPrests.reduce((s, p) => s + p.tarif, 0);
                const tarifTags = selectedPrests.reduce((s, p) => s + (tagTarifMap[p.id] ?? p.tarif), 0);
                const hasDiscount = tarifTags < tarifBase;
                return (
                  <div style={{ fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
                    Total : <b>{duree}min</b>,
                    {hasDiscount ? (
                      <>
                        <span style={{ textDecoration: "line-through", color: "#bbb" }}>{tarifBase}€</span>
                        <span style={{ fontWeight: 700, color: "#27ae60" }}>{tarifTags}€</span>
                        <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>Tarif préférentiel</span>
                      </>
                    ) : (
                      <b>{tarifBase}€</b>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {rdv.rendez_vous_prestations.map(rp => rp.prestations && (
                <div key={rp.prestation_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
                  <span>{rp.prestations.nom}</span>
                  {tagTarifMap[rp.prestation_id] !== undefined ? (
                    <span style={{ color: "#666" }}>
                      {rp.prestations.duree_minutes}min,{" "}
                      <span style={{ textDecoration: "line-through", color: "#bbb", marginRight: 4 }}>{rp.prestations.tarif}€</span>
                      <span style={{ color: "#27ae60", fontWeight: 700 }}>{tagTarifMap[rp.prestation_id]}€</span>
                    </span>
                  ) : (
                    <span style={{ color: "#666" }}>{rp.prestations.duree_minutes}min, {rp.prestations.tarif}€</span>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                <span>Total</span>
                <span>{dureeTotal}min, {(() => {
                  const tarif = rdv.tarif ?? tarifTotal;
                  const hasTagDiscount = rdv.tarif !== null && rdv.tarif < tarifTotal;
                  if (rdv.montant_cagnotte_utilise > 0) {
                    return <><span style={{ textDecoration: "line-through", color: "#aaa", marginRight: 6 }}>{hasTagDiscount ? <><span style={{ textDecoration: "line-through", color: "#bbb", fontSize: 12 }}>{tarifTotal}€ </span></> : null}{tarif}€</span>{(tarif - rdv.montant_cagnotte_utilise).toFixed(2)}€</>;
                  }
                  if (hasTagDiscount) {
                    return <><span style={{ textDecoration: "line-through", color: "#bbb", fontWeight: 400, fontSize: 13, marginRight: 4 }}>{tarifTotal}€</span><span style={{ color: "#27ae60" }}>{tarif}€</span></>;
                  }
                  return `${tarif}€`;
                })()}</span>
              </div>
              {discountTags.length > 0 && rdv.tarif !== null && rdv.tarif < tarifTotal && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>Tarif préférentiel via</span>
                  {discountTags.map(tag => (
                    <span key={tag.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${tag.couleur}18`, color: tag.couleur, border: `1px solid ${tag.couleur}44`, borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: tag.couleur, display: "inline-block" }} />
                      {tag.nom}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {rdv.clients && rdv.statut !== "annule" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase" }}>Cagnotte</div>
              {!editingCagnotte
                ? <button onClick={() => { setCagnotteInput(rdv.montant_cagnotte_utilise || 0); setEditingCagnotte(true); }} style={btnGhost}>Modifier</button>
                : <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingCagnotte(false)} style={btnGhost}>Annuler</button>
                    <button onClick={saveCagnotte} disabled={saving} style={{ ...btnGhost, borderColor: m.couleur, color: m.couleur }}>{saving ? "..." : "Enregistrer"}</button>
                  </div>
              }
            </div>
            <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: editingCagnotte ? 10 : 0, color: "#666" }}>
                <span>Solde disponible</span>
                <span style={{ fontWeight: 600, color: rdv.clients.cagnotte > 0 ? "#27ae60" : "#999" }}>
                  {(rdv.clients.cagnotte + (rdv.montant_cagnotte_utilise || 0)).toFixed(2)} €
                </span>
              </div>
              {editingCagnotte ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number" min={0}
                      max={Math.min(rdv.clients.cagnotte + (rdv.montant_cagnotte_utilise || 0), tarifTotal)}
                      step={0.5}
                      value={cagnotteInput}
                      onChange={e => setCagnotteInput(Math.min(Number(e.target.value), Math.min(rdv.clients!.cagnotte + (rdv.montant_cagnotte_utilise || 0), tarifTotal)))}
                      style={{ flex: 1, padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 13, color: "#999" }}>€ déduits</span>
                    <button onClick={() => setCagnotteInput(Math.min(rdv.clients!.cagnotte + (rdv.montant_cagnotte_utilise || 0), tarifTotal))} style={{ ...btnGhost, fontSize: 11 }}>Max</button>
                  </div>
                  {cagnotteInput > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      À payer : <b style={{ color: m.couleur }}>{(tarifTotal - cagnotteInput).toFixed(2)} €</b> (au lieu de {tarifTotal} €)
                    </div>
                  )}
                </div>
              ) : rdv.montant_cagnotte_utilise > 0 ? (
                <div style={{ marginTop: 6, fontSize: 13, color: m.couleur, fontWeight: 600 }}>
                  − {rdv.montant_cagnotte_utilise.toFixed(2)} € déduits
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>Aucune déduction</div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} onBlur={saveNotes} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>

        {/* Montant encaissé */}
        {(rdv.statut === "effectue" || editingMontant) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase" }}>Montant encaissé</div>
              {rdv.statut === "effectue" && !editingMontant && (
                <button onClick={() => { setMontantInput(rdv.tarif != null ? rdv.tarif : tarifTotal); setEditingMontant(true); }} style={btnGhost}>Modifier</button>
              )}
            </div>
            {editingMontant ? (
              <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Montant réellement facturé pour ce RDV. Pré-rempli avec le tarif des prestations, ajuste-le si besoin (sur devis, à partir de…).</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input type="number" min={0} step={0.5} value={montantInput} onChange={e => setMontantInput(Math.max(0, Number(e.target.value)))} style={{ flex: 1, minWidth: 100, padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 14 }} />
                  <span style={{ fontSize: 13, color: "#999" }}>€</span>
                  <button onClick={saveMontant} disabled={saving} style={{ padding: "8px 16px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "..." : rdv.statut === "effectue" ? "Enregistrer" : "Valider effectué"}
                  </button>
                  <button onClick={() => setEditingMontant(false)} style={btnGhost}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Chiffre d'affaires de ce rendez-vous</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#27ae60" }}>{(rdv.tarif != null ? rdv.tarif : tarifTotal).toFixed(2)} €</span>
              </div>
            )}
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Statut</div>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUTS.map(s => (
              <button key={s.value} onClick={() => s.value === "effectue" ? demarrerEffectue() : changeStatut(s.value)} disabled={saving || rdv.statut === s.value}
                style={{ flex: 1, padding: "9px", border: `2px solid ${rdv.statut === s.value ? s.color : "#e0e0e0"}`, borderRadius: 8, background: rdv.statut === s.value ? `${s.color}15` : "#fff", color: rdv.statut === s.value ? s.color : "#666", fontWeight: rdv.statut === s.value ? 700 : 400, fontSize: 13, cursor: saving || rdv.statut === s.value ? "default" : "pointer" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#666" };

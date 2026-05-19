"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number };
type RDV = {
  id: string; date_heure: string; statut: string; notes: string | null;
  montant_cagnotte_utilise: number; client_id: string;
  clients: { id: string; prenom: string; nom: string; nb_visites: number; cagnotte: number; email: string | null; champs_metier: Record<string, string> } | null;
  rendez_vous_prestations: { prestation_id: string; prestations: Prestation | null }[];
};

const STATUTS = [
  { value: "confirme", label: "Confirmé", color: "#2980b9" },
  { value: "termine", label: "Terminé", color: "#27ae60" },
  { value: "annule", label: "Annulé", color: "#e74c3c" },
];

export default function RDVDetailPage() {
  const salon = useSalon();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [rdv, setRdv] = useState<RDV | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  const [editingPrestations, setEditingPrestations] = useState(false);
  const [allPrestations, setAllPrestations] = useState<Prestation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [capsulesValue, setCapsulesValue] = useState("");
  const [editingCapsules, setEditingCapsules] = useState(false);
  const [savingCapsules, setSavingCapsules] = useState(false);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon, id]);

  async function load() {
    const supabase = createSupabase();
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, notes, montant_cagnotte_utilise, client_id, clients(id, prenom, nom, nb_visites, cagnotte, email, champs_metier), rendez_vous_prestations(prestation_id, prestations(id, nom, duree_minutes, tarif))")
      .eq("id", id)
      .single();
    if (!data) { router.push("/dashboard/agenda"); return; }
    setRdv(data as unknown as RDV);
    setNotes(data.notes || "");
    const client = (data as unknown as RDV).clients;
    if (client) setCapsulesValue(client.champs_metier?.mesures_capsules || "");
  }

  async function startEditPrestations() {
    const supabase = createSupabase();
    const { data } = await supabase.from("prestations").select("id, nom, duree_minutes, tarif").eq("salon_id", salon!.id).eq("actif", true).order("nom");
    setAllPrestations((data || []) as Prestation[]);
    setSelectedIds(new Set(rdv!.rendez_vous_prestations.map(rp => rp.prestation_id)));
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
    await supabase.from("rendez_vous").update({
      tarif: selected.reduce((s, p) => s + p.tarif, 0),
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
      champs_metier: { ...(rdv.clients.champs_metier || {}), mesures_capsules: capsulesValue },
    }).eq("id", rdv.clients.id);
    setEditingCapsules(false);
    load();
    setSavingCapsules(false);
  }

  async function changeStatut(statut: string) {
    if (!rdv) return;
    setSaving(true);
    const supabase = createSupabase();
    const ancienStatut = rdv.statut;
    await supabase.from("rendez_vous").update({ statut, notes }).eq("id", id);
    const client = rdv.clients;
    if (client) {
      const { data: settings } = await supabase.from("app_settings").select("nb_visites_fidelite, montant_recompense, montant_parrain, montant_filleul").eq("salon_id", salon!.id).single();
      if (statut === "termine" && ancienStatut !== "termine") {
        const nbVisites = client.nb_visites + 1;
        let cagnotte = client.cagnotte;
        await supabase.from("clients").update({ nb_visites: nbVisites }).eq("id", client.id);
        if (settings && nbVisites % settings.nb_visites_fidelite === 0) {
          cagnotte += settings.montant_recompense;
          await supabase.from("clients").update({ cagnotte }).eq("id", client.id);
          await supabase.from("cagnotte_mouvements").insert({ salon_id: salon!.id, client_id: client.id, montant: settings.montant_recompense, type: "recompense", reference_id: id });
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
      } else if (ancienStatut === "termine" && statut !== "termine") {
        await supabase.from("clients").update({ nb_visites: Math.max(0, client.nb_visites - 1) }).eq("id", client.id);
      }
    }
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
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/dashboard/agenda" style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← Agenda</Link>
        <button onClick={handleDelete} style={{ background: "none", border: "1px solid #e74c3c", borderRadius: 7, padding: "5px 14px", fontSize: 13, color: "#e74c3c", cursor: "pointer" }}>Supprimer</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: 16, color: "#666", marginTop: 4 }}>{rdv.date_heure.slice(11, 16)}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: statutInfo?.color, background: `${statutInfo?.color}18`, padding: "4px 12px", borderRadius: 20 }}>
            {statutInfo?.label}
          </span>
        </div>

        {rdv.clients && (
          <Link href={`/dashboard/clients/${rdv.clients.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f9f9f9", borderRadius: 8, textDecoration: "none", color: "inherit", marginBottom: 16 }}>
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
          <div style={{ padding: "12px 14px", background: `${m.couleur}08`, border: `1px solid ${m.couleur}20`, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingCapsules ? 8 : 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.couleur, textTransform: "uppercase", letterSpacing: 0.5 }}>Mesures capsules</div>
              {!editingCapsules
                ? <button onClick={() => setEditingCapsules(true)} style={btnGhost}>Modifier</button>
                : <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingCapsules(false)} style={btnGhost}>Annuler</button>
                    <button onClick={saveCapsules} disabled={savingCapsules} style={{ ...btnGhost, borderColor: m.couleur, color: m.couleur }}>{savingCapsules ? "..." : "Enregistrer"}</button>
                  </div>
              }
            </div>
            {editingCapsules
              ? <input value={capsulesValue} onChange={e => setCapsulesValue(e.target.value)} placeholder="Ex: G: 4/5/5/4/4 — D: 5/5/5/5/4" style={{ width: "100%", padding: "7px 10px", border: `1px solid ${m.couleur}40`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "#fff" }} />
              : <div style={{ fontSize: 13, color: capsulesValue ? "#333" : "#bbb" }}>{capsulesValue || "Aucune mesure enregistrée"}</div>
            }
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {allPrestations.map(p => {
                  const sel = selectedIds.has(p.id);
                  return (
                    <button key={p.id} onClick={() => togglePresta(p.id)} style={{ padding: "6px 12px", border: `2px solid ${sel ? m.couleur : "#e0e0e0"}`, borderRadius: 20, background: sel ? `${m.couleur}15` : "#fff", color: sel ? m.couleur : "#555", fontSize: 12, fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                      {p.nom} — {p.duree_minutes}min — {p.tarif}€
                    </button>
                  );
                })}
              </div>
              {selectedIds.size > 0 && (
                <div style={{ fontSize: 13, color: "#666" }}>Total : <b>{selectedPrests.reduce((s, p) => s + p.duree_minutes, 0)}min — {selectedPrests.reduce((s, p) => s + p.tarif, 0)}€</b></div>
              )}
            </div>
          ) : (
            <>
              {rdv.rendez_vous_prestations.map(rp => rp.prestations && (
                <div key={rp.prestation_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
                  <span>{rp.prestations.nom}</span>
                  <span style={{ color: "#666" }}>{rp.prestations.duree_minutes}min — {rp.prestations.tarif}€</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                <span>Total</span>
                <span>{dureeTotal}min — {rdv.montant_cagnotte_utilise > 0 ? <><span style={{ textDecoration: "line-through", color: "#aaa", marginRight: 6 }}>{tarifTotal}€</span>{(tarifTotal - rdv.montant_cagnotte_utilise).toFixed(2)}€</> : `${tarifTotal}€`}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} onBlur={saveNotes} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Statut</div>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUTS.map(s => (
              <button key={s.value} onClick={() => changeStatut(s.value)} disabled={saving || rdv.statut === s.value}
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

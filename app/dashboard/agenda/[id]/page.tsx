"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type RDV = { id: string; date_heure: string; statut: string; notes: string | null; montant_cagnotte_utilise: number; client_id: string; clients: { id: string; prenom: string; nom: string; nb_visites: number; cagnotte: number } | null; rendez_vous_prestations: { prestation_id: string; prestations: { id: string; nom: string; duree_minutes: number; tarif: number } | null }[] };

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

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon, id]);

  async function load() {
    const supabase = createSupabase();
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, notes, montant_cagnotte_utilise, client_id, clients(id, prenom, nom, nb_visites, cagnotte), rendez_vous_prestations(prestation_id, prestations(id, nom, duree_minutes, tarif))")
      .eq("id", id)
      .single();
    if (!data) { router.push("/dashboard/agenda"); return; }
    setRdv(data as unknown as RDV);
    setNotes(data.notes || "");
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
          <Link href={`/dashboard/clients/${rdv.clients.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f9f9f9", borderRadius: 8, textDecoration: "none", color: "inherit", marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${m.couleur}20`, color: m.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
              {rdv.clients.prenom[0]}{rdv.clients.nom[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{rdv.clients.prenom} {rdv.clients.nom}</div>
              <div style={{ fontSize: 12, color: "#999" }}>Voir la fiche →</div>
            </div>
          </Link>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 10, textTransform: "uppercase" }}>Prestations</div>
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
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} onBlur={saveNotes} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Statut</div>
          <div style={{ display: "flex", gap: 8 }}>
            {STATUTS.map(s => (
              <button
                key={s.value}
                onClick={() => changeStatut(s.value)}
                disabled={saving || rdv.statut === s.value}
                style={{ flex: 1, padding: "9px", border: `2px solid ${rdv.statut === s.value ? s.color : "#e0e0e0"}`, borderRadius: 8, background: rdv.statut === s.value ? `${s.color}15` : "#fff", color: rdv.statut === s.value ? s.color : "#666", fontWeight: rdv.statut === s.value ? 700 : 400, fontSize: 13, cursor: saving || rdv.statut === s.value ? "default" : "pointer" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

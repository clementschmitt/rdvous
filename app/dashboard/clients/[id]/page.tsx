"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CapsulesMesures, parseCapsules, type Capsules } from "@/app/components/CapsulesMesures";

type Client = {
  id: string; prenom: string; nom: string; telephone: string | null; email: string | null;
  date_naissance: string | null; adresse: string | null; code_postal: string | null; ville: string | null;
  notes: string | null; preferences: string | null; champs_metier: Record<string, string>;
  cagnotte: number; nb_visites: number; code_parrainage: string; parrain_id: string | null;
};
type RDV = { id: string; date_heure: string; statut: string; rendez_vous_prestations: { prestations: { nom: string; tarif: number } | null }[] };
type Settings = { nb_visites_fidelite: number; montant_recompense: number };
type Animal = {
  id: string; client_id: string; salon_id: string;
  nom: string; race: string | null; age: number | null; poids: number | null;
  comportement: string | null; notes: string | null;
};
type ClientTag = { id: string; nom: string; couleur: string };
type TagAssignment = { id: string; tag_id: string; client_tags: ClientTag };
type AnimalForm = { id?: string; nom: string; race: string; age: string; poids: string; comportement: string; notes: string };

const ANIMAL_FORM_DEFAULT: AnimalForm = { nom: "", race: "", age: "", poids: "", comportement: "", notes: "" };

export default function ClientDetailPage() {
  const salon = useSalon();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const fromRdv = searchParams.get("from") === "rdv";
  const rdvId = searchParams.get("rdv_id");
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [settings, setSettings] = useState<Settings>({ nb_visites_fidelite: 10, montant_recompense: 10 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [rdvPage, setRdvPage] = useState(0);

  const [animaux, setAnimaux] = useState<Animal[]>([]);
  const [animalForm, setAnimalForm] = useState<AnimalForm | null>(null);
  const [animalSaving, setAnimalSaving] = useState(false);

  const [ajustOpen, setAjustOpen] = useState(false);
  const [ajustMontant, setAjustMontant] = useState("");
  const [ajustSaving, setAjustSaving] = useState(false);
  const [ajustError, setAjustError] = useState("");

  const [fidOpen, setFidOpen] = useState(false);
  const [fidDelta, setFidDelta] = useState("");
  const [fidSaving, setFidSaving] = useState(false);

  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [allSalonTags, setAllSalonTags] = useState<ClientTag[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState<{ id: string; prenom: string; nom: string; telephone: string | null }[]>([]);
  const [mergeTarget, setMergeTarget] = useState<{ id: string; prenom: string; nom: string; telephone: string | null } | null>(null);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [fidError, setFidError] = useState("");

  const RDV_PER_PAGE = 10;

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon, id]);

  async function load() {
    const supabase = createSupabase();
    const queries = [
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("rendez_vous").select("id, date_heure, statut, rendez_vous_prestations(prestations(nom, tarif))").eq("client_id", id).order("date_heure", { ascending: false }),
      supabase.from("app_settings").select("nb_visites_fidelite, montant_recompense").eq("salon_id", salon!.id).single(),
    ];
    if (salon!.metier === "toilettage") {
      queries.push(supabase.from("animaux").select("*").eq("client_id", id).order("created_at"));
    }
    const [cRes, rdvRes, sRes, aRes] = await Promise.all(queries);
    if (!cRes.data) { router.push("/dashboard/clients"); return; }
    setClient(cRes.data as Client);
    setForm(cRes.data as Client);
    setRdvs((rdvRes.data || []) as unknown as RDV[]);
    if (sRes.data) setSettings(sRes.data as Settings);
    if (aRes) setAnimaux((aRes.data || []) as Animal[]);

    const [assignRes, allTagsRes] = await Promise.all([
      supabase.from("client_tag_assignments").select("id, tag_id, assigned_at, client_tags(id, nom, couleur)").eq("client_id", id).order("assigned_at"),
      supabase.from("client_tags").select("id, nom, couleur").eq("salon_id", salon!.id).order("created_at"),
    ]);
    setTagAssignments((assignRes.data || []) as unknown as TagAssignment[]);
    setAllSalonTags((allTagsRes.data || []) as ClientTag[]);
  }

  async function handleSave() {
    if (!client) return;
    setSaving(true);
    const supabase = createSupabase();
    const { error } = await supabase.from("clients").update({
      prenom: form.prenom, nom: form.nom, telephone: form.telephone || null, email: form.email || null,
      date_naissance: form.date_naissance || null, adresse: form.adresse || null,
      code_postal: form.code_postal || null, ville: form.ville || null,
      notes: form.notes || null, preferences: form.preferences || null,
      champs_metier: form.champs_metier || {},
    }).eq("id", id);
    if (!error) { setEditing(false); load(); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce·tte client·e ? Cette action est irréversible.")) return;
    const supabase = createSupabase();
    await supabase.from("clients").delete().eq("id", id);
    router.push("/dashboard/clients");
  }

  async function handleSaveAnimal() {
    if (!animalForm || !animalForm.nom.trim() || !salon) return;
    setAnimalSaving(true);
    const supabase = createSupabase();
    const payload = {
      client_id: id,
      salon_id: salon.id,
      nom: animalForm.nom.trim(),
      race: animalForm.race.trim() || null,
      age: animalForm.age ? parseFloat(animalForm.age) : null,
      poids: animalForm.poids ? parseFloat(animalForm.poids) : null,
      comportement: animalForm.comportement.trim() || null,
      notes: animalForm.notes.trim() || null,
    };
    if (animalForm.id) {
      await supabase.from("animaux").update(payload).eq("id", animalForm.id);
    } else {
      await supabase.from("animaux").insert(payload);
    }
    setAnimalForm(null);
    setAnimalSaving(false);
    load();
  }

  async function handleAjustCagnotte() {
    const montant = parseFloat(ajustMontant.replace(",", "."));
    if (isNaN(montant) || montant === 0) { setAjustError("Montant invalide."); return; }
    const nouveauSolde = (client!.cagnotte || 0) + montant;
    if (nouveauSolde < 0) { setAjustError("Le solde ne peut pas être négatif."); return; }
    setAjustSaving(true); setAjustError("");
    const supabase = createSupabase();
    await Promise.all([
      supabase.from("clients").update({ cagnotte: nouveauSolde }).eq("id", id),
      supabase.from("cagnotte_mouvements").insert({ salon_id: salon!.id, client_id: id, montant, type: "ajustement_manuel" }),
    ]);
    setAjustOpen(false); setAjustMontant(""); setAjustSaving(false);
    load();
  }

  async function handleAjustFidelite() {
    const delta = parseInt(fidDelta);
    if (isNaN(delta) || delta === 0) { setFidError("Nombre de visites invalide."); return; }
    const nouvVisites = Math.max(0, (client!.nb_visites || 0) + delta);
    setFidSaving(true); setFidError("");
    const supabase = createSupabase();
    await supabase.from("clients").update({ nb_visites: nouvVisites }).eq("id", id);
    setFidOpen(false); setFidDelta(""); setFidSaving(false);
    load();
  }

  async function handleMergeSearch(q: string) {
    setMergeSearch(q);
    if (q.length < 2) { setMergeResults([]); return; }
    const supabase = createSupabase();
    const { data } = await supabase
      .from("clients")
      .select("id, prenom, nom, telephone")
      .eq("salon_id", salon!.id)
      .neq("id", id)
      .or(`prenom.ilike.%${q}%,nom.ilike.%${q}%,telephone.ilike.%${q}%`)
      .limit(8);
    setMergeResults((data || []) as typeof mergeResults);
  }

  async function handleMerge() {
    if (!mergeTarget || !client) return;
    setMergeSaving(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/clients/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ client_a_id: id, client_b_id: mergeTarget.id, salon_id: salon!.id }),
    });
    const json = await res.json();
    if (json.ok) {
      setMergeOpen(false);
      setMergeSaving(false);
      router.push("/dashboard/clients?merged=1");
    } else {
      alert(json.error || "Erreur lors de la fusion");
      setMergeSaving(false);
    }
  }

  async function addTagAssignment(tagId: string) {
    const supabase = createSupabase();
    await supabase.from("client_tag_assignments").insert({ client_id: id, tag_id: tagId });
    setTagDropdownOpen(false);
    load();
  }

  async function removeTagAssignment(assignmentId: string) {
    const supabase = createSupabase();
    await supabase.from("client_tag_assignments").delete().eq("id", assignmentId);
    load();
  }

  async function handleDeleteAnimal(animalId: string, nom: string) {
    if (!confirm(`Supprimer ${nom} ? Cette action est irréversible.`)) return;
    const supabase = createSupabase();
    await supabase.from("animaux").delete().eq("id", animalId);
    load();
  }

  if (!salon || !client) return <div style={{ padding: 40, color: "#bbb" }}>Chargement...</div>;
  const m = METIERS[salon.metier];

  const progression = Math.min(client.nb_visites % settings.nb_visites_fidelite, settings.nb_visites_fidelite);
  const pct = Math.round((progression / settings.nb_visites_fidelite) * 100);

  const rdvsPage = rdvs.slice(rdvPage * RDV_PER_PAGE, (rdvPage + 1) * RDV_PER_PAGE);

  const STATUT_COLORS: Record<string, string> = { planifie: "#2980b9", effectue: "#27ae60", annule: "#e74c3c" };
  const STATUT_LABELS: Record<string, string> = { planifie: "Planifié", effectue: "Effectué", annule: "Annulé" };

  function set(field: keyof Client, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href={fromRdv && rdvId ? `/dashboard/agenda/${rdvId}` : "/dashboard/clients"} style={{ color: "#999", textDecoration: "none", fontSize: 13 }}>← {fromRdv ? "Rendez-vous" : m.labelClients}</Link>
        <div style={{ display: "flex", gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} style={btnGhost}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, background: m.couleur }}>{saving ? "..." : "Enregistrer"}</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={btnGhost}>Modifier</button>
              <button onClick={() => { setMergeOpen(true); setMergeSearch(""); setMergeResults([]); setMergeTarget(null); }} style={{ ...btnGhost, color: "#8b5cf6", borderColor: "#8b5cf6" }}>Fusionner</button>
              <button onClick={handleDelete} style={{ ...btnGhost, color: "#e74c3c", borderColor: "#e74c3c" }}>Supprimer</button>
            </>
          )}
        </div>
      </div>

      {(() => {
        const lastTag = tagAssignments.length > 0 ? tagAssignments[tagAssignments.length - 1].client_tags : null;
        const hasTags = tagAssignments.length > 0;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, padding: hasTags ? "16px 20px" : 0, background: lastTag ? `${lastTag.couleur}0e` : "transparent", border: lastTag ? `1px solid ${lastTag.couleur}30` : "none", borderRadius: hasTags ? 14 : 0, transition: "background 0.2s" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: lastTag ? `${lastTag.couleur}25` : `${m.couleur}20`, color: lastTag ? lastTag.couleur : m.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
              {client.prenom[0]}{client.nom[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{client.prenom} {client.nom}</h1>
                {tagAssignments.map(a => (
                  <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: `${a.client_tags.couleur}18`, border: `1px solid ${a.client_tags.couleur}60`, fontSize: 12, fontWeight: 700, color: a.client_tags.couleur }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.client_tags.couleur, display: "inline-block" }} />
                    {a.client_tags.nom}
                    <button onClick={() => removeTagAssignment(a.id)} style={{ background: "none", border: "none", color: a.client_tags.couleur, cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, opacity: 0.6 }}>✕</button>
                  </span>
                ))}
                {allSalonTags.length > 0 && (
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                      style={{ padding: "3px 10px", borderRadius: 20, border: `1px dashed ${m.couleur}80`, background: "none", color: m.couleur, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      + Tag
                    </button>
                    {tagDropdownOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 4px 14px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 160, padding: 6 }}>
                        {allSalonTags.filter(t => !tagAssignments.some(a => a.tag_id === t.id)).map(t => (
                          <button key={t.id} onClick={() => addTagAssignment(t.id)}
                            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.couleur, flexShrink: 0 }} />
                            {t.nom}
                          </button>
                        ))}
                        {allSalonTags.filter(t => !tagAssignments.some(a => a.tag_id === t.id)).length === 0 && (
                          <div style={{ fontSize: 12, color: "#bbb", padding: "6px 10px" }}>Tous les tags sont assignés</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>Code parrainage : <b>{client.code_parrainage}</b></div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: client.cagnotte > 0 ? `${m.couleur}12` : "#f9f9f9", border: `1px solid ${client.cagnotte > 0 ? m.couleur : "#e0e0e0"}`, borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>Cagnotte</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: client.cagnotte > 0 ? m.couleur : "#bbb" }}>{client.cagnotte.toFixed(2)} €</div>
            {!ajustOpen && (
              <button onClick={() => { setAjustOpen(true); setAjustMontant(""); setAjustError(""); }} style={{ fontSize: 11, fontWeight: 600, color: m.couleur, background: "none", border: `1px solid ${m.couleur}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                Ajuster
              </button>
            )}
          </div>
          {ajustOpen && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setAjustMontant(v => v.startsWith("-") ? v.slice(1) : (v ? v : ""))} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, background: ajustMontant && !ajustMontant.startsWith("-") ? "#e8f5e9" : "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", color: "#27ae60" }}>+</button>
                <button onClick={() => setAjustMontant(v => v.startsWith("-") ? v : (v ? `-${v}` : "-"))} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, background: ajustMontant.startsWith("-") ? "#fdecea" : "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", color: "#e74c3c" }}>−</button>
                <input
                  type="number" step="0.5" min="0"
                  value={ajustMontant.replace("-", "")}
                  onChange={e => setAjustMontant(ajustMontant.startsWith("-") ? `-${e.target.value}` : e.target.value)}
                  placeholder="0.00"
                  style={{ flex: 1, padding: "5px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13 }}
                />
                <span style={{ alignSelf: "center", fontSize: 13, color: "#888" }}>€</span>
              </div>
              {ajustError && <div style={{ fontSize: 12, color: "#e74c3c" }}>{ajustError}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setAjustOpen(false)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>Annuler</button>
                <button onClick={handleAjustCagnotte} disabled={ajustSaving || !ajustMontant || ajustMontant === "-"} style={{ ...btnPrimary, background: m.couleur, padding: "5px 12px", fontSize: 12, opacity: (!ajustMontant || ajustMontant === "-") ? 0.5 : 1 }}>
                  {ajustSaving ? "..." : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "#999" }}>Fidélité — {progression} / {settings.nb_visites_fidelite} visites</div>
            {!fidOpen && (
              <button onClick={() => { setFidOpen(true); setFidDelta(""); setFidError(""); }} style={{ fontSize: 11, fontWeight: 600, color: m.couleur, background: "none", border: `1px solid ${m.couleur}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                Ajuster
              </button>
            )}
          </div>
          <div style={{ height: 8, background: "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: m.couleur, borderRadius: 4, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Récompense à {settings.nb_visites_fidelite} visites : {settings.montant_recompense} €</div>
          {fidOpen && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => setFidDelta(v => v.startsWith("-") ? v.slice(1) : v)} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, background: fidDelta && !fidDelta.startsWith("-") ? "#e8f5e9" : "#f0f0f0", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", color: "#27ae60" }}>+</button>
                <button onClick={() => setFidDelta(v => v.startsWith("-") ? v : (v ? `-${v}` : "-"))} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, background: fidDelta.startsWith("-") ? "#fdecea" : "#f0f0f0", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", color: "#e74c3c" }}>−</button>
                <input
                  type="number" step="1" min="0"
                  value={fidDelta.replace("-", "")}
                  onChange={e => setFidDelta(fidDelta.startsWith("-") ? `-${e.target.value}` : e.target.value)}
                  placeholder="0"
                  style={{ flex: 1, padding: "5px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>visite(s)</span>
              </div>
              {fidError && <div style={{ fontSize: 12, color: "#e74c3c" }}>{fidError}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setFidOpen(false)} style={{ ...btnGhost, padding: "5px 10px", fontSize: 12 }}>Annuler</button>
                <button onClick={handleAjustFidelite} disabled={fidSaving || !fidDelta || fidDelta === "-"} style={{ ...btnPrimary, background: m.couleur, padding: "5px 12px", fontSize: 12, opacity: (!fidDelta || fidDelta === "-") ? 0.5 : 1 }}>
                  {fidSaving ? "..." : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Section titre="Identité">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Champ label="Prénom" value={form.prenom || ""} onChange={v => set("prenom", v)} editing={editing} />
          <Champ label="Nom" value={form.nom || ""} onChange={v => set("nom", v)} editing={editing} />
        </div>
        <Champ label="Téléphone" value={form.telephone || ""} onChange={v => set("telephone", v)} editing={editing} />
        <Champ label="Email" value={form.email || ""} onChange={v => set("email", v)} editing={editing} type="email" />
        <Champ label="Date de naissance" value={form.date_naissance || ""} onChange={v => set("date_naissance", v)} editing={editing} type="date" />
      </Section>

      <Section titre="Adresse" style={{ marginTop: 12 }}>
        <Champ label="Adresse" value={form.adresse || ""} onChange={v => set("adresse", v)} editing={editing} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <Champ label="Code postal" value={form.code_postal || ""} onChange={v => set("code_postal", v)} editing={editing} />
          <Champ label="Ville" value={form.ville || ""} onChange={v => set("ville", v)} editing={editing} />
        </div>
      </Section>

      {m.champsClient.length > 0 && (
        <Section titre="Informations métier" style={{ marginTop: 12 }}>
          {m.champsClient.map((champ: any) => {
            if (champ.key === "mesures_capsules") {
              const caps = parseCapsules(form.champs_metier?.[champ.key]);
              return (
                <div key={champ.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 8 }}>Mesures capsules</label>
                  <CapsulesMesures
                    value={caps}
                    onChange={v => setForm(prev => ({ ...prev, champs_metier: { ...(prev.champs_metier || {}), mesures_capsules: v as unknown as string } }))}
                    editing={editing}
                    couleur={m.couleur}
                  />
                </div>
              );
            }
            return (
              <Champ
                key={champ.key}
                label={champ.label}
                value={form.champs_metier?.[champ.key] || ""}
                onChange={v => setForm(prev => ({ ...prev, champs_metier: { ...(prev.champs_metier || {}), [champ.key]: v } }))}
                editing={editing}
                type={champ.type === "number" ? "number" : "text"}
              />
            );
          })}
        </Section>
      )}

      {salon.metier === "toilettage" && (
        <Section titre={`Animaux (${animaux.length})`} style={{ marginTop: 12 }}>
          {animaux.map(animal => (
            animalForm?.id === animal.id ? (
              <AnimalFormBlock
                key={animal.id}
                form={animalForm}
                onChange={setAnimalForm}
                onSave={handleSaveAnimal}
                onCancel={() => setAnimalForm(null)}
                saving={animalSaving}
                couleur={m.couleur}
              />
            ) : (
              <div key={animal.id} style={{ border: "1px solid #e8e8e8", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 24 }}>🐾</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>{animal.nom}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                    {animal.race && <span style={{ fontSize: 12, color: "#666" }}>Race : <b>{animal.race}</b></span>}
                    {animal.age != null && <span style={{ fontSize: 12, color: "#666" }}>Âge : <b>{animal.age} an{animal.age > 1 ? "s" : ""}</b></span>}
                    {animal.poids != null && <span style={{ fontSize: 12, color: "#666" }}>Poids : <b>{animal.poids} kg</b></span>}
                    {animal.comportement && <span style={{ fontSize: 12, color: "#666" }}>Comportement : <b>{animal.comportement}</b></span>}
                  </div>
                  {animal.notes && <div style={{ fontSize: 12, color: "#999", marginTop: 6, fontStyle: "italic" }}>{animal.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setAnimalForm({ id: animal.id, nom: animal.nom, race: animal.race || "", age: animal.age?.toString() || "", poids: animal.poids?.toString() || "", comportement: animal.comportement || "", notes: animal.notes || "" })}
                    style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}
                  >Modifier</button>
                  <button
                    onClick={() => handleDeleteAnimal(animal.id, animal.nom)}
                    style={{ ...btnGhost, padding: "4px 10px", fontSize: 12, color: "#e74c3c", borderColor: "#e74c3c" }}
                  >Supprimer</button>
                </div>
              </div>
            )
          ))}

          {animalForm && !animalForm.id ? (
            <AnimalFormBlock
              form={animalForm}
              onChange={setAnimalForm}
              onSave={handleSaveAnimal}
              onCancel={() => setAnimalForm(null)}
              saving={animalSaving}
              couleur={m.couleur}
            />
          ) : !animalForm && (
            <button
              onClick={() => setAnimalForm(ANIMAL_FORM_DEFAULT)}
              style={{ alignSelf: "flex-start", padding: "7px 14px", background: "none", border: `1px dashed ${m.couleur}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: m.couleur }}
            >+ Ajouter un animal</button>
          )}
        </Section>
      )}

      <Section titre="Notes & préférences" style={{ marginTop: 12 }}>
        <ChampTextarea label="Préférences" value={form.preferences || ""} onChange={v => set("preferences", v)} editing={editing} />
        <ChampTextarea label="Notes internes" value={form.notes || ""} onChange={v => set("notes", v)} editing={editing} />
      </Section>


      <Section titre={`Historique RDV (${rdvs.length})`} style={{ marginTop: 12 }}>
        {rdvs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#bbb" }}>Aucun rendez-vous</div>
        ) : (
          <>
            {rdvsPage.map(rdv => {
              const tarif = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.tarif || 0), 0);
              const prestNoms = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
              return (
                <Link key={rdv.id} href={`/dashboard/agenda/${rdv.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0", textDecoration: "none", color: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, width: 90, flexShrink: 0 }}>{new Date(rdv.date_heure).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</div>
                  <div style={{ flex: 1, fontSize: 13, color: "#555" }}>{prestNoms || "—"}</div>
                  {tarif > 0 && <div style={{ fontSize: 13, fontWeight: 600 }}>{tarif} €</div>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUT_COLORS[rdv.statut] || "#999", background: `${STATUT_COLORS[rdv.statut]}18`, padding: "2px 8px", borderRadius: 10 }}>{STATUT_LABELS[rdv.statut] || rdv.statut}</span>
                </Link>
              );
            })}
            {rdvs.length > RDV_PER_PAGE && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setRdvPage(p => Math.max(0, p - 1))} disabled={rdvPage === 0} style={btnGhost}>‹ Préc</button>
                <button onClick={() => setRdvPage(p => p + 1)} disabled={(rdvPage + 1) * RDV_PER_PAGE >= rdvs.length} style={btnGhost}>Suiv ›</button>
              </div>
            )}
          </>
        )}
      </Section>

      {mergeOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, maxWidth: "92vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Fusionner la fiche</div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 18 }}>Les RDVs et la cagnotte seront regroupés sur la fiche ayant le RDV le plus ancien. L&apos;autre sera supprimée définitivement.</div>

            {!mergeTarget ? (
              <>
                <input
                  autoFocus
                  value={mergeSearch}
                  onChange={e => handleMergeSearch(e.target.value)}
                  placeholder="Rechercher une cliente par nom ou téléphone..."
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", marginBottom: 10 }}
                />
                {mergeResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                    {mergeResults.map(r => (
                      <button key={r.id} onClick={() => setMergeTarget(r)} style={{ textAlign: "left", padding: "10px 12px", border: "1px solid #e0e0e0", borderRadius: 8, background: "#f9f9f9", cursor: "pointer", fontSize: 13, width: "100%" }}>
                        <span style={{ fontWeight: 600 }}>{r.prenom} {r.nom}</span>
                        {r.telephone && <span style={{ color: "#999", marginLeft: 8, fontSize: 12 }}>{r.telephone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {mergeSearch.length >= 2 && mergeResults.length === 0 && (
                  <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "12px 0" }}>Aucun résultat</div>
                )}
              </>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "stretch" }}>
                  <div style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid #e0e0e0", background: "#f9f9f9" }}>
                    <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fiche A</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{client!.prenom} {client!.nom}</div>
                    {client!.telephone && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{client!.telephone}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 20, color: "#8b5cf6", flexShrink: 0 }}>⟷</div>
                  <div style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid #e0e0e0", background: "#f9f9f9" }}>
                    <div style={{ fontSize: 11, color: "#999", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fiche B</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{mergeTarget.prenom} {mergeTarget.nom}</div>
                    {mergeTarget.telephone && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{mergeTarget.telephone}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#c0392b", padding: "8px 12px", background: "#fdecea", borderRadius: 8 }}>
                  La fiche avec le RDV le plus ancien sera conservée. L&apos;autre disparaîtra.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              {mergeTarget && <button onClick={() => setMergeTarget(null)} style={{ ...btnGhost, fontSize: 12 }}>← Retour</button>}
              <button onClick={() => setMergeOpen(false)} style={{ ...btnGhost, fontSize: 12 }}>Annuler</button>
              {mergeTarget && (
                <button onClick={handleMerge} disabled={mergeSaving} style={{ ...btnPrimary, background: "#8b5cf6", fontSize: 12 }}>
                  {mergeSaving ? "Fusion en cours..." : "Confirmer la fusion"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimalFormBlock({ form, onChange, onSave, onCancel, saving, couleur }: {
  form: AnimalForm; onChange: (f: AnimalForm) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; couleur: string;
}) {
  const inp: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
  return (
    <div style={{ border: `1px solid ${couleur}40`, borderRadius: 8, padding: "14px 16px", background: `${couleur}06` }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: couleur, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{form.id ? "Modifier l'animal" : "Nouvel animal"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Nom *</label>
          <input style={inp} value={form.nom} onChange={e => onChange({ ...form, nom: e.target.value })} placeholder="Ex: Rex" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Race</label>
          <input style={inp} value={form.race} onChange={e => onChange({ ...form, race: e.target.value })} placeholder="Ex: Golden Retriever" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Âge (ans)</label>
          <input style={inp} type="number" min="0" step="0.5" value={form.age} onChange={e => onChange({ ...form, age: e.target.value })} placeholder="Ex: 3" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Poids (kg)</label>
          <input style={inp} type="number" min="0" step="0.1" value={form.poids} onChange={e => onChange({ ...form, poids: e.target.value })} placeholder="Ex: 12.5" />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Comportement</label>
        <input style={inp} value={form.comportement} onChange={e => onChange({ ...form, comportement: e.target.value })} placeholder="Ex: Calme, craintif, mordeur..." />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4 }}>Notes</label>
        <textarea rows={2} style={{ ...inp, resize: "vertical" }} value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} placeholder="Allergies, traitements, habitudes..." />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={btnGhost}>Annuler</button>
        <button onClick={onSave} disabled={saving || !form.nom.trim()} style={{ ...btnPrimary, background: couleur, opacity: !form.nom.trim() ? 0.5 : 1 }}>{saving ? "..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

function Section({ titre, children, style }: { titre: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", ...style }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Champ({ label, value, onChange, editing, type = "text" }: { label: string; value: string; onChange: (v: string) => void; editing: boolean; type?: string }) {
  const display = type === "date" && value ? formatDateFR(value) : (value || "—");
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 4 }}>{label}</label>
      {editing
        ? <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
        : <div style={{ fontSize: 13, color: value ? "#222" : "#ccc" }}>{display}</div>
      }
    </div>
  );
}

function ChampTextarea({ label, value, onChange, editing }: { label: string; value: string; onChange: (v: string) => void; editing: boolean }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 4 }}>{label}</label>
      {editing
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        : <div style={{ fontSize: 13, color: value ? "#222" : "#ccc", whiteSpace: "pre-wrap" }}>{value || "—"}</div>
      }
    </div>
  );
}

const btnGhost: React.CSSProperties = { padding: "7px 14px", background: "none", border: "1px solid #ddd", borderRadius: 7, fontSize: 13, cursor: "pointer", color: "#555" };
const btnPrimary: React.CSSProperties = { padding: "7px 14px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" };

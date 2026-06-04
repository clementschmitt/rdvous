"use client";
import { useEffect, useRef, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { PLAN_LABELS, PLAN_PRICES, type Plan } from "@/lib/plan";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; sur_devis: boolean; categorie_id: string | null };
type Category = { id: string; nom: string; ordre: number; selection_type: "unique" | "multiple" | "libre" };
type Settings = { delai_relance_mois: number; message_relance: string; email_expediteur: string; email_expediteur_nom: string; email_reception: string; email_confirmation_active: boolean; email_confirmation_objet: string; message_confirmation: string; email_rappel_active: boolean; email_rappel_objet: string; message_rappel_rdv: string; email_relance_objet: string; nb_visites_fidelite: number; montant_recompense: number; tarif_minimum: number; montant_parrain: number; montant_filleul: number; prestations_label: string; google_avis_url: string; google_note: number; google_nb_avis: number; google_place_id: string; sms_active: boolean; sms_expediteur: string; sms_message_confirmation: string; sms_message_rappel: string; delai_min_reservation_heures: number };
type Plage = { id?: string; heure_debut: string; heure_fin: string };
type JourDispo = { actif: boolean; plages: Plage[] };
type Conge = { id?: string; date_debut: string; date_fin: string; libelle: string };
type Tab = "prestations" | "dispos" | "emails" | "fidelite" | "compte";

const TABS: { key: Tab; label: string }[] = [
  { key: "prestations", label: "Prestations" },
  { key: "dispos", label: "Disponibilités" },
  { key: "emails", label: "Emails & SMS" },
  { key: "fidelite", label: "Fidélité" },
  { key: "compte", label: "Compte" },
];

export default function ParametresPage() {
  const salon = useSalon();
  const [tab, setTab] = useState<Tab>("prestations");
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [settings, setSettings] = useState<Settings>({ delai_relance_mois: 2, message_relance: "Bonjour {prenom}, cela fait un moment que nous ne vous avons pas vu !", email_expediteur: "", email_expediteur_nom: "rdvous", email_reception: "", email_confirmation_active: true, email_confirmation_objet: "Confirmation de votre rendez-vous", message_confirmation: "Bonjour {prenom}, votre rendez-vous du {date} à {heure} est confirmé. À bientôt !", email_rappel_active: true, email_rappel_objet: "Rappel : votre rendez-vous demain", message_rappel_rdv: "Bonjour {prenom}, nous vous rappelons votre rendez-vous demain {date} à {heure}. À demain !", email_relance_objet: "On pense à vous !", nb_visites_fidelite: 10, montant_recompense: 10, tarif_minimum: 0, montant_parrain: 5, montant_filleul: 5, prestations_label: "Prestations", google_avis_url: "", google_note: 0, google_nb_avis: 0, google_place_id: "", sms_active: false, sms_expediteur: "rdvous", sms_message_confirmation: "", sms_message_rappel: "", delai_min_reservation_heures: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategorie, setNewCategorie] = useState("");
  const [editCategorieId, setEditCategorieId] = useState<string | null>(null);
  const [editCategorieNom, setEditCategorieNom] = useState("");
  const [newPresta, setNewPresta] = useState({ nom: "", duree_minutes: "60", tarif: "0", sur_devis: false, categorie_id: "" });
  const [editPrestaId, setEditPrestaId] = useState<string | null>(null);
  const [editPresta, setEditPresta] = useState<Prestation | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const defaultPlage = (): Plage => ({ heure_debut: "09:00", heure_fin: "18:00" });
  const [dispos, setDispos] = useState<JourDispo[]>(JOURS.map(() => ({ actif: false, plages: [defaultPlage()] })));
  const [conges, setConges] = useState<Conge[]>([]);
  const [newConge, setNewConge] = useState<Conge>({ date_debut: "", date_fin: "", libelle: "" });
  const [savingDispos, setSavingDispos] = useState(false);
  const [savedDispos, setSavedDispos] = useState(false);
  type Exception = { id: string; date: string; ferme: boolean; plages: Plage[]; type?: string };
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [newException, setNewException] = useState<{ date: string; ferme: boolean; plages: Plage[] }>({ date: "", ferme: true, plages: [defaultPlage()] });
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const exceptionFormRef = useRef<HTMLDivElement>(null);
  const [exceptionMode, setExceptionMode] = useState<"single" | "period">("single");
  type PeriodJour = { actif: boolean; heure_debut: string; heure_fin: string };
  const [newPeriod, setNewPeriod] = useState<{ date_debut: string; date_fin: string; commonDebut: string; commonFin: string; jours: PeriodJour[] }>({
    date_debut: "", date_fin: "", commonDebut: "09:00", commonFin: "18:00",
    jours: [true, true, true, true, true, true, false].map(actif => ({ actif, heure_debut: "09:00", heure_fin: "18:00" }))
  });

  const [slug, setSlug] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [visibleRecherche, setVisibleRecherche] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [deplacement, setDeplacement] = useState<"non" | "possible" | "uniquement">("non");
  const [deplacementSaving, setDeplacementSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleSyncMsg, setGoogleSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon]);

  async function load() {
    const supabase = createSupabase();
    const [pRes, sRes, dRes, cRes, eRes, catRes] = await Promise.all([
      supabase.from("prestations").select("*").eq("salon_id", salon!.id).order("nom"),
      supabase.from("app_settings").select("*").eq("salon_id", salon!.id).single(),
      supabase.from("disponibilites").select("*").eq("salon_id", salon!.id).order("jour_semaine"),
      supabase.from("conges").select("*").eq("salon_id", salon!.id).order("date_debut"),
      supabase.from("disponibilites_exceptions").select("*").eq("salon_id", salon!.id).gte("date", (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })()).order("date"),
      supabase.from("prestation_categories").select("*").eq("salon_id", salon!.id).order("ordre"),
    ]);
    setPrestations((pRes.data || []) as Prestation[]);
    setCategories((catRes.data || []) as Category[]);
    if (sRes.data) setSettings(prev => ({
      ...prev,
      ...Object.fromEntries(Object.entries(sRes.data as Record<string, unknown>).map(([k, v]) => [k, v ?? prev[k as keyof Settings]])),
    }));
    if (dRes.data && dRes.data.length > 0) {
      const newDispos: JourDispo[] = JOURS.map((_, i) => {
        const plages = (dRes.data as { jour_semaine: number; heure_debut: string; heure_fin: string; id: string }[])
          .filter(d => d.jour_semaine === i)
          .map(d => ({ id: d.id, heure_debut: d.heure_debut.slice(0, 5), heure_fin: d.heure_fin.slice(0, 5) }));
        return { actif: plages.length > 0, plages: plages.length > 0 ? plages : [defaultPlage()] };
      });
      setDispos(newDispos);
    }
    setConges(((cRes.data || []) as { id: string; date_debut: string; date_fin: string; libelle: string }[]).map(c => ({ id: c.id, date_debut: c.date_debut, date_fin: c.date_fin, libelle: c.libelle || "" })));
    setExceptions(((eRes.data || []) as { id: string; date: string; ferme: boolean; plages: Plage[] }[]));

    const { data: salonData } = await supabase.from("salons").select("slug, photos, deplacement, visible_recherche").eq("id", salon!.id).single();
    if (salonData) {
      setSlug(salonData.slug || "");
      setPhotos(salonData.photos || []);
      setDeplacement(salonData.deplacement || "non");
      setVisibleRecherche(salonData.visible_recherche ?? true);
    }
  }

  async function addCategorie() {
    if (!newCategorie.trim()) return;
    const supabase = createSupabase();
    await supabase.from("prestation_categories").insert({ salon_id: salon!.id, nom: newCategorie.trim(), ordre: categories.length });
    setNewCategorie("");
    load();
  }

  async function saveEditCategorie(id: string) {
    if (!editCategorieNom.trim()) return;
    const supabase = createSupabase();
    await supabase.from("prestation_categories").update({ nom: editCategorieNom.trim() }).eq("id", id);
    setEditCategorieId(null);
    load();
  }

  async function toggleCategorieSelection(id: string, current: string) {
    const cycle: Record<string, "unique" | "multiple" | "libre"> = { libre: "unique", unique: "multiple", multiple: "libre" };
    const next = cycle[current] || "libre";
    const supabase = createSupabase();
    await supabase.from("prestation_categories").update({ selection_type: next }).eq("id", id);
    setCategories(cats => cats.map(c => c.id === id ? { ...c, selection_type: next } : c));
  }

  async function deleteCategorie(id: string) {
    if (!confirm("Supprimer cette catégorie ? Les prestations associées ne seront pas supprimées.")) return;
    const supabase = createSupabase();
    await supabase.from("prestation_categories").delete().eq("id", id);
    load();
  }

  async function addPresta() {
    if (!newPresta.nom.trim()) return;
    const supabase = createSupabase();
    await supabase.from("prestations").insert({ salon_id: salon!.id, nom: newPresta.nom, duree_minutes: Number(newPresta.duree_minutes), tarif: Number(newPresta.tarif), sur_devis: newPresta.sur_devis, categorie_id: newPresta.categorie_id || null });
    setNewPresta({ nom: "", duree_minutes: "60", tarif: "0", sur_devis: false, categorie_id: "" });
    load();
  }

  async function deletePresta(id: string) {
    if (!confirm("Supprimer cette prestation ?")) return;
    const supabase = createSupabase();
    await supabase.from("prestations").delete().eq("id", id);
    load();
  }

  async function saveEditPresta() {
    if (!editPresta) return;
    const supabase = createSupabase();
    await supabase.from("prestations").update({ nom: editPresta.nom, duree_minutes: editPresta.duree_minutes, tarif: editPresta.tarif, sur_devis: editPresta.sur_devis, categorie_id: editPresta.categorie_id || null }).eq("id", editPresta.id);
    setEditPrestaId(null);
    load();
  }

  async function saveDispos() {
    setSavingDispos(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const rows = dispos.flatMap((jour, i) =>
      jour.actif ? jour.plages.map(p => ({ jour_semaine: i, heure_debut: p.heure_debut, heure_fin: p.heure_fin })) : []
    );
    const res = await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "save_dispos", rows }),
    });
    const json = await res.json();
    if (!json.ok) { alert("Erreur : " + (json.error || "inconnue")); setSavingDispos(false); return; }
    await load();
    setSavingDispos(false);
    setSavedDispos(true);
    setTimeout(() => setSavedDispos(false), 2000);
  }

  async function addConge() {
    if (!newConge.date_debut || !newConge.date_fin) return;
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "add_conge", ...newConge }),
    });
    const json = await res.json();
    if (!json.ok) { alert("Erreur : " + (json.error || "inconnue")); return; }
    setNewConge({ date_debut: "", date_fin: "", libelle: "" });
    load();
  }

  async function deleteConge(id: string) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "delete_conge", id }),
    });
    load();
  }

  function getPeriodPreview() {
    if (!newPeriod.date_debut || !newPeriod.date_fin) return 0;
    const start = new Date(newPeriod.date_debut + "T12:00:00");
    const end = new Date(newPeriod.date_fin + "T12:00:00");
    let count = 0;
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (newPeriod.jours[(d.getDay() + 6) % 7].actif) count++;
    }
    return count;
  }

  async function addPeriod() {
    if (!newPeriod.date_debut || !newPeriod.date_fin) return;
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const exceptions: { date: string; ferme: boolean; plages: Plage[] }[] = [];
    const start = new Date(newPeriod.date_debut + "T12:00:00");
    const end = new Date(newPeriod.date_fin + "T12:00:00");
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const jour = newPeriod.jours[(d.getDay() + 6) % 7];
      if (jour.actif) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        exceptions.push({ date: dateStr, ferme: false, plages: [{ heure_debut: jour.heure_debut, heure_fin: jour.heure_fin }] });
      }
    }
    if (exceptions.length === 0) return;
    const res = await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "upsert_exceptions_bulk", exceptions }),
    });
    const json = await res.json();
    if (!json.ok) { alert("Erreur : " + json.error); return; }
    setNewPeriod({ date_debut: "", date_fin: "", commonDebut: "09:00", commonFin: "18:00", jours: [true, true, true, true, true, true, false].map(actif => ({ actif, heure_debut: "09:00", heure_fin: "18:00" })) });
    setExceptionMode("single");
    load();
  }

  function startEditException(ex: Exception) {
    const plages = Array.isArray(ex.plages) && ex.plages.length > 0 ? ex.plages : [defaultPlage()];
    setNewException({ date: ex.date, ferme: ex.ferme, plages });
    setEditingExceptionId(ex.id);
    setExceptionMode("single");
    setTimeout(() => exceptionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function cancelEditException() {
    setNewException({ date: "", ferme: true, plages: [defaultPlage()] });
    setEditingExceptionId(null);
  }

  async function addException() {
    if (!newException.date) return;
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "upsert_exception", date: newException.date, ferme: newException.ferme, plages: newException.ferme ? [] : newException.plages }),
    });
    const json = await res.json();
    if (!json.ok) { alert("Erreur : " + json.error); return; }
    setNewException({ date: "", ferme: true, plages: [defaultPlage()] });
    setEditingExceptionId(null);
    load();
  }

  async function deleteException(id: string) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, action: "delete_exception", id }),
    });
    load();
  }

  async function saveSlug() {
    setSlugSaving(true);
    setSlugMsg(null);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/salon/update", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, slug }),
    });
    const json = await res.json();
    setSlugSaving(false);
    if (!json.ok) { setSlugMsg({ ok: false, text: json.error || "Erreur" }); return; }
    setSlug(json.slug || slug);
    setSlugMsg({ ok: true, text: "URL mise à jour !" });
    setTimeout(() => setSlugMsg(null), 3000);
  }

  async function toggleVisibilite() {
    const next = !visibleRecherche;
    setVisibleRecherche(next);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/salon/update", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, visible_recherche: next }),
    });
  }

  async function saveDeplacement(val: "non" | "possible" | "uniquement") {
    setDeplacement(val);
    setDeplacementSaving(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/salon/update", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, deplacement: val }),
    });
    setDeplacementSaving(false);
  }

  async function uploadPhoto(file: File) {
    setPhotoUploading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("salon_id", salon!.id);
    const res = await fetch("/api/salon/upload-photo", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}` },
      body: fd,
    });
    const json = await res.json();
    if (!json.ok) { alert("Erreur upload : " + json.error); setPhotoUploading(false); return; }
    const newPhotos = [...photos, json.url];
    setPhotos(newPhotos);
    await fetch("/api/salon/update", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, photos: newPhotos }),
    });
    setPhotoUploading(false);
  }

  async function deletePhoto(url: string) {
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const newPhotos = photos.filter(p => p !== url);
    setPhotos(newPhotos);
    await fetch("/api/salon/update", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, photos: newPhotos }),
    });
  }

  async function startCheckout() {
    setBillingLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ interval: billingInterval, salon_id: salon!.id }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setBillingLoading(false);
  }

  async function openPortal() {
    setBillingLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}` },
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setBillingLoading(false);
  }

  async function changePassword() {
    if (newPassword.length < 6) { setPwdMessage({ ok: false, text: "6 caractères minimum." }); return; }
    if (newPassword !== confirmPassword) { setPwdMessage({ ok: false, text: "Les mots de passe ne correspondent pas." }); return; }
    setPwdLoading(true);
    setPwdMessage(null);
    const supabase = createSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMessage({ ok: false, text: error.message });
    } else {
      setPwdMessage({ ok: true, text: "Mot de passe mis à jour." });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwdLoading(false);
  }

  async function syncGoogle() {
    if (!settings.google_place_id?.trim()) { setGoogleSyncMsg({ ok: false, text: "Entrez un Place ID." }); return; }
    setGoogleSyncing(true);
    setGoogleSyncMsg(null);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/google-business/sync", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, place_id: settings.google_place_id }),
    });
    const json = await res.json();
    setGoogleSyncing(false);
    if (!json.ok) { setGoogleSyncMsg({ ok: false, text: json.error || "Erreur inconnue" }); return; }
    setSettings(s => ({ ...s, google_note: json.note ?? s.google_note, google_nb_avis: json.nb_avis ?? s.google_nb_avis }));
    setGoogleSyncMsg({ ok: true, text: `${String(json.note).replace(".", ",")} · ${json.nb_avis} avis` });
  }

  async function triggerCheckout() {
    const supabase = createSupabase();
    const { data: { session: sess } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${sess?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ interval: "monthly", salon_id: salon!.id }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function saveSection(key: string) {
    setSaving(s => ({ ...s, [key]: true }));
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, salon_id: salon!.id }),
    });
    const json = await res.json();
    setSaving(s => ({ ...s, [key]: false }));
    if (!json.ok) { alert("Erreur : " + (json.error || "inconnue")); return; }
    setSaved(s => ({ ...s, [key]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];
  const plan = (salon.plan || "free") as Plan;
  const isFree = plan === "free";

  return (
    <div className="params-wrap" style={{ padding: 32, maxWidth: 760, margin: "0 auto", overflowX: "hidden" }}>
      <style>{`
        @media (max-width: 640px) {
          .params-wrap { padding: 16px !important; }
          .params-grid-2 { grid-template-columns: 1fr !important; }
          .params-abo { flex-direction: column !important; align-items: flex-start !important; }
          .params-tabs { display: none !important; }
          .params-select { display: block !important; }
        }
      `}</style>

      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700 }}>Paramètres</h1>

      {/* Onglets — desktop */}
      <div className="params-tabs" style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.key} className="params-tab" onClick={() => setTab(t.key)}
            style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", background: tab === t.key ? m.couleur : "#f0f0f0", color: tab === t.key ? "#fff" : "#666", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Onglets — mobile select */}
      <select className="params-select" value={tab} onChange={e => setTab(e.target.value as Tab)}
        style={{ display: "none", width: "100%", padding: "10px 14px", marginBottom: 20, border: `1px solid ${m.couleurClaire}`, borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#fff", color: "#1a1a1a", cursor: "pointer" }}>
        {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>

      {/* ── Prestations ── */}
      {tab === "prestations" && (
        <>
        {/* Titre vitrine */}
        <Section titre="Affichage vitrine">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Titre de la section</label>
              <input value={settings.prestations_label} onChange={e => setSettings(s => ({ ...s, prestations_label: e.target.value }))} placeholder="Prestations" style={{ ...miniInput, width: "100%", boxSizing: "border-box" }} />
            </div>
            <SaveButton sectionKey="prestations_label" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
          </div>
        </Section>

        {/* Google Business */}
        <Section titre="Google Business" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#888" }}>
            Synchronisez votre note Google automatiquement.{" "}
            <a href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder" target="_blank" rel="noopener noreferrer" style={{ color: m.couleur }}>Trouver mon Place ID →</a>
          </div>
          <div>
            <label style={labelStyle}>Google Place ID</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={settings.google_place_id} onChange={e => setSettings(s => ({ ...s, google_place_id: e.target.value.trim() }))} placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4" style={{ flex: 1, ...miniInput }} />
              <button onClick={syncGoogle} disabled={googleSyncing}
                style={{ padding: "7px 14px", background: googleSyncing ? "#e0e0e0" : m.couleur, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: googleSyncing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {googleSyncing ? "…" : "↻ Sync"}
              </button>
            </div>
            {googleSyncMsg && (
              <div style={{ fontSize: 12, marginTop: 6, color: googleSyncMsg.ok ? "#27ae60" : "#e74c3c", fontWeight: 500 }}>
                {googleSyncMsg.ok ? `✓ ${googleSyncMsg.text}` : `✗ ${googleSyncMsg.text}`}
              </div>
            )}
            {!googleSyncMsg && settings.google_note > 0 && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                Dernière synchro : ★ {String(settings.google_note).replace(".", ",")} · {settings.google_nb_avis} avis
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Lien vers les avis Google</label>
            <input type="url" value={settings.google_avis_url} onChange={e => setSettings(s => ({ ...s, google_avis_url: e.target.value }))} placeholder="https://g.page/r/..." style={{ ...miniInput, width: "100%", boxSizing: "border-box" }} />
          </div>
          <SaveButton sectionKey="google_business" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
        </Section>

        {/* Catégories */}
        <Section titre="Catégories" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {categories.length === 0 && <div style={{ fontSize: 13, color: "#bbb" }}>Aucune catégorie.</div>}
            {categories.map(cat => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "#f9f9f9", borderRadius: 8 }}>
                {editCategorieId === cat.id ? (
                  <>
                    <input value={editCategorieNom} onChange={e => setEditCategorieNom(e.target.value)} style={{ flex: 1, ...miniInput }} autoFocus />
                    <button onClick={() => saveEditCategorie(cat.id)} style={btnSmall(m.couleur)}>✓</button>
                    <button onClick={() => setEditCategorieId(null)} style={btnSmallGhost}>✕</button>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{cat.nom}</span>
                      <span style={{ fontSize: 11, color: "#bbb", whiteSpace: "nowrap" }}>{prestations.filter(p => p.categorie_id === cat.id).length} presta.</span>
                      <button onClick={() => toggleCategorieSelection(cat.id, cat.selection_type || "libre")}
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, border: `1px solid ${cat.selection_type === "libre" || !cat.selection_type ? "#ddd" : m.couleur}`, color: cat.selection_type === "libre" || !cat.selection_type ? "#aaa" : "#fff", background: cat.selection_type === "libre" || !cat.selection_type ? "transparent" : m.couleur, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {cat.selection_type === "unique" ? "Étape unique" : cat.selection_type === "multiple" ? "Étape multi" : "Libre"}
                      </button>
                      <button onClick={() => { setEditCategorieId(cat.id); setEditCategorieNom(cat.nom); }} style={btnSmallGhost}>Renommer</button>
                    </div>
                    <button onClick={() => deleteCategorie(cat.id)} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c", flexShrink: 0 }}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCategorie} onChange={e => setNewCategorie(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategorie()} placeholder="Ex: Couleurs, Soins, Coupes…" style={{ flex: 1, ...miniInput }} />
            <button onClick={addCategorie} style={{ padding: "7px 16px", background: m.couleur, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ajouter</button>
          </div>
        </Section>

        {/* Prestations */}
        <Section titre="Prestations" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {prestations.length === 0 && <div style={{ fontSize: 13, color: "#bbb" }}>Aucune prestation.</div>}
            {prestations.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8 }}>
                {editPrestaId === p.id && editPresta ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input value={editPresta.nom} onChange={e => setEditPresta({ ...editPresta, nom: e.target.value })} style={{ flex: 2, minWidth: 120, ...miniInput }} placeholder="Nom" />
                      <input type="number" value={editPresta.duree_minutes} onChange={e => setEditPresta({ ...editPresta, duree_minutes: Number(e.target.value) })} style={{ flex: 1, ...miniInput }} />
                      <input type="number" value={editPresta.tarif} onChange={e => setEditPresta({ ...editPresta, tarif: Number(e.target.value) })} style={{ flex: 1, ...miniInput }} disabled={editPresta.sur_devis} />
                      <button onClick={saveEditPresta} style={btnSmall(m.couleur)}>✓</button>
                      <button onClick={() => setEditPrestaId(null)} style={btnSmallGhost}>✕</button>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", paddingLeft: 2 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", cursor: "pointer" }}>
                        <input type="checkbox" checked={editPresta.sur_devis ?? false} onChange={e => setEditPresta({ ...editPresta, sur_devis: e.target.checked, tarif: e.target.checked ? 0 : editPresta.tarif })} style={{ accentColor: m.couleur }} />
                        Sur devis
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#555" }}>Catégorie :</span>
                        <select value={editPresta.categorie_id || ""} onChange={e => setEditPresta({ ...editPresta, categorie_id: e.target.value || null })}
                          style={{ ...miniInput, fontSize: 12 }}>
                          <option value="">— Aucune —</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nom}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nom}</div>
                      {p.categorie_id && <div style={{ fontSize: 11, color: m.couleur, marginTop: 1 }}>{categories.find(c => c.id === p.categorie_id)?.nom}</div>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: "#666" }}>{p.duree_minutes} min</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.sur_devis ? "#aaa" : "#1a1a1a" }}>{p.sur_devis ? "Sur devis" : `${p.tarif} €`}</span>
                    <button onClick={() => { setEditPrestaId(p.id); setEditPresta({ ...p, sur_devis: p.sur_devis ?? false }); }} style={btnSmallGhost}>Modifier</button>
                    <button onClick={() => deletePresta(p.id)} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c" }}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 120 }}>
                <label style={labelStyle}>Nom *</label>
                <input value={newPresta.nom} onChange={e => setNewPresta(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Pose complète" style={{ ...miniInput, width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Durée (min)</label>
                <input type="number" value={newPresta.duree_minutes} onChange={e => setNewPresta(p => ({ ...p, duree_minutes: e.target.value }))} style={{ ...miniInput, width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tarif (€)</label>
                <input type="number" value={newPresta.tarif} onChange={e => setNewPresta(p => ({ ...p, tarif: e.target.value }))} style={{ ...miniInput, width: "100%" }} disabled={newPresta.sur_devis} />
              </div>
              {categories.length > 0 && (
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Catégorie</label>
                  <select value={newPresta.categorie_id} onChange={e => setNewPresta(p => ({ ...p, categorie_id: e.target.value }))} style={{ ...miniInput, width: "100%" }}>
                    <option value="">— Aucune —</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nom}</option>)}
                  </select>
                </div>
              )}
              <button onClick={addPresta} style={{ padding: "9px 16px", background: m.couleur, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ajouter</button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", cursor: "pointer" }}>
              <input type="checkbox" checked={newPresta.sur_devis} onChange={e => setNewPresta(p => ({ ...p, sur_devis: e.target.checked, tarif: e.target.checked ? "0" : p.tarif }))} style={{ accentColor: m.couleur }} />
              Prix sur devis (pas de tarif fixe)
            </label>
          </div>
        </Section>
        </>
      )}

      {/* ── Disponibilités ── */}
      {tab === "dispos" && (
        <>
          <Section titre="Horaires de travail">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {JOURS.map((jour, i) => (
                <div key={i} style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: dispos[i].actif ? 10 : 0 }}>
                    <button type="button" onClick={() => setDispos(d => d.map((j, idx) => idx === i ? { ...j, actif: !j.actif } : j))}
                      style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: "none", background: dispos[i].actif ? m.couleur : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <div style={{ position: "absolute", top: 2, left: dispos[i].actif ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: dispos[i].actif ? "#1a1a1a" : "#bbb", minWidth: 80 }}>{jour}</span>
                    {!dispos[i].actif && <span style={{ fontSize: 12, color: "#ccc" }}>Fermé</span>}
                  </div>
                  {dispos[i].actif && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 48 }}>
                      {dispos[i].plages.map((plage, pi) => (
                        <div key={pi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="time" value={plage.heure_debut} onChange={e => setDispos(d => d.map((j, idx) => idx === i ? { ...j, plages: j.plages.map((p, pidx) => pidx === pi ? { ...p, heure_debut: e.target.value } : p) } : j))}
                            style={{ ...miniInput, width: 110 }} />
                          <span style={{ fontSize: 12, color: "#999" }}>→</span>
                          <input type="time" value={plage.heure_fin} onChange={e => setDispos(d => d.map((j, idx) => idx === i ? { ...j, plages: j.plages.map((p, pidx) => pidx === pi ? { ...p, heure_fin: e.target.value } : p) } : j))}
                            style={{ ...miniInput, width: 110 }} />
                          {dispos[i].plages.length > 1 && (
                            <button onClick={() => setDispos(d => d.map((j, idx) => idx === i ? { ...j, plages: j.plages.filter((_, pidx) => pidx !== pi) } : j))}
                              style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c", padding: "4px 8px" }}>✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setDispos(d => d.map((j, idx) => idx === i ? { ...j, plages: [...j.plages, defaultPlage()] } : j))}
                        style={{ alignSelf: "flex-start", fontSize: 12, color: m.couleur, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                        + Ajouter une pause
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={saveDispos} disabled={savingDispos}
                style={{ padding: "8px 20px", background: savedDispos ? "#27ae60" : m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
                {savingDispos ? "Enregistrement…" : savedDispos ? "✓ Enregistré" : "Enregistrer"}
              </button>
            </div>
          </Section>

          <Section titre="Congés & fermetures" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              {conges.length === 0 && <div style={{ fontSize: 13, color: "#bbb" }}>Aucune période de fermeture.</div>}
              {conges.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.libelle || "Fermeture"}</span>
                  <span style={{ fontSize: 12, color: "#666" }}>{c.date_debut} → {c.date_fin}</span>
                  <button onClick={() => c.id && deleteConge(c.id)} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c" }}>✕</button>
                </div>
              ))}
            </div>
            <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Date début</label>
                <input type="date" value={newConge.date_debut} onChange={e => setNewConge(c => ({ ...c, date_debut: e.target.value }))} style={{ ...miniInput, width: "100%" }} />
              </div>
              <div>
                <label style={labelStyle}>Date fin</label>
                <input type="date" value={newConge.date_fin} onChange={e => setNewConge(c => ({ ...c, date_fin: e.target.value }))} style={{ ...miniInput, width: "100%" }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Libellé (optionnel)</label>
              <input value={newConge.libelle} onChange={e => setNewConge(c => ({ ...c, libelle: e.target.value }))} placeholder="Ex: Vacances d'été" style={{ ...miniInput, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={addConge} style={{ padding: "8px 20px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Ajouter
              </button>
            </div>
          </Section>

          <Section titre="Horaires exceptionnels" style={{ marginTop: 16 }}>
            <div style={{ background: "#f8f8f8", border: "1px solid #ebebeb", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#666", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: "#444", marginBottom: 4 }}>Ordre de priorité</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div>🔵 <strong>Horaires de travail</strong> — votre planning habituel, appliqué par défaut</div>
                <div>🟡 <strong>Période</strong> — remplace les horaires habituels sur une plage de dates</div>
                <div>🔴 <strong>Jour unique (Prioritaire)</strong> — toujours appliqué en dernier, écrase tout</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              {exceptions.length === 0 && <div style={{ fontSize: 13, color: "#bbb" }}>Aucune exception à venir.</div>}
              {exceptions.map(ex => (
                <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 100 }}>{new Date(ex.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                  {ex.ferme ? (
                    <span style={{ fontSize: 13, color: "#e74c3c", fontWeight: 600 }}>Fermé</span>
                  ) : (
                    <span style={{ fontSize: 13, color: "#555", flex: 1 }}>
                      {ex.plages.map((p, i) => <span key={i}>{i > 0 ? " · " : ""}{p.heure_debut}–{p.heure_fin}</span>)}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: ex.type === "periode" ? "#f0f0f0" : m.couleur + "18", color: ex.type === "periode" ? "#aaa" : m.couleur, marginLeft: 4 }}>
                    {ex.type === "periode" ? "Période" : "Prioritaire"}
                  </span>
                  <button onClick={() => startEditException(ex)} style={{ ...btnSmallGhost, marginLeft: "auto" }}>✏️</button>
                  <button onClick={() => deleteException(ex.id)} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c" }}>✕</button>
                </div>
              ))}
            </div>
            {/* Toggle mode */}
            <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 3, gap: 3, alignSelf: "flex-start" }}>
              {(["single", "period"] as const).map(mode => (
                <button key={mode} onClick={() => setExceptionMode(mode)}
                  style={{ padding: "6px 16px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: exceptionMode === mode ? "#fff" : "transparent", color: exceptionMode === mode ? "#1a1a1a" : "#999", boxShadow: exceptionMode === mode ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {mode === "single" ? "Jour unique" : "Période"}
                </button>
              ))}
            </div>

            {/* Jour unique */}
            {exceptionMode === "single" && (
              <div ref={exceptionFormRef} style={{ border: `1px solid ${editingExceptionId ? m.couleur + "60" : "#f0f0f0"}`, borderRadius: 8, padding: "14px 14px 10px" }}>
                {editingExceptionId && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: m.couleur, background: m.couleur + "12", borderRadius: 6, padding: "4px 10px", marginBottom: 10, display: "inline-block" }}>
                    ✏️ Mode édition
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input type="date" value={newException.date} onChange={e => setNewException(ex => ({ ...ex, date: e.target.value }))} style={{ ...miniInput }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "7px 12px", border: `1.5px solid ${!newException.ferme ? m.couleur : "#e0e0e0"}`, borderRadius: 7, background: !newException.ferme ? m.couleur + "12" : "#fff" }}>
                      <input type="radio" name="exFerme" checked={!newException.ferme} onChange={() => setNewException(ex => ({ ...ex, ferme: false }))} style={{ accentColor: m.couleur }} />
                      Horaires spéciaux
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "7px 12px", border: `1.5px solid ${newException.ferme ? "#e74c3c" : "#e0e0e0"}`, borderRadius: 7, background: newException.ferme ? "#fef2f2" : "#fff" }}>
                      <input type="radio" name="exFerme" checked={newException.ferme} onChange={() => setNewException(ex => ({ ...ex, ferme: true }))} />
                      Fermé ce jour
                    </label>
                  </div>
                </div>
                {!newException.ferme && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {newException.plages.map((plage, pi) => (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="time" value={plage.heure_debut} onChange={e => setNewException(ex => ({ ...ex, plages: ex.plages.map((p, i) => i === pi ? { ...p, heure_debut: e.target.value } : p) }))} style={{ ...miniInput, width: 110 }} />
                        <span style={{ fontSize: 12, color: "#999" }}>→</span>
                        <input type="time" value={plage.heure_fin} onChange={e => setNewException(ex => ({ ...ex, plages: ex.plages.map((p, i) => i === pi ? { ...p, heure_fin: e.target.value } : p) }))} style={{ ...miniInput, width: 110 }} />
                        {newException.plages.length > 1 && (
                          <button onClick={() => setNewException(ex => ({ ...ex, plages: ex.plages.filter((_, i) => i !== pi) }))} style={{ ...btnSmallGhost, color: "#e74c3c", borderColor: "#e74c3c", padding: "4px 8px" }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setNewException(ex => ({ ...ex, plages: [...ex.plages, defaultPlage()] }))} style={{ alignSelf: "flex-start", fontSize: 12, color: m.couleur, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>+ Ajouter une pause</button>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {editingExceptionId && (
                    <button onClick={cancelEditException} style={{ padding: "8px 16px", background: "#fff", color: "#666", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                  )}
                  <button onClick={addException} disabled={!newException.date} style={{ padding: "8px 20px", background: newException.date ? m.couleur : "#e0e0e0", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: newException.date ? "pointer" : "not-allowed" }}>{editingExceptionId ? "Modifier" : "Ajouter"}</button>
                </div>
              </div>
            )}

            {/* Période */}
            {exceptionMode === "period" && (
              <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: "14px 14px 12px" }}>
                {/* Dates */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <label style={labelStyle}>Du</label>
                    <input type="date" value={newPeriod.date_debut} onChange={e => setNewPeriod(p => ({ ...p, date_debut: e.target.value }))} style={{ ...miniInput }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Au</label>
                    <input type="date" value={newPeriod.date_fin} onChange={e => setNewPeriod(p => ({ ...p, date_fin: e.target.value }))} style={{ ...miniInput }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <label style={labelStyle}>Horaires communs</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="time" value={newPeriod.commonDebut}
                        onChange={e => setNewPeriod(p => ({ ...p, commonDebut: e.target.value, jours: p.jours.map(j => ({ ...j, heure_debut: e.target.value })) }))}
                        style={{ ...miniInput, width: 100 }} />
                      <span style={{ fontSize: 12, color: "#999" }}>→</span>
                      <input type="time" value={newPeriod.commonFin}
                        onChange={e => setNewPeriod(p => ({ ...p, commonFin: e.target.value, jours: p.jours.map(j => ({ ...j, heure_fin: e.target.value })) }))}
                        style={{ ...miniInput, width: 100 }} />
                    </div>
                  </div>
                </div>

                {/* Ligne par jour */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((nom, i) => {
                    const jour = newPeriod.jours[i];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 7, background: jour.actif ? "#fafafa" : "#f5f5f5", opacity: jour.actif ? 1 : 0.5 }}>
                        <button onClick={() => setNewPeriod(p => ({ ...p, jours: p.jours.map((j, idx) => idx === i ? { ...j, actif: !j.actif } : j) }))}
                          style={{ flexShrink: 0, width: 32, height: 18, borderRadius: 9, border: "none", background: jour.actif ? m.couleur : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                          <div style={{ position: "absolute", top: 2, left: jour.actif ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 26, color: jour.actif ? "#333" : "#bbb" }}>{nom}</span>
                        {jour.actif ? (
                          <>
                            <input type="time" value={jour.heure_debut}
                              onChange={e => setNewPeriod(p => ({ ...p, jours: p.jours.map((j, idx) => idx === i ? { ...j, heure_debut: e.target.value } : j) }))}
                              style={{ ...miniInput, width: 95, fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: "#bbb" }}>→</span>
                            <input type="time" value={jour.heure_fin}
                              onChange={e => setNewPeriod(p => ({ ...p, jours: p.jours.map((j, idx) => idx === i ? { ...j, heure_fin: e.target.value } : j) }))}
                              style={{ ...miniInput, width: 95, fontSize: 12 }} />
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: "#ccc" }}>Fermé</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {getPeriodPreview() > 0 ? `${getPeriodPreview()} jour${getPeriodPreview() > 1 ? "s" : ""} concerné${getPeriodPreview() > 1 ? "s" : ""}` : ""}
                  </span>
                  <button onClick={addPeriod} disabled={!newPeriod.date_debut || !newPeriod.date_fin || getPeriodPreview() === 0}
                    style={{ padding: "8px 20px", background: getPeriodPreview() > 0 ? m.couleur : "#e0e0e0", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: getPeriodPreview() > 0 ? "pointer" : "not-allowed" }}>
                    Générer {getPeriodPreview() > 0 ? `(${getPeriodPreview()})` : ""}
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section titre="Réservation en ligne" style={{ marginTop: 16 }}>
            <Champ
              label="Délai minimum avant réservation (heures)"
              type="number"
              value={String(settings.delai_min_reservation_heures)}
              onChange={v => setSettings(s => ({ ...s, delai_min_reservation_heures: Math.max(0, parseInt(v) || 0) }))}
            />
            <div style={{ fontSize: 12, color: "#aaa", marginTop: -6 }}>
              Ex : 24 = vos clientes ne peuvent pas réserver moins de 24h à l'avance. 0 = pas de délai.
            </div>
            <SaveButton sectionKey="reservation" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
          </Section>
        </>
      )}

      {/* ── Emails ── */}
      {tab === "emails" && (
        <>
          <Section titre="Emails automatiques">
            <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Champ label="Nom de l'expéditeur" value={settings.email_expediteur_nom} onChange={v => setSettings(s => ({ ...s, email_expediteur_nom: v }))} />
              <Champ label="Email expéditeur (reply-to client)" value={settings.email_expediteur} onChange={v => setSettings(s => ({ ...s, email_expediteur: v }))} type="email" />
            </div>
            <Champ label="Email de réception des nouvelles réservations" value={settings.email_reception} onChange={v => setSettings(s => ({ ...s, email_reception: v }))} type="email" />
            <div style={{ fontSize: 12, color: "#aaa", marginTop: -6 }}>Si vide, les notifications sont envoyées à votre email expéditeur ou email de compte.</div>
            <div style={{ height: 1, background: "#f0f0f0" }} />
            <Toggle label="Confirmation de rendez-vous" description="Envoie un email au client dès qu'un RDV est créé" value={settings.email_confirmation_active} onChange={v => setSettings(s => ({ ...s, email_confirmation_active: v }))} couleur={m.couleur} />
            {settings.email_confirmation_active && (
              <>
                <Champ label="Objet" value={settings.email_confirmation_objet} onChange={v => setSettings(s => ({ ...s, email_confirmation_objet: v }))} />
                <ChampTextarea label="Contenu" value={settings.message_confirmation} onChange={v => setSettings(s => ({ ...s, message_confirmation: v }))} hint="{prenom}, {date}, {heure}, {prestations}, {tarif}, {salon}" />
              </>
            )}
            <div style={{ height: 1, background: "#f0f0f0" }} />
            <Toggle label="Rappel 24h avant" description="Envoie un rappel la veille à 9h UTC pour les RDVs confirmés" value={settings.email_rappel_active} onChange={v => setSettings(s => ({ ...s, email_rappel_active: v }))} couleur={m.couleur} />
            {settings.email_rappel_active && (
              <>
                <Champ label="Objet" value={settings.email_rappel_objet} onChange={v => setSettings(s => ({ ...s, email_rappel_objet: v }))} />
                <ChampTextarea label="Contenu" value={settings.message_rappel_rdv} onChange={v => setSettings(s => ({ ...s, message_rappel_rdv: v }))} hint="{prenom}, {date}, {heure}, {prestations}, {tarif}, {salon}" />
              </>
            )}
            <SaveButton sectionKey="emails" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
          </Section>

          <Section titre="SMS automatiques" style={{ marginTop: 16 }}>
            {isFree ? (
              <div style={{ background: "#fafafa", border: "1px solid #e0e0e0", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>SMS non disponibles en plan Gratuit</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Passez en plan Indépendant pour envoyer des SMS de confirmation et rappels — 50 SMS/mois inclus.</div>
                </div>
                <button onClick={triggerCheckout} style={{ padding: "7px 14px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Passer à 19€/mois
                </button>
              </div>
            ) : (
              <Toggle label="SMS activés" description="Envoie un SMS de confirmation et de rappel aux clients" value={settings.sms_active} onChange={v => setSettings(s => ({ ...s, sms_active: v }))} couleur={m.couleur} />
            )}
            {settings.sms_active && (
              <>
                <Champ label="Nom de l'expéditeur SMS (max 11 caractères, sans espaces)" value={settings.sms_expediteur} onChange={v => setSettings(s => ({ ...s, sms_expediteur: v.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) }))} />
                <ChampTextarea label="SMS de confirmation" value={settings.sms_message_confirmation} onChange={v => setSettings(s => ({ ...s, sms_message_confirmation: v }))} hint="{prenom}, {date}, {heure}, {salon}" />
                <ChampTextarea label="SMS de rappel" value={settings.sms_message_rappel} onChange={v => setSettings(s => ({ ...s, sms_message_rappel: v }))} hint="{prenom}, {date}, {heure}, {salon}" />
                <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Crédits SMS disponibles</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: (salon?.sms_credits ?? 0) === 0 ? "#dc2626" : (salon?.sms_credits ?? 0) <= 10 ? "#ea580c" : "#1a1a1a", marginTop: 2 }}>{salon?.sms_credits ?? 0}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#555", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, padding: "8px 12px" }}>50 SMS offerts chaque mois avec votre abonnement · maximum 150 SMS cumulés (3 mois).<br/>Au besoin, rechargez ci-dessous :</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([{ pack: 50, price: "5€" }, { pack: 100, price: "8€" }, { pack: 200, price: "14€" }, { pack: 500, price: "30€" }] as { pack: number; price: string }[]).map(({ pack, price }) => (
                      <button key={pack} onClick={async () => {
                        const supabase = createSupabase();
                        const { data: { session: sess } } = await supabase.auth.getSession();
                        const res = await fetch("/api/stripe/sms-credits", { method: "POST", headers: { authorization: `Bearer ${sess?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ salon_id: salon!.id, pack }) });
                        const { url } = await res.json();
                        if (url) window.location.href = url;
                      }} style={{ padding: "8px 14px", background: m.couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {pack} SMS — {price}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {!isFree && <SaveButton sectionKey="sms" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />}
          </Section>

          <Section titre="Relances clients" style={{ marginTop: 16 }}>
            <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Champ label="Nom de l'expéditeur" value={settings.email_expediteur_nom} onChange={v => setSettings(s => ({ ...s, email_expediteur_nom: v }))} />
              <Champ label="Email expéditeur" value={settings.email_expediteur} onChange={v => setSettings(s => ({ ...s, email_expediteur: v }))} type="email" />
            </div>
            <Champ label="Délai avant relance (mois)" value={String(settings.delai_relance_mois)} onChange={v => setSettings(s => ({ ...s, delai_relance_mois: Number(v) }))} type="number" />
            <Champ label="Objet de l'email" value={settings.email_relance_objet} onChange={v => setSettings(s => ({ ...s, email_relance_objet: v }))} />
            <ChampTextarea label="Contenu" value={settings.message_relance} onChange={v => setSettings(s => ({ ...s, message_relance: v }))} hint="{prenom}" />
            <SaveButton sectionKey="relances" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
          </Section>
        </>
      )}

      {/* ── Fidélité ── */}
      {tab === "fidelite" && (
        <Section titre="Fidélité & parrainage">
          <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Champ label="Visites pour récompense" value={String(settings.nb_visites_fidelite)} onChange={v => setSettings(s => ({ ...s, nb_visites_fidelite: Number(v) }))} type="number" />
            <Champ label="Montant récompense (€)" value={String(settings.montant_recompense)} onChange={v => setSettings(s => ({ ...s, montant_recompense: Number(v) }))} type="number" />
            <Champ label="Tarif minimum (€)" value={String(settings.tarif_minimum)} onChange={v => setSettings(s => ({ ...s, tarif_minimum: Number(v) }))} type="number" />
            <div />
            <Champ label="Bonus parrain (€)" value={String(settings.montant_parrain)} onChange={v => setSettings(s => ({ ...s, montant_parrain: Number(v) }))} type="number" />
            <Champ label="Bonus filleul·e (€)" value={String(settings.montant_filleul)} onChange={v => setSettings(s => ({ ...s, montant_filleul: Number(v) }))} type="number" />
          </div>
          <SaveButton sectionKey="fidelite" saving={saving} saved={saved} onSave={saveSection} couleur={m.couleur} />
        </Section>
      )}

      {/* ── Compte ── */}
      {tab === "compte" && (
        <>
          <Section titre="Votre vitrine">
            <div>
              <label style={labelStyle}>URL personnalisée</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#999", whiteSpace: "nowrap" }}>rdvous.fr/</span>
                <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="mon-institut" style={{ flex: 1, padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13 }} />
                <button onClick={saveSlug} disabled={slugSaving}
                  style={{ padding: "9px 16px", background: m.couleur, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {slugSaving ? "…" : "Enregistrer"}
                </button>
              </div>
              {slugMsg && <div style={{ fontSize: 12, color: slugMsg.ok ? "#27ae60" : "#e74c3c", marginTop: 6 }}>{slugMsg.text}</div>}
              {slug && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>Lien : <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: m.couleur }}>rdvous.fr/{slug}</a></div>}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: visibleRecherche ? "#f0fdf4" : "#fafafa", border: `1px solid ${visibleRecherche ? "#86efac" : "#e0e0e0"}`, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: visibleRecherche ? "#16a34a" : "#555" }}>
                  {visibleRecherche ? "Visible dans la recherche" : "Masqué de la recherche"}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                  {visibleRecherche ? "Votre page apparaît dans les résultats de rdvous.fr" : "Votre page n'apparaît pas dans les résultats de rdvous.fr"}
                </div>
              </div>
              <button onClick={toggleVisibilite} style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: "none", background: visibleRecherche ? "#16a34a" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <span style={{ position: "absolute", top: 3, left: visibleRecherche ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", display: "block" }} />
              </button>
            </div>

            <div style={{ height: 1, background: "#f0f0f0" }} />

            <div>
              <label style={labelStyle}>Déplacements à domicile</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {([
                  { value: "non", label: "Non — salon uniquement" },
                  { value: "possible", label: "Oui, en option — salon et domicile" },
                  { value: "uniquement", label: "Oui, uniquement à domicile" },
                ] as { value: "non" | "possible" | "uniquement"; label: string }[]).map(opt => (
                  <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, padding: "10px 12px", border: `1.5px solid ${deplacement === opt.value ? m.couleur : "#e0e0e0"}`, borderRadius: 8, background: deplacement === opt.value ? m.couleur + "10" : "#fff" }}>
                    <input type="radio" name="deplacement" value={opt.value} checked={deplacement === opt.value} onChange={() => saveDeplacement(opt.value)} style={{ accentColor: m.couleur }} />
                    {opt.label}
                    {deplacementSaving && deplacement === opt.value && <span style={{ marginLeft: "auto", fontSize: 11, color: "#bbb" }}>…</span>}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: "#f0f0f0" }} />

            <div>
              <label style={labelStyle}>Photos de votre institut</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                {photos.map(url => (
                  <div key={url} style={{ position: "relative", width: 100, height: 100 }}>
                    <img src={url} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #e0e0e0" }} />
                    <button onClick={() => deletePhoto(url)}
                      style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
                  </div>
                ))}
                {photos.length < 3 && <label style={{ width: 100, height: 100, border: "2px dashed #ddd", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: photoUploading ? "not-allowed" : "pointer", gap: 4 }}>
                  <span style={{ fontSize: 22, color: "#ccc" }}>{photoUploading ? "…" : "+"}</span>
                  <span style={{ fontSize: 11, color: "#bbb" }}>Ajouter</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} disabled={photoUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                </label>}
              </div>
              <div style={{ fontSize: 12, color: "#bbb" }}>Format JPG, PNG · Max 5 MB · Affichées sur votre vitrine</div>
            </div>
          </Section>

          <Section titre="Abonnement" style={{ marginTop: 16 }}>
            <div className="params-abo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Plan {PLAN_LABELS[plan]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: isFree ? "#f0f0f0" : m.couleur + "22", color: isFree ? "#999" : m.couleur }}>
                    {PLAN_PRICES[plan]}
                  </span>
                </div>
                {isFree && <div style={{ fontSize: 12, color: "#999" }}>Limité à 30 rendez-vous/mois · Fidélité et cagnotte non disponibles</div>}
                {!isFree && <div style={{ fontSize: 12, color: "#999" }}>Accès complet · Rappels email · Fidélité & cagnotte inclus</div>}
              </div>
              {isFree ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 3, gap: 3 }}>
                    <button onClick={() => setBillingInterval("monthly")} style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: billingInterval === "monthly" ? "#fff" : "transparent", color: billingInterval === "monthly" ? "#1a1a1a" : "#999", boxShadow: billingInterval === "monthly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>Mensuel — 19€</button>
                    <button onClick={() => setBillingInterval("yearly")} style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: billingInterval === "yearly" ? "#fff" : "transparent", color: billingInterval === "yearly" ? "#1a1a1a" : "#999", boxShadow: billingInterval === "yearly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>Annuel — 190€ <span style={{ color: m.couleur }}>-2 mois offerts</span></button>
                  </div>
                  <button onClick={startCheckout} disabled={billingLoading} style={{ padding: "10px 22px", background: m.couleur, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {billingLoading ? "Chargement…" : "Passer à l'offre Indépendant"}
                  </button>
                </div>
              ) : (
                <button onClick={openPortal} disabled={billingLoading} style={{ padding: "10px 22px", background: "#fff", color: "#555", border: "1px solid #ddd", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                  {billingLoading ? "Chargement…" : "Gérer mon abonnement"}
                </button>
              )}
            </div>
          </Section>

          <Section titre="Sécurité" style={{ marginTop: 16 }}>
            <div className="params-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nouveau mot de passe</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6 caractères minimum" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={labelStyle}>Confirmer le mot de passe</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            {pwdMessage && <div style={{ fontSize: 13, color: pwdMessage.ok ? "#27ae60" : "#e74c3c", fontWeight: 500 }}>{pwdMessage.text}</div>}
            <div>
              <button onClick={changePassword} disabled={pwdLoading || !newPassword}
                style={{ padding: "9px 20px", background: newPassword ? m.couleur : "#e0e0e0", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: newPassword ? "pointer" : "not-allowed" }}>
                {pwdLoading ? "Mise à jour…" : "Changer le mot de passe"}
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function SaveButton({ sectionKey, saving, saved, onSave, couleur }: { sectionKey: string; saving: Record<string, boolean>; saved: Record<string, boolean>; onSave: (k: string) => void; couleur: string }) {
  const isSaving = saving[sectionKey];
  const isSaved = saved[sectionKey];
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
      <button onClick={() => onSave(sectionKey)} disabled={isSaving}
        style={{ padding: "8px 20px", background: isSaved ? "#27ae60" : couleur, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
        {isSaving ? "Enregistrement…" : isSaved ? "✓ Enregistré" : "Enregistrer"}
      </button>
    </div>
  );
}

function Section({ titre, children, style }: { titre: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", ...style }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>{titre}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function Champ({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

function ChampTextarea({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <label style={labelStyle}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "#bbb" }}>Variables : {hint}</span>}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
    </div>
  );
}

function Toggle({ label, description, value, onChange, couleur }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; couleur: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{description}</div>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: "none", background: value ? couleur : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
        <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 };
const miniInput: React.CSSProperties = { padding: "7px 10px", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
function btnSmall(bg: string): React.CSSProperties { return { padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer" }; }
const btnSmallGhost: React.CSSProperties = { padding: "5px 10px", background: "none", border: "1px solid #ddd", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#555" };

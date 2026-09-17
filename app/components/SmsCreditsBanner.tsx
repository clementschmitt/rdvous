"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { createSupabase } from "@/lib/supabase";

// Horizon de prévision. Assez long pour prévenir bien avant la panne, assez
// court pour ne pas alarmer sur un planning encore à moitié vide.
const HORIZON_JOURS = 21;
// En deçà, la rupture est imminente et l'alerte cesse d'être discrète.
const SEUIL_URGENT_JOURS = 7;

/**
 * Alerte sur les crédits SMS, calibrée sur ce que le salon a réellement à
 * envoyer et non sur un seuil fixe.
 *
 * Un seuil absolu ne veut rien dire : dix crédits représentent dix semaines
 * d'avance pour un salon qui envoie un rappel par semaine, et un jour et demi
 * pour un salon qui en envoie huit par jour. On compare donc le solde au nombre
 * de rappels déjà programmés, ce qui permet d'annoncer la date de rupture avant
 * qu'elle ne survienne plutôt que de la constater la veille.
 *
 * L'insistance est graduée : une échéance lointaine s'affiche sobrement et peut
 * être écartée, une échéance proche ne se referme plus. Une bannière rouge
 * plantée trois semaines en haut de l'écran finit par ne plus être lue, et
 * c'est précisément le jour où elle compte qu'elle serait ignorée.
 */
export default function SmsCreditsBanner() {
  const salon = useSalon();
  const [loading, setLoading] = useState(false);
  const [rappels, setRappels] = useState<string[] | null>(null);
  const [masque, setMasque] = useState<string | null>(null);

  const salonId = salon?.id;
  const plan = salon?.plan;
  const cleMasquage = salonId ? `sms-alerte-masquee-${salonId}` : null;

  useEffect(() => {
    if (!cleMasquage) return;
    try {
      setMasque(window.localStorage.getItem(cleMasquage));
    } catch {
      // Navigation privée ou stockage refusé : on affiche, c'est le cas sûr.
    }
  }, [cleMasquage]);

  useEffect(() => {
    if (!salonId || plan === "free") return;
    let annule = false;

    (async () => {
      // Le cron rappelle les rendez-vous de la veille pour le lendemain : les
      // rappels à venir sont donc les rendez-vous à partir de demain.
      const debut = new Date();
      debut.setDate(debut.getDate() + 1);
      debut.setHours(0, 0, 0, 0);
      const fin = new Date();
      fin.setDate(fin.getDate() + HORIZON_JOURS);
      fin.setHours(23, 59, 59, 999);

      const supabase = createSupabase();
      const { data } = await supabase
        .from("rendez_vous")
        .select("date_heure")
        .eq("salon_id", salonId)
        .eq("statut", "planifie")
        .gte("date_heure", debut.toISOString())
        .lte("date_heure", fin.toISOString())
        .order("date_heure");

      if (!annule) setRappels((data || []).map(r => r.date_heure as string));
    })();

    return () => { annule = true; };
  }, [salonId, plan]);

  if (!salon || salon.plan === "free") return null;

  // Total réellement envoyable : forfait du mois + packs achetés
  const credits = (salon.sms_credits ?? 0) + (salon.sms_credits_achetes ?? 0);
  const isZero = credits === 0;

  // Premier rendez-vous que le solde ne couvre pas. `credits` sert d'index :
  // avec 5 crédits, les rappels 0 à 4 partent et le 5e est le premier perdu.
  const premierNonCouvert = rappels && credits < rappels.length ? rappels[credits] : null;
  const nonCouverts = rappels && premierNonCouvert ? rappels.length - credits : 0;

  // On se tait tant que rien ne manque, en gardant l'ancien seuil comme filet
  // pour les salons dont le planning n'est pas encore rempli.
  if (!isZero && !premierNonCouvert && credits > 10) return null;

  const joursAvant = premierNonCouvert
    ? Math.ceil((new Date(premierNonCouvert).getTime() - Date.now()) / 86400000)
    : null;

  const niveau: "critique" | "urgent" | "info" =
    isZero ? "critique"
      : joursAvant !== null && joursAvant > SEUIL_URGENT_JOURS ? "info"
        : "urgent";

  // Une alerte lointaine écartée reste masquée tant que l'échéance ne bouge pas.
  // Si la rupture se rapproche, la valeur mémorisée ne correspond plus et
  // l'information revient d'elle-même.
  if (niveau === "info" && masque === premierNonCouvert) return null;

  const dateRupture = premierNonCouvert
    ? new Date(premierNonCouvert).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : null;

  const message = isZero
    ? "SMS désactivés, crédits épuisés. Vos clientes ne reçoivent plus de rappel."
    : dateRupture
      ? `Il vous reste ${credits} crédits SMS. À partir du ${dateRupture}, ${nonCouverts} rendez-vous ne seront plus rappelés.`
      : `Il vous reste ${credits} crédits SMS, rechargez bientôt`;

  const styles = {
    critique: { fond: "#fef2f2", bord: "#fca5a5", texte: "#dc2626", bouton: "#dc2626", gras: 600 },
    urgent: { fond: "#fff7ed", bord: "#fed7aa", texte: "#c2410c", bouton: "#ea580c", gras: 600 },
    info: { fond: "#f8fafc", bord: "#e2e8f0", texte: "#475569", bouton: "#64748b", gras: 500 },
  }[niveau];

  function ecarter() {
    if (!cleMasquage || !premierNonCouvert) return;
    try {
      window.localStorage.setItem(cleMasquage, premierNonCouvert);
    } catch {
      // Sans stockage, la bannière réapparaîtra au prochain chargement.
    }
    setMasque(premierNonCouvert);
  }

  async function recharge() {
    setLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/sms-credits", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, pack: 100 }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  return (
    <div style={{ background: styles.fond, borderBottom: `1px solid ${styles.bord}`, padding: niveau === "info" ? "7px 24px" : "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: niveau === "info" ? 12.5 : 13 }}>
      <span style={{ color: styles.texte, fontWeight: styles.gras }}>
        {message}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={recharge} disabled={loading}
          style={{ padding: niveau === "info" ? "4px 11px" : "6px 14px", background: niveau === "info" ? "transparent" : styles.bouton, color: niveau === "info" ? styles.texte : "#fff", border: niveau === "info" ? `1px solid ${styles.bord}` : "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          {loading ? "…" : "Recharger"}
        </button>
        {niveau === "info" && (
          <button onClick={ecarter} aria-label="Masquer cette alerte"
            style={{ background: "none", border: "none", color: styles.texte, fontSize: 16, lineHeight: 1, cursor: "pointer", padding: "0 4px", opacity: 0.6 }}>
            ×
          </button>
        )}
      </span>
    </div>
  );
}

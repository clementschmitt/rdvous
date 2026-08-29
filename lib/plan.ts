export type Plan = "free" | "pro" | "business";

export const PLAN_LIMITS = {
  free: {
    rdv_par_mois: 30,
    sms_par_mois: 0,
    rappels_sms: false,
    rappels_email: true,
    page_publique: true,
    fidelite: false,
    cagnotte: false,
    export_clients: false,
  },
  pro: {
    rdv_par_mois: Infinity,
    sms_par_mois: 50,
    rappels_sms: true,
    rappels_email: true,
    page_publique: true,
    fidelite: true,
    cagnotte: true,
    export_clients: true,
  },
  business: {
    rdv_par_mois: Infinity,
    sms_par_mois: 150,
    rappels_sms: true,
    rappels_email: true,
    page_publique: true,
    fidelite: true,
    cagnotte: true,
    export_clients: true,
  },
} as const;

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/** Quota SMS mensuel du plan. Les crédits sont remis à ce niveau à chaque cycle, sans report. */
export function quotaSms(plan: string | null | undefined): number {
  return getPlanLimits((plan || "free") as Plan).sms_par_mois;
}

/**
 * Packs de crédits SMS achetables à l'unité. Source unique, utilisée par la page
 * de paramètres pour l'affichage et par la route Stripe pour le montant facturé.
 *
 * On parle de crédits et non de SMS : un message dépassant 160 caractères
 * consomme plusieurs segments, donc plusieurs crédits. Un crédit vaut environ
 * 0,054 € TTC chez l'opérateur, et le prix décroît avec le volume tout en
 * restant rentable après commissions et cotisations.
 */
// `priceId` référence un tarif fixe créé dans Stripe. On évite ainsi de générer
// un produit jetable à chaque achat, ce que faisait l'ancien `price_data` et qui
// finissait par encombrer le catalogue. `prixCentimes` ne sert plus qu'à
// l'affichage : le montant facturé fait foi côté Stripe.
export const PACKS_SMS = [
  { credits: 50, prixCentimes: 800, priceId: "price_1U8KUiGVwWW2OxV0njwj5yiG" },
  { credits: 100, prixCentimes: 1400, priceId: "price_1U8KUjGVwWW2OxV0rhPfmSmU" },
  { credits: 250, prixCentimes: 3200, priceId: "price_1U8KUkGVwWW2OxV08xmziywr" },
  { credits: 500, prixCentimes: 6000, priceId: "price_1U8KUlGVwWW2OxV08eoyXSuf" },
] as const;

export function packSms(credits: number) {
  return PACKS_SMS.find(p => p.credits === credits) ?? null;
}

export function prixPack(prixCentimes: number): string {
  return `${(prixCentimes / 100).toFixed(0)} €`;
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Gratuit",
  pro: "Pro",
  business: "Business",
};

export const PLAN_PRICES: Record<Plan, string> = {
  free: "0€",
  pro: "39€/mois",
  business: "59€/mois",
};

/**
 * Tarifs Stripe des abonnements. Les identifiants vivent ici plutôt que dans des
 * variables d'environnement : ce ne sont pas des secrets, et les garder avec le
 * reste de la grille évite qu'affichage et facturation divergent.
 */
export const PRIX_STRIPE = {
  pro:      { mensuel: "price_1U9YpcGVwWW2OxV02tt6gPfc", annuel: "price_1U9YpdGVwWW2OxV0Ze8noZF3" },
  business: { mensuel: "price_1U9YpdGVwWW2OxV0JwvP1xRB", annuel: "price_1U9YpeGVwWW2OxV0c2II8eOX" },
} as const;

/**
 * Tous les tarifs Business ayant existé, anciens compris. Le webhook s'en sert
 * pour retrouver le plan d'un abonnement : sans les anciens identifiants, les
 * clients souscrits avant un changement de grille basculeraient en Pro au
 * premier événement Stripe. Ne jamais retirer une entrée de cette liste.
 */
export const PRIX_BUSINESS_CONNUS: string[] = [
  PRIX_STRIPE.business.mensuel,
  PRIX_STRIPE.business.annuel,
  "price_1TknvpGVwWW2OxV0Dto5kYam", // 49 €/mois, grille d'origine (abonnement de Coralie)
  "price_1TknwRGVwWW2OxV0jet78vYJ", // 490 €/an, grille d'origine
];

/**
 * Offre de lancement : 10 € de remise par mois pendant 12 mois, ou 100 € sur la
 * première année. Le client passe automatiquement au tarif plein ensuite, sans
 * intervention. Coupons créés dans Stripe.
 */
export const OFFRE_LANCEMENT = {
  // Ouverte à toute souscription faite en 2026. La remise court ensuite douze
  // mois à compter de la souscription, pas jusqu'à cette date.
  fin: "2026-12-31T23:59:59+01:00",
  couponMensuel: "LANCEMENT_MENSUEL",
  couponAnnuel: "LANCEMENT_ANNUEL",
};

export function offreLancementActive(maintenant: Date = new Date()): boolean {
  return maintenant.getTime() <= new Date(OFFRE_LANCEMENT.fin).getTime();
}

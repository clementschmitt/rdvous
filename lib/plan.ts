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
export const PACKS_SMS = [
  { credits: 50, prixCentimes: 800 },
  { credits: 100, prixCentimes: 1400 },
  { credits: 250, prixCentimes: 3200 },
  { credits: 500, prixCentimes: 6000 },
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
  pro: "29€/mois",
  business: "49€/mois",
};

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

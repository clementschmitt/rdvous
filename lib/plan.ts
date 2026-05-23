export type Plan = "free" | "solo" | "team";

export const PLAN_LIMITS = {
  free: {
    rdv_par_mois: 30,
    rappels_sms: false,
    rappels_email: true,
    page_publique: true,
    fidelite: false,
    cagnotte: false,
    export_clients: false,
  },
  solo: {
    rdv_par_mois: Infinity,
    rappels_sms: false,
    rappels_email: true,
    page_publique: true,
    fidelite: true,
    cagnotte: true,
    export_clients: true,
  },
  team: {
    rdv_par_mois: Infinity,
    rappels_sms: false,
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

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Gratuit",
  solo: "Indépendant",
  team: "Équipe",
};

export const PLAN_PRICES: Record<Plan, string> = {
  free: "0€",
  solo: "19€/mois",
  team: "39€/mois",
};

export const METIERS = {
  manucure: {
    label: "Manucure",
    labelClients: "Clients",
    couleur: "#6b2d42",
    couleurClaire: "#d4b8b0",
    couleurMuted: "#9b6b7b",
    champsClient: [
      { key: "mesures_capsules", label: "Mesures capsules", type: "text" },
    ],
  },
  toilettage: {
    label: "Toilettage",
    labelClients: "Clients",
    couleur: "#2E5E3E",
    couleurClaire: "#a8c5b0",
    couleurMuted: "#6b9b78",
    champsClient: [],
  },
  coiffure: {
    label: "Coiffure",
    labelClients: "Clients",
    couleur: "#1A3A8B",
    couleurClaire: "#a8b8d8",
    couleurMuted: "#6b7bab",
    champsClient: [
      { key: "type_cheveux", label: "Type de cheveux", type: "text" },
      { key: "couleur_actuelle", label: "Couleur actuelle", type: "text" },
    ],
  },
} as const;

export type Metier = keyof typeof METIERS;

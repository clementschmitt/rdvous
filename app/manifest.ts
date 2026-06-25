import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rdvous — Réservez près de chez vous",
    short_name: "rdvous",
    description: "Réservez en ligne chez vos professionnels du bien-être préférés",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f0eb",
    theme_color: "#2c1810",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["lifestyle", "health", "beauty"],
    lang: "fr",
  };
}

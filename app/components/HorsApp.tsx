"use client";
import { useDansApp } from "@/lib/contexte-app";

/**
 * N'affiche son contenu qu'en dehors de l'application mobile.
 *
 * Sert aux éléments que la coquille rend redondants : le fil d'Ariane de retour,
 * par exemple, doublonne avec le bouton retour d'AppHeader dans l'application,
 * mais reste le seul chemin de retour sur le web.
 */
export default function HorsApp({ children }: { children: React.ReactNode }) {
  return useDansApp() ? null : <>{children}</>;
}

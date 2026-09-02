import { ReactNode } from "react";

/**
 * La navigation de la coquille mobile tient entièrement dans AppHeader, rendu
 * par chaque page. La barre du bas a été retirée : avec l'accueil qui porte
 * désormais les rendez-vous, son onglet « Mes RDV » faisait doublon, et son
 * bouton Accueil renvoyait vers le site au lieu de l'application.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

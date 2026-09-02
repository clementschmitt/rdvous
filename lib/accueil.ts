"use client";
import { useState, useEffect } from "react";
import { useDansApp } from "@/lib/contexte-app";

/**
 * Où mène « l'accueil » selon le contexte.
 *
 * Une seule règle, la même que celle qui décide d'afficher AppHeader : **si
 * l'utilisatrice voit le cadre de l'application, l'accueil est celui de
 * l'application.** Donc dans Capacitor toujours, et sur un écran étroit.
 * Sur le web bureau, l'accueil reste la vitrine.
 *
 * Sans cette règle, les liens codés en dur vers `/` éjectaient l'utilisatrice
 * vers le site : c'est arrivé deux fois, sur le bouton Accueil de l'ancienne
 * barre du bas, puis sur « Trouver un salon » quand l'agenda est vide.
 */
export function useAccueilHref(): string {
  // Le rendu serveur ne connaît ni Capacitor ni la largeur : on part de la
  // vitrine et on corrige au montage, ce qui évite un écart d'hydratation.
  const dansApp = useDansApp();
  const [etroit, setEtroit] = useState(false);

  useEffect(() => { setEtroit(window.innerWidth < 1024); }, []);

  return dansApp || etroit ? "/app" : "/";
}

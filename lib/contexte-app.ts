"use client";
import { useState, useEffect } from "react";

/**
 * Sommes-nous dans l'application mobile ?
 *
 * Source de vérité unique, utilisée par AppHeader pour s'afficher et par
 * SiteHeader pour s'effacer. Sans elle, les deux barres pouvaient apparaître
 * ensemble ou disparaître ensemble selon la page.
 *
 * L'interrupteur `localStorage.rdvous_app` sert au développement : Capacitor
 * n'existe pas dans un navigateur, on ne pouvait donc pas vérifier le cadre de
 * l'application sans déployer et recompiler à chaque essai. Dans la console :
 *   localStorage.rdvous_app = "1"   pour simuler l'application
 *   localStorage.removeItem("rdvous_app")   pour revenir au site
 *
 * **Il n'agit que sur écran étroit.** Capacitor tourne toujours sur un
 * téléphone, et sans cette limite un interrupteur oublié effaçait l'en-tête du
 * site sur grand écran sans rien mettre à la place.
 */
export function useDansApp(): boolean {
  // Le rendu serveur ne connaît pas le contexte : on part du site et on corrige
  // au montage, ce qui évite un écart d'hydratation.
  const [dansApp, setDansApp] = useState(false);

  useEffect(() => {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    const natif = !!w.Capacitor?.isNativePlatform?.();
    let simule = false;
    try { simule = localStorage.getItem("rdvous_app") === "1" && window.innerWidth < 1024; } catch { simule = false; }
    setDansApp(natif || simule);
  }, []);

  return dansApp;
}

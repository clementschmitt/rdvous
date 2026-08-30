"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabase } from "@/lib/supabase";

/**
 * Enregistre l'appareil auprès du service de notifications, uniquement dans
 * l'application native et uniquement si une session existe : sans compte, on ne
 * saurait pas à qui envoyer la notification.
 *
 * Ne rend rien. Monté une fois dans la coquille mobile.
 */
export default function PushNotifications() {
  const router = useRouter();

  useEffect(() => {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
    if (!w.Capacitor?.isNativePlatform?.()) return;

    let annule = false;

    (async () => {
      const supabase = createSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || annule) return;

      // Import dynamique : le plugin n'existe pas dans le navigateur, un import
      // statique casserait le rendu de toutes les pages web.
      const { PushNotifications } = await import("@capacitor/push-notifications");

      const permission = await PushNotifications.checkPermissions();
      let accorde = permission.receive === "granted";
      if (!accorde && permission.receive === "prompt") {
        accorde = (await PushNotifications.requestPermissions()).receive === "granted";
      }
      // Refus explicite : on n'insiste pas, l'application reste utilisable.
      if (!accorde || annule) return;

      PushNotifications.addListener("registration", async ({ value }) => {
        await fetch("/api/appareils", {
          method: "POST",
          headers: { authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ token: value, plateforme: w.Capacitor?.getPlatform?.() || "android" }),
        }).catch(() => {});
      });

      PushNotifications.addListener("registrationError", err => {
        console.error("Notifications: enregistrement refusé", err);
      });

      // Notification touchée alors que l'application était fermée ou en fond :
      // on ouvre directement l'écran concerné plutôt que l'accueil.
      PushNotifications.addListener("pushNotificationActionPerformed", action => {
        const lien = action.notification?.data?.lien;
        if (typeof lien === "string" && lien.startsWith("/")) router.push(lien);
      });

      await PushNotifications.register();
    })();

    return () => { annule = true; };
  }, [router]);

  return null;
}

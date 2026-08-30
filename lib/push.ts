import { createClient } from "@supabase/supabase-js";

/**
 * Envoi de notifications push via Firebase Cloud Messaging, API HTTP v1.
 *
 * L'ancienne API "legacy" à clé serveur est fermée depuis 2024, il faut donc
 * signer un jeton OAuth avec le compte de service Firebase. On le fait à la main
 * plutôt qu'avec firebase-admin : ce paquet tire des dépendances natives qui
 * alourdissent inutilement les fonctions Vercel.
 *
 * Variables d'environnement attendues, issues du JSON de compte de service :
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 */

type ResultatPush = { envoyes: number; echecs: number; sansAppareil: boolean };

let jetonCache: { valeur: string; expire: number } | null = null;

/** Jeton OAuth Google, valable une heure, mis en cache entre deux invocations. */
async function jetonAcces(): Promise<string | null> {
  const email = process.env.FCM_CLIENT_EMAIL;
  const cle = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !cle) return null;

  if (jetonCache && jetonCache.expire > Date.now() + 60_000) return jetonCache.valeur;

  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: "RS256", typ: "JWT" };
  const charge = {
    iss: email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: maintenant,
    exp: maintenant + 3600,
  };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const aSigner = `${b64(entete)}.${b64(charge)}`;

  const { createSign } = await import("crypto");
  const signature = createSign("RSA-SHA256").update(aSigner).sign(cle, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${aSigner}.${signature}`,
    }),
  });
  if (!res.ok) {
    console.error("FCM: obtention du jeton refusée", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  jetonCache = { valeur: json.access_token, expire: Date.now() + json.expires_in * 1000 };
  return jetonCache.valeur;
}

/**
 * Envoie une notification à tous les appareils d'un utilisateur.
 * Ne lève jamais : une notification est un confort, elle ne doit pas faire
 * échouer la réservation ou le cron qui l'a déclenchée.
 */
export async function envoyerPush(
  userId: string,
  titre: string,
  corps: string,
  lien?: string,
): Promise<ResultatPush> {
  const vide: ResultatPush = { envoyes: 0, echecs: 0, sansAppareil: true };
  try {
    const projet = process.env.FCM_PROJECT_ID;
    const jeton = await jetonAcces();
    if (!projet || !jeton) return vide;

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: appareils } = await admin.from("appareils").select("id, token").eq("user_id", userId);
    if (!appareils || appareils.length === 0) return vide;

    let envoyes = 0, echecs = 0;
    const perimes: string[] = [];

    for (const appareil of appareils) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projet}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: appareil.token,
            notification: { title: titre, body: corps },
            data: lien ? { lien } : undefined,
            android: { notification: { sound: "default" } },
          },
        }),
      });
      if (res.ok) { envoyes++; continue; }
      echecs++;
      // 404 et 403 signifient jeton révoqué ou application désinstallée : on
      // purge, sinon la table se remplit de jetons morts qu'on rappelle à vie.
      if (res.status === 404 || res.status === 403) perimes.push(appareil.id);
      else console.error("FCM: envoi refusé", res.status, await res.text());
    }

    if (perimes.length) await admin.from("appareils").delete().in("id", perimes);

    return { envoyes, echecs, sansAppareil: false };
  } catch (e) {
    console.error("FCM: erreur inattendue", e);
    return vide;
  }
}

/** L'utilisateur a-t-il au moins un appareil joignable ? Sert à ne pas payer un
 *  SMS quand une notification gratuite suffit. */
export async function aUnAppareil(userId: string): Promise<boolean> {
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { count } = await admin.from("appareils").select("id", { count: "exact", head: true }).eq("user_id", userId);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

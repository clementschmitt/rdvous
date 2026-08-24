function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Alphabet GSM-7 : 160 caractères par segment. Tout caractère hors de cet
// alphabet (un accent circonflexe, une apostrophe typographique, un emoji…)
// bascule le message entier en UCS-2, où un segment ne fait plus que 70
// caractères. Un message de 155 caractères coûte donc 1 segment sans accent
// et 3 avec. C'est la principale source de surcoût sur les SMS.
const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split("")
);
// Ces caractères existent en GSM-7 mais comptent double.
const GSM7_ETENDU = new Set("^{}\\[~]|€".split(""));

/**
 * Ramène un texte dans l'alphabet GSM-7 : accents retirés, apostrophes et tirets
 * typographiques normalisés, emojis supprimés.
 *
 * Sans cela, un simple « août » ou « décembre » dans la date fait basculer tout
 * le message en UCS-2 et divise par plus de deux la place disponible, ce qui
 * multiplie la facture par trois ou quatre. Un SMS sans accents reste
 * parfaitement lisible et c'est l'usage courant en France.
 */
export function normaliserGsm7(texte: string): string {
  const remplace = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .replace(/[’‘‛]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");

  return [...remplace].filter(c => GSM7.has(c) || GSM7_ETENDU.has(c)).join("");
}

export type InfoSms = {
  /** Longueur facturée après normalisation, caractères étendus comptés double. */
  longueur: number;
  /** Nombre de segments facturés par l'opérateur, donc de crédits débités. */
  segments: number;
  /** Vrai si la normalisation a modifié le texte (accents, emojis, apostrophes). */
  modifie: boolean;
  /** Le texte réellement envoyé. */
  apercu: string;
};

/**
 * Analyse un contenu SMS tel qu'il sera réellement envoyé, c'est-à-dire après
 * normalisation GSM-7. Le nombre de segments renvoyé est exactement ce qui sera
 * débité en crédits.
 */
export function analyserSms(contenu: string): InfoSms {
  const apercu = normaliserGsm7(contenu);

  let longueur = 0;
  for (const c of apercu) longueur += GSM7_ETENDU.has(c) ? 2 : 1;

  const segments = longueur === 0 ? 0 : longueur <= 160 ? 1 : Math.ceil(longueur / 153);

  return { longueur, segments, modifie: apercu !== contenu, apercu };
}

function normalizePhone(tel: string): string | null {
  const digits = tel.replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`;
  if (digits.length === 9) return `+33${digits}`;
  return null;
}

export async function sendSMS({ to, content, sender }: {
  to: string;
  content: string;
  sender?: string;
}): Promise<void> {
  const recipient = normalizePhone(to);
  if (!recipient) {
    console.error("SMS: numéro invalide", to);
    return;
  }
  const senderName = (sender || "rdvous").replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) || "rdvous";
  // Normalisation systématique : c'est le seul endroit qui garantit que tous les
  // envois, quelle que soit leur origine, restent en GSM-7 et donc facturés au
  // tarif d'un segment tant que le texte tient en 160 caractères.
  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: senderName, recipient, content: normaliserGsm7(content) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Brevo SMS error:", res.status, errText);
    throw new Error(`Brevo SMS ${res.status}: ${errText}`);
  }
}

export function smsConfirmation({ prenom, salonNom, dateStr, heureStr, contenu }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  contenu?: string | null;
}): string {
  if (contenu) return interpolate(contenu, { prenom, date: dateStr, heure: heureStr, salon: salonNom });
  return `Bonjour ${prenom}, votre RDV chez ${salonNom} est confirmé le ${dateStr} à ${heureStr}. À bientôt !`;
}

export function smsRappel({ prenom, salonNom, dateStr, heureStr, contenu }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  contenu?: string | null;
}): string {
  if (contenu) return interpolate(contenu, { prenom, date: dateStr, heure: heureStr, salon: salonNom });
  return `Rappel : RDV demain ${dateStr} à ${heureStr} chez ${salonNom}. À bientôt !`;
}

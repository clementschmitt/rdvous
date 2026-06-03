function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
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
  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: senderName, recipient, content }),
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

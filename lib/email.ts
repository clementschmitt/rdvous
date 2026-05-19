export async function sendEmail({ to, toName, subject, html, fromName, fromEmail }: {
  to: string;
  toName: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
}) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName || "rdvous", email: fromEmail || "noreply@rdvous.fr" },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    console.error("Brevo error:", res.status, await res.text());
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function templateConfirmation({ prenom, salonNom, dateStr, heureStr, prestations, contenu }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string; duree_minutes: number; tarif: number }[];
  contenu?: string;
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  const body = contenu
    ? interpolate(contenu, { prenom, date: dateStr, heure: heureStr, prestations: prestationsStr, salon: salonNom })
    : `Bonjour ${prenom}, votre rendez-vous du ${dateStr} à ${heureStr} est confirmé. À bientôt !`;
  const lignes = prestations.map(p => `<li>${p.nom} — ${p.duree_minutes}min — ${p.tarif}€</li>`).join("");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${dateStr} à ${heureStr}</div>
        <div style="color:#666;font-size:14px">${salonNom}</div>
      </div>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${body}</p>
      <ul style="padding-left:20px;margin:16px 0;font-size:14px">${lignes}</ul>
    </div>`;
}

export function templateRappel({ prenom, salonNom, dateStr, heureStr, prestations, contenu }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string }[];
  contenu?: string;
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  const body = contenu
    ? interpolate(contenu, { prenom, date: dateStr, heure: heureStr, prestations: prestationsStr, salon: salonNom })
    : `Bonjour ${prenom}, nous vous rappelons votre rendez-vous demain ${dateStr} à ${heureStr}. À demain !`;
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${dateStr} à ${heureStr}</div>
        <div style="color:#666;font-size:14px">${salonNom}</div>
        ${prestationsStr ? `<div style="color:#444;font-size:14px;margin-top:8px">${prestationsStr}</div>` : ""}
      </div>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${body}</p>
    </div>`;
}

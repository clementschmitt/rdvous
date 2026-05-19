export async function sendEmail({ to, toName, subject, html }: {
  to: string;
  toName: string;
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "rdvous", email: "noreply@rdvous.fr" },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    console.error("Brevo error:", res.status, await res.text());
  }
}

export function templateConfirmation({ prenom, salonNom, dateStr, heureStr, prestations }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string; duree_minutes: number; tarif: number }[];
}) {
  const lignes = prestations.map(p => `<li>${p.nom} — ${p.duree_minutes}min — ${p.tarif}€</li>`).join("");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <h2 style="margin:0 0 8px">Votre rendez-vous est confirmé ✓</h2>
      <p style="color:#666;margin:0 0 24px">Bonjour ${prenom},</p>
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${dateStr} à ${heureStr}</div>
        <div style="color:#666;font-size:14px">${salonNom}</div>
      </div>
      <ul style="padding-left:20px;margin:0 0 24px;font-size:14px">${lignes}</ul>
      <p style="font-size:13px;color:#999">À bientôt !</p>
    </div>`;
}

export function templateRappel({ prenom, salonNom, dateStr, heureStr, prestations }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string }[];
}) {
  const noms = prestations.map(p => p.nom).join(", ");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <h2 style="margin:0 0 8px">Rappel : votre rendez-vous demain</h2>
      <p style="color:#666;margin:0 0 24px">Bonjour ${prenom},</p>
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${dateStr} à ${heureStr}</div>
        <div style="color:#666;font-size:14px">${salonNom}</div>
        ${noms ? `<div style="color:#444;font-size:14px;margin-top:8px">${noms}</div>` : ""}
      </div>
      <p style="font-size:13px;color:#999">À demain !</p>
    </div>`;
}

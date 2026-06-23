export async function sendEmail({ to, toName, subject, html, fromName, replyTo }: {
  to: string;
  toName: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@rdvous.fr";
  const body: Record<string, unknown> = {
    sender: { name: fromName || "rdvous", email: senderEmail },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent: html,
  };
  const replyToClean = replyTo?.trim();
  if (replyToClean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToClean)) body.replyTo = { email: replyToClean };

  const footer = `<div style="font-family:sans-serif;max-width:520px;margin:24px auto 0;padding:16px 24px;border-top:1px solid #f0f0f0;text-align:center;font-size:11px;color:#bbb">Besoin d'aide ? <a href="mailto:support@rdvous.fr" style="color:#bbb">support@rdvous.fr</a></div>`;
  html = html + footer;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Brevo error:", res.status, errText);
    throw new Error(`Brevo ${res.status}: ${errText}`);
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function templateConfirmation({ prenom, salonNom, dateStr, heureStr, prestations, contenu, cancelToken }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string; duree_minutes: number; tarif: number; sur_devis?: boolean }[];
  contenu?: string;
  cancelToken?: string;
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  const totalTarif = prestations.reduce((s, p) => s + p.tarif, 0);
  const hasSurDevis = prestations.some(p => p.sur_devis);
  const tarifStr = hasSurDevis ? (totalTarif > 0 ? `${totalTarif}€ + sur devis` : "Sur devis") : `${totalTarif}€`;
  const body = contenu
    ? interpolate(contenu, { prenom, date: dateStr, heure: heureStr, prestations: prestationsStr, salon: salonNom, tarif: tarifStr })
    : `Bonjour ${prenom}, votre rendez-vous du ${dateStr} à ${heureStr} est confirmé. À bientôt !`;
  const lignes = prestations.map(p => `<li>${p.nom} — ${p.duree_minutes}min — ${p.sur_devis ? "Sur devis" : `${p.tarif}€`}</li>`).join("");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${dateStr} à ${heureStr}</div>
        <div style="color:#666;font-size:14px">${salonNom}</div>
      </div>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${body}</p>
      <ul style="padding-left:20px;margin:16px 0;font-size:14px">${lignes}</ul>
      ${cancelToken ? `<div style="margin-top:24px;text-align:center"><a href="${process.env.NEXT_PUBLIC_APP_URL}/annuler/${cancelToken}" style="font-size:12px;color:#999;text-decoration:underline">Annuler ce rendez-vous</a></div>` : ""}
    </div>`;
}

export function templateCagnotte({ prenom, salonNom, montant, solde }: {
  prenom: string;
  salonNom: string;
  montant: number;
  solde: number;
}) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#fefce8;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #eab308;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">🎉</div>
        <div style="font-size:20px;font-weight:700;color:#1a1a1a">Vous avez gagné ${montant}€ !</div>
        <div style="font-size:14px;color:#666;margin-top:4px">Récompense fidélité — ${salonNom}</div>
      </div>
      <p style="font-size:14px;line-height:1.6">Bonjour ${prenom},</p>
      <p style="font-size:14px;line-height:1.6">Merci pour votre fidélité ! Vous venez de débloquer une récompense de <strong>${montant}€</strong>.</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:14px 18px;margin:20px 0;text-align:center">
        <div style="font-size:12px;color:#999;margin-bottom:4px">Votre solde cagnotte</div>
        <div style="font-size:28px;font-weight:700;color:#1a1a1a">${solde}€</div>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#666">Mentionnez votre cagnotte lors de votre prochain rendez-vous chez <strong>${salonNom}</strong> pour en bénéficier.</p>
    </div>`;
}

export function templateNouveauRdv({ clientPrenom, clientNom, clientTel, clientEmail, dateStr, heureStr, prestations, adresseDomicile }: {
  clientPrenom: string;
  clientNom: string;
  clientTel: string;
  clientEmail: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string; duree_minutes: number; tarif: number; sur_devis?: boolean }[];
  adresseDomicile?: string | null;
}) {
  const lignes = prestations.map(p => `<li>${p.nom} — ${p.duree_minutes}min — ${p.sur_devis ? "Sur devis" : `${p.tarif}€`}</li>`).join("");
  const domicile = adresseDomicile ? `<p style="font-size:13px;color:#666;margin-top:12px">📍 À domicile : ${adresseDomicile}</p>` : "";
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #22c55e">
        <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:4px">Nouveau rendez-vous reçu</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr} à ${heureStr}</div>
      </div>
      <p style="font-size:14px;margin-bottom:6px"><strong>Client :</strong> ${clientPrenom} ${clientNom}</p>
      <p style="font-size:14px;margin-bottom:6px"><strong>Téléphone :</strong> <a href="tel:${clientTel}" style="color:#1a1a1a">${clientTel}</a></p>
      ${clientEmail ? `<p style="font-size:14px;margin-bottom:6px"><strong>Email :</strong> <a href="mailto:${clientEmail}" style="color:#1a1a1a">${clientEmail}</a></p>` : ""}
      <ul style="padding-left:20px;margin:16px 0;font-size:14px">${lignes}</ul>
      ${domicile}
    </div>`;
}

export function templateAnnulation({ prenom, salonNom, dateStr, heureStr, prestations }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string }[];
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#fef2f2;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #e74c3c">
        <div style="font-size:15px;font-weight:700;color:#c0392b;margin-bottom:4px">Rendez-vous annulé</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr} à ${heureStr}</div>
        <div style="font-size:14px;color:#666;margin-top:4px">${salonNom}</div>
      </div>
      <p style="font-size:14px;line-height:1.6">Bonjour ${prenom},</p>
      <p style="font-size:14px;line-height:1.6">Nous vous informons que votre rendez-vous du <strong>${dateStr} à ${heureStr}</strong> chez <strong>${salonNom}</strong> a été annulé.</p>
      ${prestationsStr ? `<p style="font-size:14px;color:#666;margin:0">Prestation(s) : ${prestationsStr}</p>` : ""}
      <p style="font-size:14px;line-height:1.6;color:#666;margin-top:16px">Nous vous invitons à reprendre rendez-vous dès que possible. Toutes nos excuses pour la gêne occasionnée.</p>
    </div>`;
}

export function templateRelance({ prenom, salonNom, contenu }: {
  prenom: string;
  salonNom: string;
  contenu?: string;
}) {
  const body = contenu
    ? interpolate(contenu, { prenom, salon: salonNom })
    : `Bonjour ${prenom},\n\nCela fait un moment que nous ne vous avons pas vu(e) !\n\nNous serions ravis de vous retrouver très bientôt.\n\nÀ bientôt,\n${salonNom}`;
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${body}</p>
    </div>`;
}

export function templateDeplacement({ prenom, salonNom, ancienDateStr, ancienHeureStr, nouveauDateStr, nouveauHeureStr, prestations }: {
  prenom: string;
  salonNom: string;
  ancienDateStr: string;
  ancienHeureStr: string;
  nouveauDateStr: string;
  nouveauHeureStr: string;
  prestations: { nom: string }[];
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
      <div style="background:#fffbeb;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #f59e0b">
        <div style="font-size:15px;font-weight:700;color:#b45309;margin-bottom:4px">Rendez-vous déplacé</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px">${nouveauDateStr} à ${nouveauHeureStr}</div>
        <div style="font-size:14px;color:#666;margin-top:4px">${salonNom}</div>
      </div>
      <p style="font-size:14px;line-height:1.6">Bonjour ${prenom},</p>
      <p style="font-size:14px;line-height:1.6">Votre rendez-vous initialement prévu le <strong>${ancienDateStr} à ${ancienHeureStr}</strong> a été déplacé au <strong>${nouveauDateStr} à ${nouveauHeureStr}</strong> chez <strong>${salonNom}</strong>.</p>
      ${prestationsStr ? `<p style="font-size:14px;color:#666;margin:0">Prestation(s) : ${prestationsStr}</p>` : ""}
      <p style="font-size:14px;line-height:1.6;color:#666;margin-top:16px">Si vous avez des questions, n'hésitez pas à contacter ${salonNom} directement.</p>
    </div>`;
}

export function templateRappel({ prenom, salonNom, dateStr, heureStr, prestations, contenu }: {
  prenom: string;
  salonNom: string;
  dateStr: string;
  heureStr: string;
  prestations: { nom: string; tarif?: number; sur_devis?: boolean }[];
  contenu?: string;
}) {
  const prestationsStr = prestations.map(p => p.nom).join(", ");
  const totalTarif = prestations.reduce((s, p) => s + (p.tarif ?? 0), 0);
  const hasSurDevis = prestations.some(p => p.sur_devis);
  const tarifStr = hasSurDevis ? (totalTarif > 0 ? `${totalTarif}€ + sur devis` : "Sur devis") : `${totalTarif}€`;
  const body = contenu
    ? interpolate(contenu, { prenom, date: dateStr, heure: heureStr, prestations: prestationsStr, salon: salonNom, tarif: tarifStr })
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

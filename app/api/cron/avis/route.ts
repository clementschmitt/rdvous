import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const now = new Date();
  // Le cron ne tourne qu'une fois par jour (plan Vercel Hobby). La fenêtre doit donc
  // couvrir toute la journée écoulée, et non l'heure précédente comme à l'origine.
  // 48h de recul laissent de quoi rattraper une exécution manquée sans jamais
  // remonter à des rendez-vous trop anciens pour qu'une demande d'avis ait du sens.
  //
  // ?heures=N permet un rattrapage ponctuel sur une période plus longue, par exemple
  // après une panne. Plafonné à 30 jours pour ne jamais réveiller de vieux rendez-vous.
  const heuresParam = parseInt(req.nextUrl.searchParams.get("heures") || "48");
  const heures = Math.min(Math.max(Number.isFinite(heuresParam) ? heuresParam : 48, 1), 720);

  const au_plus_tard = now.toISOString();
  const au_plus_tot = new Date(now.getTime() - heures * 3600 * 1000).toISOString();

  // ?salon_id=... restreint le passage à un seul salon, pour tester sans toucher aux autres.
  const salonFiltre = req.nextUrl.searchParams.get("salon_id");

  // On filtre sur l'heure de DÉBUT en base, puis sur l'heure de FIN en mémoire.
  // Un rendez-vous de deux heures commencé il y a une heure et demie n'est pas
  // terminé : solliciter le client pendant qu'il est encore dans le fauteuil
  // serait le meilleur moyen de récolter un mauvais avis.
  let requete = admin
    .from("rendez_vous")
    .select("id, salon_id, client_id, date_heure, duree_minutes, clients(prenom, email), salons(nom), rendez_vous_prestations(prestations(duree_minutes))")
    .lt("date_heure", au_plus_tard)
    .gt("date_heure", au_plus_tot)
    .eq("statut", "effectue")
    .is("avis_demande_le", null);

  if (salonFiltre) requete = requete.eq("salon_id", salonFiltre);

  const { data: bruts } = await requete.order("date_heure", { ascending: true }).limit(300);

  // Le rendez-vous doit être terminé depuis au moins une heure.
  const limiteFin = now.getTime() - 1 * 3600 * 1000;
  const rdvs = (bruts || []).filter(r => {
    const liens = (r.rendez_vous_prestations || []) as unknown as { prestations: { duree_minutes: number } | null }[];
    const duree = r.duree_minutes || liens.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
    return new Date(r.date_heure).getTime() + duree * 60000 <= limiteFin;
  }).slice(0, 200);

  if (rdvs.length === 0) return NextResponse.json({ ok: true, sent: 0, heures, candidats: 0, ecartes_non_termines: (bruts || []).length });

  // ── Qui ne doit PAS être sollicité ────────────────────────────────────────
  // Un client n'est sollicité QU'UNE SEULE FOIS, jamais deux. Ils reviennent
  // toutes les 3 à 4 semaines : sans cette règle elles recevraient une demande
  // à chaque passage, à vie.
  const clientIds = [...new Set(rdvs.map(r => r.client_id).filter(Boolean))] as string[];

  const { data: dejaSollicites } = await admin
    .from("rendez_vous")
    .select("client_id")
    .in("client_id", clientIds)
    .not("avis_demande_le", "is", null);

  const dejaSollicite = new Set(
    ((dejaSollicites || []) as { client_id: string | null }[]).map(r => r.client_id).filter(Boolean) as string[]
  );

  let sent = 0;
  let ignoresDejaSollicites = 0;

  for (const rdv of rdvs) {
    const client = rdv.clients as unknown as { prenom: string; email: string | null } | null;
    const salon = rdv.salons as unknown as { nom: string } | null;
    if (!client?.email) continue;

    if (rdv.client_id && dejaSollicite.has(rdv.client_id)) { ignoresDejaSollicites++; continue; }

    // Créer l'avis (en attente de note)
    const { data: avis, error } = await admin
      .from("avis")
      .insert({ salon_id: rdv.salon_id, rdv_id: rdv.id })
      .select("id, token")
      .single();

    if (error || !avis) { console.error("Avis insert error:", error); continue; }

    const lien = `${process.env.NEXT_PUBLIC_APP_URL}/avis/${avis.token}`;
    const salonNom = salon?.nom || "votre salon";

    try {
      await sendEmail({
        to: client.email,
        toName: client.prenom,
        subject: `Comment s'est passé votre RDV chez ${salonNom} ?`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
          <p style="font-size:15px">Bonjour ${client.prenom},</p>
          <p style="font-size:14px;line-height:1.6">Merci pour votre visite chez <strong>${salonNom}</strong>. Votre avis nous aide à améliorer notre service.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${lien}" style="display:inline-block;padding:14px 28px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:9px;font-size:15px;font-weight:700">
              ★ Laisser un avis
            </a>
          </div>
          <p style="font-size:13px;color:#888">Cela prend moins d'une minute.</p>
        </div>`,
        fromName: salonNom,
      });

      await admin.from("rendez_vous").update({ avis_demande_le: now.toISOString() }).eq("id", rdv.id);
      // Une seule demande par client et par passage, même s'il a plusieurs RDV dans la fenêtre
      if (rdv.client_id) dejaSollicite.add(rdv.client_id);
      sent++;
    } catch (e) {
      console.error("Avis email failed:", e);
      // Supprimer l'avis créé si l'email échoue, pour pouvoir réessayer au prochain passage
      await admin.from("avis").delete().eq("id", avis.id);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    heures,
    candidats: rdvs.length,
    ecartes_non_termines: (bruts || []).length - rdvs.length,
    ignores_deja_sollicites: ignoresDejaSollicites,
  });
}

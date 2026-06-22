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
  const il_y_a_1h = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();
  const il_y_a_2h = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();

  // RDVs passés entre 1h et 2h, non annulés, sans demande d'avis envoyée
  const { data: rdvs } = await admin
    .from("rendez_vous")
    .select("id, salon_id, date_heure, clients(prenom, email), salons(nom), avis_demande_le")
    .lt("date_heure", il_y_a_1h)
    .gt("date_heure", il_y_a_2h)
    .eq("statut", "effectue")
    .is("avis_demande_le", null);

  if (!rdvs || rdvs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const rdv of rdvs) {
    const client = rdv.clients as unknown as { prenom: string; email: string | null } | null;
    const salon = rdv.salons as unknown as { nom: string } | null;
    if (!client?.email) continue;

    // Créer l'avis (en attente de note)
    const { data: avis, error } = await admin
      .from("avis")
      .insert({ salon_id: rdv.salon_id, rdv_id: rdv.id })
      .select("token")
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
      sent++;
    } catch (e) {
      console.error("Avis email failed:", e);
      // Supprimer l'avis créé si l'email échoue pour pouvoir réessayer
      await admin.from("avis").delete().eq("id", avis.token);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

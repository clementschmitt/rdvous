import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("id, date_heure, statut, salon_id, salons(nom), clients(prenom, nom), rendez_vous_prestations(prestations(nom))")
    .eq("cancel_token", token)
    .single();

  if (!rdv) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  if (rdv.statut === "annule") return NextResponse.json({ error: "Ce rendez-vous est déjà annulé." }, { status: 400 });

  const rdvDate = new Date(rdv.date_heure);
  const diffH = (rdvDate.getTime() - Date.now()) / 3600000;
  if (diffH < 2) return NextResponse.json({ error: "Impossible d'annuler moins de 2h avant le rendez-vous." }, { status: 400 });

  await admin.from("rendez_vous").update({ statut: "annule" }).eq("id", rdv.id);

  const salon = rdv.salons as unknown as { nom: string } | null;
  const client = rdv.clients as unknown as { prenom: string; nom: string } | null;
  const prestations = (rdv.rendez_vous_prestations as unknown as { prestations: { nom: string } | null }[]).map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
  const dateStr = rdvDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heureStr = rdv.date_heure.slice(11, 16);

  const { data: settings } = await admin.from("app_settings").select("email_expediteur, email_reception, email_expediteur_nom").eq("salon_id", rdv.salon_id).single();
  let artisanEmail = settings?.email_reception?.trim() || settings?.email_expediteur?.trim() || null;
  if (!artisanEmail) {
    const { data: su } = await admin.from("salon_users").select("user_id").eq("salon_id", rdv.salon_id).limit(1).single();
    if (su?.user_id) {
      const { data: { user } } = await admin.auth.admin.getUserById(su.user_id);
      artisanEmail = user?.email || null;
    }
  }

  if (artisanEmail) {
    try {
      await sendEmail({
        to: artisanEmail,
        toName: settings?.email_expediteur_nom || salon?.nom || "rdvous",
        subject: `Annulation — ${client?.prenom || ""} ${client?.nom || ""} · ${dateStr} à ${heureStr}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222">
          <div style="background:#fef2f2;border-radius:10px;padding:20px;margin-bottom:24px;border-left:4px solid #ef4444">
            <div style="font-size:16px;font-weight:700;color:#dc2626">Rendez-vous annulé</div>
            <div style="font-size:22px;font-weight:700;margin-top:8px">${dateStr} à ${heureStr}</div>
          </div>
          <p style="font-size:14px"><strong>Client :</strong> ${client?.prenom || ""} ${client?.nom || ""}</p>
          ${prestations ? `<p style="font-size:14px"><strong>Prestations :</strong> ${prestations}</p>` : ""}
        </div>`,
        fromName: "rdvous",
      });
    } catch (e) {
      console.error("Cancel notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, salon_nom: salon?.nom, dateStr, heureStr });
}

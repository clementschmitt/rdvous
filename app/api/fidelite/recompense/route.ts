import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateCagnotte } from "@/lib/email";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { salon_id, client_id, montant } = await req.json();
  if (!salon_id || !client_id || !montant) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: client }, { data: salon }] = await Promise.all([
    admin.from("clients").select("prenom, email, cagnotte").eq("id", client_id).single(),
    admin.from("salons").select("nom").eq("id", salon_id).single(),
  ]);

  if (!client?.email) return NextResponse.json({ ok: true, skipped: "no_email" });

  try {
    await sendEmail({
      to: client.email,
      toName: client.prenom,
      subject: `🎉 Vous avez gagné ${montant}€ de cagnotte, ${salon?.nom || "rdvous"}`,
      html: templateCagnotte({ prenom: client.prenom, salonNom: salon?.nom || "", montant, solde: client.cagnotte }),
      fromName: salon?.nom || "rdvous",
    });
  } catch (e) {
    console.error("Cagnotte email failed:", e);
  }

  return NextResponse.json({ ok: true });
}

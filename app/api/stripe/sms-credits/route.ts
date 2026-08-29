import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { packSms } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { salon_id, pack } = await req.json();
  const packChoisi = packSms(Number(pack));
  if (!salon_id || !packChoisi) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });

  // Le propriétaire du salon, ou l'exploitant en mode override admin, qui n'est
  // rattaché à aucun salon dans salon_users mais doit pouvoir dépanner ses clients.
  const estAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  if (!estAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).maybeSingle();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: salon } = await admin.from("salons").select("nom, email, stripe_customer_id").eq("id", salon_id).single();
  if (!salon) return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });

  let customerId = salon.stripe_customer_id;
  if (!customerId) {
    // L'email du salon prime : en mode override c'est celui du client qu'il
    // faut rattacher au client Stripe, pas celui de l'exploitant.
    const customer = await stripe.customers.create({ email: salon.email || user.email, name: salon.nom, metadata: { salon_id } });
    customerId = customer.id;
    await admin.from("salons").update({ stripe_customer_id: customerId }).eq("id", salon_id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: packChoisi.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/parametres?sms_recharged=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/parametres`,
    metadata: { salon_id, type: "sms_credits", sms_amount: String(packChoisi.credits) },
  });

  return NextResponse.json({ url: session.url });
}

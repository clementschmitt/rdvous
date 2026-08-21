import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lire le body en premier
  const body = await req.json().catch(() => ({}));
  const interval = body.interval || "monthly";
  const salonIdFromClient = body.salon_id;

  // Résoudre le salon : passé par le client ou via salon_users
  let salonId = salonIdFromClient;
  if (!salonId) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).single();
    salonId = su?.salon_id;
  }
  if (!salonId) return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });

  const { data: salon } = await admin
    .from("salons")
    .select("id, nom, stripe_customer_id, stripe_subscription_id, plan")
    .eq("id", salonId)
    .single();

  if (!salon) return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });
  const targetPlan = body.plan || "pro"; // "pro" ou "business"
  // On refuse uniquement si un abonnement Stripe couvre déjà ce plan.
  // Un plan posé à la main (compte offert, pilote) doit rester activable.
  if (salon.plan === targetPlan && salon.stripe_subscription_id) {
    return NextResponse.json({ error: "Déjà sur ce plan" }, { status: 400 });
  }

  let customerId = salon.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: salon.nom,
      metadata: { salon_id: salon.id },
    });
    customerId = customer.id;
    await admin.from("salons").update({ stripe_customer_id: customerId }).eq("id", salon.id);
  }

  const priceId = targetPlan === "business"
    ? (interval === "yearly" ? process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY! : process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY!)
    : (interval === "yearly" ? process.env.STRIPE_PRICE_ID_PRO_YEARLY! : process.env.STRIPE_PRICE_ID_PRO_MONTHLY!);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/parametres?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/parametres?cancelled=1`,
    metadata: { salon_id: salon.id },
    subscription_data: { metadata: { salon_id: salon.id } },
  });

  return NextResponse.json({ url: session.url });
}

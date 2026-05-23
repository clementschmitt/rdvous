import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.CheckoutSession;
    const salonId = session.metadata?.salon_id;
    if (salonId) {
      await admin.from("salons").update({
        plan: "solo",
        stripe_subscription_id: session.subscription as string,
      }).eq("id", salonId);
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const salonId = sub.metadata?.salon_id;
    if (salonId) {
      const plan = sub.status === "active" ? "solo" : "free";
      await admin.from("salons").update({ plan }).eq("id", salonId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const salonId = sub.metadata?.salon_id;
    if (salonId) {
      await admin.from("salons").update({ plan: "free", stripe_subscription_id: null }).eq("id", salonId);
    }
  }

  return NextResponse.json({ received: true });
}

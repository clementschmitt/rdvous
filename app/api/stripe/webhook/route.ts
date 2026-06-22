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
    const session = event.data.object as Stripe.Checkout.Session;
    const salonId = session.metadata?.salon_id;
    if (salonId) {
      if (session.metadata?.type === "sms_credits") {
        const smsAmount = parseInt(session.metadata?.sms_amount || "0");
        if (smsAmount > 0) await admin.rpc("add_sms_credits", { p_salon_id: salonId, p_amount: smsAmount });
      } else {
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price.id;
        const plan = [process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY, process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY].includes(priceId) ? "business" : "pro";
        await admin.from("salons").update({ plan, stripe_subscription_id: subId }).eq("id", salonId);
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const salonId = sub.metadata?.salon_id;
    if (salonId) {
      if (sub.status === "active") {
        const priceId = sub.items.data[0]?.price.id;
        const plan = [process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY, process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY].includes(priceId) ? "business" : "pro";
        await admin.from("salons").update({ plan }).eq("id", salonId);
      } else {
        await admin.from("salons").update({ plan: "free" }).eq("id", salonId);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const salonId = sub.metadata?.salon_id;
    if (salonId) {
      await admin.from("salons").update({ plan: "free", stripe_subscription_id: null, sms_credits: 0 }).eq("id", salonId);
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
    const sub = invoice.subscription;
    if (sub && invoice.billing_reason === "subscription_cycle") {
      const { data: salon } = await admin.from("salons").select("id, sms_credits").eq("stripe_subscription_id", sub as string).single();
      if (salon) {
        const newCredits = Math.min((salon.sms_credits ?? 0) + 50, 150);
        await admin.from("salons").update({ sms_credits: newCredits }).eq("id", salon.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}

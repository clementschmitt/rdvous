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

  const { data: su } = await admin
    .from("salon_users")
    .select("salon_id")
    .eq("user_id", user.id)
    .single();

  if (!su) return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });

  const { data: salon } = await admin
    .from("salons")
    .select("stripe_customer_id")
    .eq("id", su.salon_id)
    .single();

  if (!salon?.stripe_customer_id) return NextResponse.json({ error: "Aucun abonnement actif" }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: salon.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/parametres`,
  });

  return NextResponse.json({ url: session.url });
}

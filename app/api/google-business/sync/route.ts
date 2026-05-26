import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { salon_id, place_id } = await req.json();
  if (!salon_id || !place_id?.trim()) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY non configurée" }, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (user.email !== ADMIN_EMAIL) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const gRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id.trim())}&fields=rating,user_ratings_total&key=${apiKey}`
  );
  const gData = await gRes.json() as { status: string; result?: { rating?: number; user_ratings_total?: number } };

  if (gData.status !== "OK") {
    const messages: Record<string, string> = {
      NOT_FOUND: "Place ID introuvable — vérifiez l'identifiant.",
      REQUEST_DENIED: "Clé API invalide ou Places API non activée.",
      INVALID_REQUEST: "Place ID invalide.",
    };
    return NextResponse.json({ error: messages[gData.status] || `Google Places: ${gData.status}` }, { status: 400 });
  }

  const note = gData.result?.rating ?? null;
  const nb_avis = gData.result?.user_ratings_total ?? null;

  await admin.from("app_settings")
    .upsert({ salon_id, google_place_id: place_id.trim(), google_note: note, google_nb_avis: nb_avis }, { onConflict: "salon_id" });

  return NextResponse.json({ ok: true, note, nb_avis });
}

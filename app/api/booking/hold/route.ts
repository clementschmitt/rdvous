import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { holdLimiter, getIP } from "@/lib/ratelimit";

/**
 * Durée du verrou, fixe et sans prolongation automatique : un décompte qui
 * remonterait tout seul serait incompréhensible pour la cliente.
 *
 * Dix minutes laissent largement le temps de saisir ses coordonnées, même
 * interrompue. Le prix à payer est qu'un abandon gèle le créneau jusqu'à
 * l'échéance, d'où la libération immédiate au retour au calendrier et à la
 * fermeture de l'onglet.
 */
const DUREE_VERROU_MINUTES = 10;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Pose ou prolonge un verrou sur un créneau. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const { success } = await holdLimiter.limit(getIP(req));
    // Sans plafond, une seule IP pourrait geler un agenda entier en boucle.
    if (!success) return NextResponse.json({ error: "Trop de tentatives." }, { status: 429 });
  }

  const { salon_id, date, heure, duree_minutes, cle_session } = await req.json();
  if (!salon_id || !date || !heure || !cle_session) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }
  const duree = Number(duree_minutes) > 0 ? Number(duree_minutes) : 60;

  // Vérification et insertion dans une seule transaction, sérialisée par salon.
  // La version précédente lisait puis écrivait depuis ici, et trois clientes ont
  // obtenu le même créneau à quatorze millisecondes d'intervalle.
  const { data: expireLe, error } = await admin().rpc("poser_verrou_creneau", {
    p_salon_id: salon_id,
    p_date_heure: `${date}T${heure}:00`,
    p_duree_minutes: duree,
    p_cle_session: cle_session,
    p_minutes: DUREE_VERROU_MINUTES,
  });

  if (error) {
    if (error.message?.includes("CONFLIT_VERROU")) {
      return NextResponse.json({ error: "Ce créneau vient d'être sélectionné par quelqu'un d'autre." }, { status: 409 });
    }
    if (error.message?.includes("CONFLIT_CRENEAU")) {
      return NextResponse.json({ error: "Ce créneau n'est plus disponible." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expire_le: expireLe, duree_verrou_minutes: DUREE_VERROU_MINUTES });
}

/** Libère le verrou quand la cliente revient au calendrier ou quitte la page. */
export async function DELETE(req: NextRequest) {
  const { cle_session } = await req.json().catch(() => ({ cle_session: null }));
  if (!cle_session) return NextResponse.json({ ok: true });
  await admin().from("creneaux_bloques").delete().eq("cle_session", cle_session);
  return NextResponse.json({ ok: true });
}

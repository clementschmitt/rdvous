import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { client_a_id, client_b_id, salon_id } = await req.json();
  if (!client_a_id || !client_b_id || !salon_id) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  if (client_a_id === client_b_id) return NextResponse.json({ error: "Même fiche" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Vérifier que les deux clients appartiennent bien à ce salon
  const [{ data: ca }, { data: cb }] = await Promise.all([
    admin.from("clients").select("*").eq("id", client_a_id).eq("salon_id", salon_id).single(),
    admin.from("clients").select("*").eq("id", client_b_id).eq("salon_id", salon_id).single(),
  ]);
  if (!ca || !cb) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Déterminer le master : celui qui a le RDV le plus ancien
  const [{ data: rdvA }, { data: rdvB }] = await Promise.all([
    admin.from("rendez_vous").select("date_heure").eq("client_id", client_a_id).order("date_heure", { ascending: true }).limit(1).maybeSingle(),
    admin.from("rendez_vous").select("date_heure").eq("client_id", client_b_id).order("date_heure", { ascending: true }).limit(1).maybeSingle(),
  ]);

  let masterId: string;
  let duplicateId: string;

  if (!rdvA && !rdvB) {
    // Aucun RDV : garde le plus ancien compte (created_at)
    const [{ data: caFull }, { data: cbFull }] = await Promise.all([
      admin.from("clients").select("created_at").eq("id", client_a_id).single(),
      admin.from("clients").select("created_at").eq("id", client_b_id).single(),
    ]);
    masterId = (caFull?.created_at || "") <= (cbFull?.created_at || "") ? client_a_id : client_b_id;
  } else if (!rdvA) {
    masterId = client_b_id;
  } else if (!rdvB) {
    masterId = client_a_id;
  } else {
    masterId = rdvA.date_heure <= rdvB.date_heure ? client_a_id : client_b_id;
  }
  duplicateId = masterId === client_a_id ? client_b_id : client_a_id;

  const master = masterId === client_a_id ? ca : cb;
  const duplicate = duplicateId === client_a_id ? ca : cb;

  // Transférer les RDVs
  await admin.from("rendez_vous").update({ client_id: masterId }).eq("client_id", duplicateId);

  // Transférer les mouvements cagnotte
  await admin.from("cagnotte_mouvements").update({ client_id: masterId }).eq("client_id", duplicateId);

  // Construire la mise à jour du master : prend la valeur du doublon si le master n'en a pas
  const pick = (a: string | null, b: string | null) => a?.trim() || b?.trim() || null;

  const updates: Record<string, unknown> = {
    // Champs numériques : on additionne
    cagnotte: (master.cagnotte || 0) + (duplicate.cagnotte || 0),
    nb_visites: (master.nb_visites || 0) + (duplicate.nb_visites || 0),
    // Champs texte : master en priorité, doublon en fallback
    email:        pick(master.email, duplicate.email),
    telephone:    pick(master.telephone, duplicate.telephone),
    adresse:      pick(master.adresse, duplicate.adresse),
    code_postal:  pick(master.code_postal, duplicate.code_postal),
    ville:        pick(master.ville, duplicate.ville),
    date_naissance: master.date_naissance || duplicate.date_naissance || null,
    preferences:  pick(master.preferences, duplicate.preferences),
    parrain_id:   master.parrain_id || duplicate.parrain_id || null,
    // Notes : concaténer si les deux ont quelque chose de différent
    notes: (() => {
      const a = master.notes?.trim() || "";
      const b = duplicate.notes?.trim() || "";
      if (!a) return b || null;
      if (!b || a === b) return a;
      return `${a}\n---\n${b}`;
    })(),
    // champs_metier : fusion des deux objets JSON (master prioritaire en cas de conflit de clé)
    champs_metier: { ...(duplicate.champs_metier || {}), ...(master.champs_metier || {}) },
  };

  await admin.from("clients").update(updates).eq("id", masterId);

  // Supprimer le doublon
  await admin.from("clients").delete().eq("id", duplicateId);

  return NextResponse.json({ ok: true, master_id: masterId });
}

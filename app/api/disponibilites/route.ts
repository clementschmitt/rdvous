import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, templateAnnulation } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { salon_id, action } = body;
  if (!salon_id) return NextResponse.json({ error: "salon_id manquant" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const isAdmin = user.email === ADMIN_EMAIL;
  if (!isAdmin) {
    const { data: su } = await admin.from("salon_users").select("salon_id").eq("user_id", user.id).eq("salon_id", salon_id).single();
    if (!su) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (action === "save_dispos") {
    const { rows } = body as { rows: { jour_semaine: number; heure_debut: string; heure_fin: string }[] };
    await admin.from("disponibilites").delete().eq("salon_id", salon_id);
    if (rows && rows.length > 0) {
      const { error } = await admin.from("disponibilites").insert(rows.map(r => ({ ...r, salon_id })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "add_conge") {
    const { date_debut, date_fin, libelle } = body;
    const { error } = await admin.from("conges").insert({ salon_id, date_debut, date_fin, libelle: libelle || "" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_conge") {
    const { id } = body;
    const { error } = await admin.from("conges").delete().eq("id", id).eq("salon_id", salon_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "upsert_exceptions_bulk") {
    const { exceptions } = body as { exceptions: { date: string; ferme: boolean; plages: { heure_debut: string; heure_fin: string }[] }[] };
    if (!exceptions || exceptions.length === 0) return NextResponse.json({ ok: true });
    // INSERT ... ON CONFLICT DO NOTHING : ne jamais écraser un jour_unique existant
    const { error } = await admin.from("disponibilites_exceptions")
      .insert(exceptions.map(ex => ({ salon_id, date: ex.date, ferme: ex.ferme, plages: ex.plages, type: "periode" })), { ignoreDuplicates: true } as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "upsert_exception") {
    const { date, ferme, plages } = body;
    if (!date) return NextResponse.json({ error: "date manquante" }, { status: 400 });
    // Jour unique = toujours prioritaire, écrase tout
    const { error } = await admin.from("disponibilites_exceptions")
      .upsert({ salon_id, date, ferme: ferme ?? false, plages: plages ?? [], type: "jour_unique" }, { onConflict: "salon_id,date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_exception") {
    const { id } = body;
    const { error } = await admin.from("disponibilites_exceptions").delete().eq("id", id).eq("salon_id", salon_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "check_conflicts") {
    const { dates } = body as { dates: string[] };
    if (!dates || dates.length === 0) return NextResponse.json({ rdvs: [] });
    const sorted = [...dates].sort();
    const { data: rdvs } = await admin
      .from("rendez_vous")
      .select("id, date_heure, clients(prenom, nom, telephone, email), rendez_vous_prestations(prestations(nom))")
      .eq("salon_id", salon_id)
      .eq("statut", "planifie")
      .gte("date_heure", `${sorted[0]}T00:00:00`)
      .lte("date_heure", `${sorted[sorted.length - 1]}T23:59:59`);
    const datesSet = new Set(dates);
    const filtered = (rdvs || []).filter((r: { date_heure: string }) => datesSet.has(r.date_heure.slice(0, 10)));
    return NextResponse.json({ rdvs: filtered });
  }

  if (action === "annuler_rdvs_bulk") {
    const { rdv_ids } = body as { rdv_ids: string[] };
    if (!rdv_ids || rdv_ids.length === 0) return NextResponse.json({ ok: true });

    type RdvFull = {
      id: string; date_heure: string;
      clients: { prenom: string; nom: string; email: string | null } | null;
      rendez_vous_prestations: { prestations: { nom: string } | null }[];
    };
    const { data: rdvs } = await admin
      .from("rendez_vous")
      .select("id, date_heure, clients(prenom, nom, email), rendez_vous_prestations(prestations(nom))")
      .in("id", rdv_ids)
      .eq("salon_id", salon_id);

    const { data: salonRow } = await admin.from("salons").select("nom").eq("id", salon_id).single();
    const salonNom = salonRow?.nom || "le salon";

    await admin.from("rendez_vous").update({ statut: "annule" }).in("id", rdv_ids).eq("salon_id", salon_id);

    await Promise.allSettled(((rdvs || []) as unknown as RdvFull[]).map(async rdv => {
      const client = rdv.clients;
      if (!client?.email) return;
      const dt = new Date(rdv.date_heure);
      const dateStr = dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const heureStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const prestations = rdv.rendez_vous_prestations.map(rp => ({ nom: rp.prestations?.nom || "" })).filter(p => p.nom);
      await sendEmail({
        to: client.email,
        toName: `${client.prenom} ${client.nom}`,
        subject: `Rendez-vous annulé, ${dateStr} à ${heureStr}`,
        html: templateAnnulation({ prenom: client.prenom, salonNom, dateStr, heureStr, prestations }),
        fromName: salonNom,
      });
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

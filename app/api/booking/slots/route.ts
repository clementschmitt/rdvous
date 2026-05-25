import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const salon_id = searchParams.get("salon_id");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const duree = parseInt(searchParams.get("duree") || "60");

  if (!salon_id || !date) return NextResponse.json({ slots: [] });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const jourSemaine = (new Date(date + "T12:00:00").getDay() + 6) % 7; // 0=lundi

  const [{ data: plages }, { data: rdvs }] = await Promise.all([
    admin.from("disponibilites").select("heure_debut, heure_fin").eq("salon_id", salon_id).eq("jour_semaine", jourSemaine),
    admin.from("rendez_vous")
      .select("date_heure, duree_minutes, rendez_vous_prestations(prestations(duree_minutes))")
      .eq("salon_id", salon_id)
      .eq("statut", "confirme")
      .gte("date_heure", `${date}T00:00:00`)
      .lte("date_heure", `${date}T23:59:59`),
  ]);

  if (!plages || plages.length === 0) return NextResponse.json({ slots: [] });

  type RdvRow = { date_heure: string; duree_minutes: number | null; rendez_vous_prestations: { prestations: { duree_minutes: number } | null }[] };
  const occupes: { debut: number; fin: number }[] = ((rdvs || []) as unknown as RdvRow[]).map((r: RdvRow) => {
    const debut = toMinutes(r.date_heure.slice(11, 16));
    const dureeRdv = r.duree_minutes || r.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0) || 60;
    return { debut, fin: debut + dureeRdv };
  });

  const slots: string[] = [];
  for (const plage of plages) {
    const debut = toMinutes(plage.heure_debut.slice(0, 5));
    const fin = toMinutes(plage.heure_fin.slice(0, 5));
    for (let t = debut; t + duree <= fin; t += 15) {
      const slotFin = t + duree;
      const libre = !occupes.some(o => o.debut < slotFin && o.fin > t);
      if (libre) slots.push(fromMinutes(t));
    }
  }

  return NextResponse.json({ slots });
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

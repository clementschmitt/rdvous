import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const salonId = req.nextUrl.searchParams.get("salon_id");

  if (salonId) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const period = req.nextUrl.searchParams.get("period") || "month"; // today | week | month
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const perPage = 25;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const periodStart = period === "today" ? `${todayStr}T00:00:00`
      : period === "week" ? weekStart.toISOString()
      : monthStart.toISOString();
    const periodEnd = period === "today" ? `${todayStr}T23:59:59` : undefined;

    const [rdvsToday, rdvsWeek, rdvsMonth, rdvsRecent] = await Promise.all([
      admin.from("rendez_vous").select("id, source").eq("salon_id", salonId).gte("date_heure", `${todayStr}T00:00:00`).lte("date_heure", `${todayStr}T23:59:59`).neq("statut", "annule"),
      admin.from("rendez_vous").select("id, source").eq("salon_id", salonId).gte("date_heure", weekStart.toISOString()).neq("statut", "annule"),
      admin.from("rendez_vous").select("id, source").eq("salon_id", salonId).gte("date_heure", monthStart.toISOString()).neq("statut", "annule"),
      (() => {
        let q = admin.from("rendez_vous").select("id, date_heure, statut, source, created_at, clients(prenom, nom, email)", { count: "exact" })
          .eq("salon_id", salonId).gte("date_heure", periodStart).neq("statut", "annule").order("created_at", { ascending: false }).range(from, to);
        if (periodEnd) q = q.lte("date_heure", periodEnd);
        return q;
      })(),
    ]);

    const count = (rows: { source: string }[] | null, src?: string) =>
      (rows || []).filter(r => !src || r.source === src).length;

    return NextResponse.json({
      mode: "salon",
      today: { total: count(rdvsToday.data), client: count(rdvsToday.data, "client"), salon: count(rdvsToday.data, "salon") },
      week: { total: count(rdvsWeek.data), client: count(rdvsWeek.data, "client"), salon: count(rdvsWeek.data, "salon") },
      month: { total: count(rdvsMonth.data), client: count(rdvsMonth.data, "client"), salon: count(rdvsMonth.data, "salon") },
      recent: rdvsRecent.data || [],
      total: rdvsRecent.count || 0,
      page,
      perPage,
    });
  }

  // Vue globale (existante)
  const [rdvsRes, clientsRes, usersRes, salonsRes] = await Promise.all([
    admin.from("rendez_vous").select("id, date_heure, statut, source, created_at, salons(nom, metier), clients(prenom, nom, email, telephone)").gte("created_at", since24h).order("created_at", { ascending: false }),
    admin.from("clients").select("id, prenom, nom, email, created_at, salons(nom)").gte("created_at", since24h).order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 500 }),
    admin.from("salons").select("id, nom, metier").order("nom"),
  ]);

  const allRecent = (usersRes.data?.users || [])
    .filter(u => u.created_at && u.created_at >= since24h)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(u => ({ id: u.id, email: u.email, created_at: u.created_at, user_type: u.user_metadata?.user_type || "inconnu", confirmed: !!u.email_confirmed_at }));

  return NextResponse.json({
    mode: "global",
    rdvs: rdvsRes.data || [],
    clients: clientsRes.data || [],
    users: allRecent,
    salons: salonsRes.data || [],
    since: since24h,
  });
}

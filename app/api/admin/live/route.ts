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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [rdvsRes, clientsRes, usersRes] = await Promise.all([
    admin
      .from("rendez_vous")
      .select("id, date_heure, statut, created_at, salons(nom, metier), clients(prenom, nom, email, telephone)")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    admin
      .from("clients")
      .select("id, prenom, nom, email, created_at, salons(nom)")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 500 }),
  ]);

  const allRecent = (usersRes.data?.users || [])
    .filter(u => u.created_at && u.created_at >= since)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(u => ({ id: u.id, email: u.email, created_at: u.created_at, user_type: u.user_metadata?.user_type || "inconnu", confirmed: !!u.email_confirmed_at }));

  return NextResponse.json({
    rdvs: rdvsRes.data || [],
    clients: clientsRes.data || [],
    users: allRecent,
    since,
  });
}

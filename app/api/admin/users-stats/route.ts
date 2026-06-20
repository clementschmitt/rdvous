import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérif admin
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = data?.users || [];

  const nbPro = users.filter(u => u.user_metadata?.user_type !== "client").length;
  const nbClient = users.filter(u => u.user_metadata?.user_type === "client").length;

  // Inscriptions par jour sur les 14 derniers jours
  const days: Record<string, { pro: number; client: number }> = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days[d.toISOString().slice(0, 10)] = { pro: 0, client: 0 };
  }

  for (const u of users) {
    const day = u.created_at?.slice(0, 10);
    if (day && days[day]) {
      if (u.user_metadata?.user_type === "client") days[day].client++;
      else days[day].pro++;
    }
  }

  return NextResponse.json({ nbPro, nbClient, nbTotal: users.length, days });
}

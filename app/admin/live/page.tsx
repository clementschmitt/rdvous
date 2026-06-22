"use client";
import { useEffect, useState, useCallback } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;
const REFRESH_INTERVAL = 30;

type Rdv = {
  id: string;
  date_heure: string;
  statut: string;
  created_at: string;
  salons: { nom: string; metier: string } | null;
  clients: { prenom: string; nom: string; email: string | null; telephone: string | null } | null;
};
type Client = { id: string; prenom: string; nom: string; email: string | null; created_at: string; salons: { nom: string } | null };
type AuthUser = { id: string; email: string; created_at: string; user_type: string; confirmed: boolean };

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  return `il y a ${Math.floor(diff / 3600)}h`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, background: color + "22", color, padding: "2px 8px", borderRadius: 20 }}>{label}</span>;
}

export default function LivePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (tok: string) => {
    const res = await fetch("/api/admin/live", { headers: { authorization: `Bearer ${tok}` } });
    if (!res.ok) return;
    const json = await res.json();
    setRdvs(json.rdvs || []);
    setClients(json.clients || []);
    setUsers(json.users || []);
    setLastRefresh(new Date());
    setCountdown(REFRESH_INTERVAL);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) { router.push("/dashboard"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token || null;
      setToken(tok);
      if (tok) fetchData(tok);
    })();
  }, [router, fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(token), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  // Countdown
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  if (loading) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>Chargement...</div>;

  const statItems = [
    { label: "Inscriptions", value: users.length, color: "#6366f1" },
    { label: "Nouveaux clients", value: clients.length, color: "#0ea5e9" },
    { label: "RDVs créés", value: rdvs.length, color: "#22c55e" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 64px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/admin" style={{ fontSize: 18, color: T.muted, textDecoration: "none" }}>←</Link>
            <div>
              <h1 style={{ fontFamily: T.heading, fontSize: 24, fontWeight: 600, color: T.text, margin: 0 }}>Monitoring live</h1>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Dernières 24h · Refresh dans {countdown}s</div>
            </div>
          </div>
          <button onClick={() => token && fetchData(token)}
            style={{ fontSize: 12, fontWeight: 600, color: T.text, background: T.white, border: `1px solid ${T.border}`, borderRadius: 20, padding: "7px 16px", cursor: "pointer" }}>
            Actualiser
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
          {statItems.map(s => (
            <div key={s.label} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "18px 20px", borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.text, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* RDVs */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Rendez-vous ({rdvs.length})</div>
            {rdvs.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "24px", textAlign: "center", color: T.muted, fontSize: 13 }}>Aucun RDV pour l'instant</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rdvs.map(r => {
                    const client = r.clients as unknown as { prenom: string; nom: string; email: string | null; telephone: string | null } | null;
                    return (
                      <div key={r.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{client?.prenom} {client?.nom}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(r.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted }}>{r.salons?.nom} · {r.date_heure.slice(0, 16).replace("T", " à ")}</div>
                        {client?.email && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>{client.email}</div>}
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Inscriptions */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Inscriptions ({users.length})</div>
            {users.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "24px", textAlign: "center", color: T.muted, fontSize: 13 }}>Aucune inscription pour l'instant</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[{ label: "Confirmés", items: users.filter(u => u.confirmed), color: "#22c55e" }, { label: "En attente", items: users.filter(u => !u.confirmed), color: "#f59e0b" }]
                    .filter(g => g.items.length > 0)
                    .map(g => (
                      <div key={g.label}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: g.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{g.label} ({g.items.length})</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {g.items.map(u => (
                            <div key={u.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `3px solid ${g.color}`, padding: "10px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{u.email}</span>
                                <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(u.created_at)}</span>
                              </div>
                              <Badge label={u.user_type === "artisan" ? "Pro" : "Client"} color={u.user_type === "artisan" ? "#f59e0b" : "#22c55e"} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </div>
            }
          </div>

        </div>
      </div>
    </div>
  );
}

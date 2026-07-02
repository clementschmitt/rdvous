"use client";
import { useEffect, useState, useCallback } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/lib/theme";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;
const REFRESH_INTERVAL = 30;

type Salon = { id: string; nom: string; metier: string };
type StatBlock = { total: number; client: number; salon: number };
type RecentRdv = { id: string; date_heure: string; statut: string; source: string; created_at: string; clients: { prenom: string; nom: string; email: string | null } | null };
type RdvEvent = { id: string; type: string; old_date_heure: string; new_date_heure: string; client_prenom: string | null; client_nom: string | null; created_at: string };
type GlobalRdv = { id: string; date_heure: string; statut: string; source: string; created_at: string; salons: { nom: string; metier: string } | null; clients: { prenom: string; nom: string; email: string | null; telephone: string | null } | null };
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

function SourceBadge({ source }: { source: string }) {
  return source === "client"
    ? <Badge label="Client" color="#6366f1" />
    : <Badge label="Salon" color="#f59e0b" />;
}

function StatCard({ label, data }: { label: string; data: StatBlock }) {
  return (
    <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.text, lineHeight: 1, marginBottom: 10 }}>{data.total}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: "#6366f111", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1" }}>{data.client}</div>
          <div style={{ fontSize: 10, color: "#6366f1", marginTop: 2 }}>clients</div>
        </div>
        <div style={{ flex: 1, background: "#f59e0b11", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{data.salon}</div>
          <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>salon</div>
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);

  // Vue salon
  const [today, setToday] = useState<StatBlock | null>(null);
  const [week, setWeek] = useState<StatBlock | null>(null);
  const [month, setMonth] = useState<StatBlock | null>(null);
  const [recent, setRecent] = useState<RecentRdv[]>([]);
  const [events, setEvents] = useState<RdvEvent[]>([]);
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");
  const [page, setPage] = useState(1);
  const [totalRdvs, setTotalRdvs] = useState(0);
  const perPage = 25;

  // Vue globale
  const [rdvs, setRdvs] = useState<GlobalRdv[]>([]);
  const [clients, setClients] = useState<unknown[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);

  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (tok: string, salonId?: string, p = 1, per: "today" | "week" | "month" = "month") => {
    const url = salonId ? `/api/admin/live?salon_id=${salonId}&period=${per}&page=${p}` : "/api/admin/live";
    const res = await fetch(url, { headers: { authorization: `Bearer ${tok}` } });
    if (!res.ok) return;
    const json = await res.json();
    if (json.mode === "salon") {
      setToday(json.today);
      setWeek(json.week);
      setMonth(json.month);
      setRecent(json.recent || []);
      setTotalRdvs(json.total || 0);
      setPage(json.page || 1);
      setEvents(json.events || []);
    } else {
      setRdvs(json.rdvs || []);
      setClients(json.clients || []);
      setUsers(json.users || []);
      setSalons(json.salons || []);
    }
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

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchData(token, selectedSalon?.id, page, period), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [token, selectedSalon, page, period, fetchData]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  function selectSalon(salon: Salon | null) {
    setSelectedSalon(salon);
    setPage(1);
    setLoading(true);
    if (token) fetchData(token, salon?.id, 1, period);
  }

  function changePeriod(p: "today" | "week" | "month") {
    setPeriod(p);
    setPage(1);
    if (token) fetchData(token, selectedSalon?.id, 1, p);
  }

  function changePage(p: number) {
    setPage(p);
    if (token) fetchData(token, selectedSalon?.id, p, period);
  }

  if (loading) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif", display: "flex" }}>

      {/* Sidebar salons */}
      <div style={{ width: 220, background: T.white, borderRight: `1px solid ${T.border}`, padding: "24px 0", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "0 16px 12px", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Salons</div>
        <div
          onClick={() => selectSalon(null)}
          style={{ padding: "9px 16px", cursor: "pointer", background: !selectedSalon ? "#6366f111" : "transparent", borderLeft: !selectedSalon ? "3px solid #6366f1" : "3px solid transparent", fontSize: 13, fontWeight: !selectedSalon ? 700 : 400, color: !selectedSalon ? "#6366f1" : T.text }}>
          Vue globale
        </div>
        {salons.map(s => (
          <div key={s.id}
            onClick={() => selectSalon(s)}
            style={{ padding: "9px 16px", cursor: "pointer", background: selectedSalon?.id === s.id ? "#6366f111" : "transparent", borderLeft: selectedSalon?.id === s.id ? "3px solid #6366f1" : "3px solid transparent", fontSize: 13, fontWeight: selectedSalon?.id === s.id ? 700 : 400, color: selectedSalon?.id === s.id ? "#6366f1" : T.text }}>
            {s.nom}
          </div>
        ))}
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 64px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link href="/admin" style={{ fontSize: 18, color: T.muted, textDecoration: "none" }}>←</Link>
              <div>
                <h1 style={{ fontFamily: T.heading, fontSize: 22, fontWeight: 600, color: T.text, margin: 0 }}>
                  {selectedSalon ? selectedSalon.nom : "Monitoring live"}
                </h1>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Refresh dans {countdown}s</div>
              </div>
            </div>
            <button onClick={() => token && fetchData(token, selectedSalon?.id)}
              style={{ fontSize: 12, fontWeight: 600, color: T.text, background: T.white, border: `1px solid ${T.border}`, borderRadius: 20, padding: "7px 16px", cursor: "pointer" }}>
              Actualiser
            </button>
          </div>

          {selectedSalon && today && week && month ? (
            <>
              {/* Stats par salon */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
                <StatCard label="Aujourd'hui" data={today} />
                <StatCard label="Cette semaine" data={week} />
                <StatCard label="Ce mois" data={month} />
              </div>

              {/* Légende + Sélecteur période */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                    Client via widget
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                    Créé par le salon
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["today", "week", "month"] as const).map(p => (
                    <button key={p} onClick={() => changePeriod(p)}
                      style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20, border: `1px solid ${period === p ? "#6366f1" : T.border}`, background: period === p ? "#6366f111" : T.white, color: period === p ? "#6366f1" : T.muted, cursor: "pointer" }}>
                      {p === "today" ? "Aujourd'hui" : p === "week" ? "Semaine" : "Mois"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Derniers RDVs */}
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Rendez-vous ({totalRdvs})
              </div>
              {recent.length === 0
                ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>Aucun RDV</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recent.map(r => {
                      const client = r.clients as unknown as { prenom: string; nom: string; email: string | null } | null;
                      return (
                        <div key={r.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `3px solid ${r.source === "client" ? "#6366f1" : "#f59e0b"}`, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{client?.prenom} {client?.nom}</span>
                              <SourceBadge source={r.source} />
                            </div>
                            <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(r.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: T.muted }}>{r.date_heure.slice(0, 16).replace("T", " à ")}</div>
                          {client?.email && <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>{client.email}</div>}
                        </div>
                      );
                    })}
                  </div>
              }

              {/* Pagination */}
              {totalRdvs > perPage && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
                  <button onClick={() => changePage(page - 1)} disabled={page === 1}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, color: T.text, fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>
                    ←
                  </button>
                  <span style={{ fontSize: 13, color: T.muted }}>Page {page} / {Math.ceil(totalRdvs / perPage)}</span>
                  <button onClick={() => changePage(page + 1)} disabled={page >= Math.ceil(totalRdvs / perPage)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.white, color: T.text, fontSize: 13, cursor: page >= Math.ceil(totalRdvs / perPage) ? "not-allowed" : "pointer", opacity: page >= Math.ceil(totalRdvs / perPage) ? 0.4 : 1 }}>
                    →
                  </button>
                </div>
              )}
              {/* Déplacements */}
              {events.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                    Déplacements récents ({events.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {events.map(e => (
                      <div key={e.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: "3px solid #8b5cf6", padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{e.client_prenom} {e.client_nom}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(e.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted }}>
                          {e.old_date_heure.slice(0, 16).replace("T", " à ")} → {e.new_date_heure.slice(0, 16).replace("T", " à ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Vue globale */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
                {[
                  { label: "Inscriptions", value: users.length, color: "#6366f1" },
                  { label: "Nouveaux clients", value: clients.length, color: "#0ea5e9" },
                  { label: "RDVs créés", value: rdvs.length, color: "#22c55e" },
                ].map(s => (
                  <div key={s.label} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "18px 20px", borderTop: `3px solid ${s.color}` }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: T.text, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Rendez-vous ({rdvs.length})</div>
                  {rdvs.length === 0
                    ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>Aucun RDV</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {rdvs.map(r => {
                          const client = r.clients as unknown as { prenom: string; nom: string } | null;
                          return (
                            <div key={r.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `3px solid ${r.source === "client" ? "#6366f1" : "#f59e0b"}`, padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{client?.prenom} {client?.nom}</span>
                                  <SourceBadge source={r.source || "salon"} />
                                </div>
                                <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(r.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 12, color: T.muted }}>{r.salons?.nom} · {r.date_heure.slice(0, 16).replace("T", " à ")}</div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Inscriptions ({users.length})</div>
                  {users.length === 0
                    ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>Aucune inscription</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {users.map(u => (
                          <div key={u.id} style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, borderLeft: `3px solid ${u.confirmed ? "#22c55e" : "#f59e0b"}`, padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{u.email}</span>
                              <span style={{ fontSize: 11, color: T.muted }}>{timeAgo(u.created_at)}</span>
                            </div>
                            <Badge label={u.user_type === "artisan" ? "Pro" : "Client"} color={u.user_type === "artisan" ? "#f59e0b" : "#22c55e"} />
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

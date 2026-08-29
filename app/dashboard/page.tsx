"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RdvToday = { id: string; date_heure: string; statut: string; clients: { prenom: string; nom: string } | null; rendez_vous_prestations: { prestations: { duree_minutes: number; tarif: number } | null }[] };
type Anniversaire = { id: string; prenom: string; nom: string; jours: number };
type Relance = { id: string; prenom: string; nom: string; telephone: string | null; email: string | null; sending: boolean; error: string | null };

export default function DashboardPage() {
  const salon = useSalon();
  const router = useRouter();
  const [caWeek, setCaWeek] = useState(0);
  const [caWeekPrev, setCaWeekPrev] = useState(0);
  const [caMonth, setCaMonth] = useState(0);
  const [caMonthPrev, setCaMonthPrev] = useState(0);
  const [rdvsToday, setRdvsToday] = useState<RdvToday[]>([]);
  const [rdvsWeekConfirmed, setRdvsWeekConfirmed] = useState(0);
  const [rdvsWeekEffectue, setRdvsWeekEffectue] = useState(0);
  const [anniversaires, setAnniversaires] = useState<Anniversaire[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [relanceConfirm, setRelanceConfirm] = useState<string | null>(null);
  const [attenteAlerte, setAttenteAlerte] = useState<{ count: number; date: string } | null>(null);

  useEffect(() => {
    if (!salon) return;
    (async () => {
      const supabase = createSupabase();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const weekStart = new Date(today);
      const d = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - d + (d === 0 ? -6 : 1));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      const weekPrevStart = new Date(weekStart); weekPrevStart.setDate(weekPrevStart.getDate() - 7);
      const weekPrevEnd = new Date(weekStart);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const monthPrevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthPrevEnd = new Date(today.getFullYear(), today.getMonth(), 1);

      const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      const weekStartStr = fmt(weekStart);
      const weekEndStr = fmt(weekEnd);
      const weekPrevStartStr = fmt(weekPrevStart);
      const weekPrevEndStr = fmt(weekPrevEnd);
      const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth()+1).padStart(2,'0')}-01`;
      const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth()+1).padStart(2,'0')}-01`;
      const monthPrevStartStr = `${monthPrevStart.getFullYear()}-${String(monthPrevStart.getMonth()+1).padStart(2,'0')}-01`;
      const monthPrevEndStr = `${monthPrevEnd.getFullYear()}-${String(monthPrevEnd.getMonth()+1).padStart(2,'0')}-01`;

      const [rdvTodayRes, rdvWeekRes, rdvWeekPrevRes, rdvMonthRes, rdvMonthPrevRes, clientsRes, settingsRes, allRdvsRes, rdvWeekConfirmedRes, attenteAlerteRes] = await Promise.all([
        supabase.from("rendez_vous").select("id, date_heure, statut, clients(prenom, nom), rendez_vous_prestations(prestations(duree_minutes, tarif))").eq("salon_id", salon!.id).gte("date_heure", `${todayStr}T00:00:00`).lte("date_heure", `${todayStr}T23:59:59`).neq("statut", "annule").order("date_heure"),
        supabase.from("rendez_vous").select("tarif, rendez_vous_prestations(prestations(tarif, sur_devis))").eq("salon_id", salon!.id).gte("date_heure", `${weekStartStr}T00:00:00`).lt("date_heure", `${weekEndStr}T00:00:00`).eq("statut", "effectue"),
        supabase.from("rendez_vous").select("tarif, rendez_vous_prestations(prestations(tarif, sur_devis))").eq("salon_id", salon!.id).gte("date_heure", `${weekPrevStartStr}T00:00:00`).lt("date_heure", `${weekPrevEndStr}T00:00:00`).eq("statut", "effectue"),
        supabase.from("rendez_vous").select("tarif, rendez_vous_prestations(prestations(tarif, sur_devis))").eq("salon_id", salon!.id).gte("date_heure", `${monthStartStr}T00:00:00`).lt("date_heure", `${monthEndStr}T00:00:00`).eq("statut", "effectue"),
        supabase.from("rendez_vous").select("tarif, rendez_vous_prestations(prestations(tarif, sur_devis))").eq("salon_id", salon!.id).gte("date_heure", `${monthPrevStartStr}T00:00:00`).lt("date_heure", `${monthPrevEndStr}T00:00:00`).eq("statut", "effectue"),
        supabase.from("clients").select("id, prenom, nom, telephone, email, date_naissance").eq("salon_id", salon!.id),
        supabase.from("app_settings").select("delai_relance_mois").eq("salon_id", salon!.id).single(),
        supabase.from("rendez_vous").select("client_id, date_heure").eq("salon_id", salon!.id).neq("statut", "annule").order("date_heure", { ascending: false }),
        supabase.from("rendez_vous").select("id", { count: "exact", head: true }).eq("salon_id", salon!.id).gte("date_heure", `${weekStartStr}T00:00:00`).lt("date_heure", `${weekEndStr}T00:00:00`).eq("statut", "planifie"),
        supabase.from("liste_attente").select("id", { count: "exact", head: true }).eq("salon_id", salon!.id).eq("date_souhaitee", todayStr).eq("statut", "notifie").gte("notifie_le", `${todayStr}T00:00:00`),
      ]);

      const calcCA = (rows: { tarif?: number | null; rendez_vous_prestations: { prestations: { tarif: number; sur_devis?: boolean } | null }[] }[]) =>
        (rows || []).reduce((s, r) => r.tarif != null
          ? s + r.tarif
          : s + (r.rendez_vous_prestations || []).reduce((ss, rp) => ss + (rp.prestations?.sur_devis ? 0 : (rp.prestations?.tarif || 0)), 0), 0);

      setCaWeek(calcCA(rdvWeekRes.data as never || []));
      setCaWeekPrev(calcCA(rdvWeekPrevRes.data as never || []));
      setCaMonth(calcCA(rdvMonthRes.data as never || []));
      setCaMonthPrev(calcCA(rdvMonthPrevRes.data as never || []));
      setRdvsToday((rdvTodayRes.data || []) as unknown as RdvToday[]);
      setRdvsWeekConfirmed(rdvWeekConfirmedRes.count || 0);
      setRdvsWeekEffectue((rdvWeekRes.data || []).length);
      const alerteCount = attenteAlerteRes.count || 0;
      if (alerteCount > 0) setAttenteAlerte({ count: alerteCount, date: todayStr });

      const clients = clientsRes.data || [];
      const now = new Date();

      const annivs = clients
        .filter(c => c.date_naissance)
        .map(c => {
          const dn = new Date(c.date_naissance!);
          const next = new Date(now.getFullYear(), dn.getMonth(), dn.getDate());
          if (next < now) next.setFullYear(now.getFullYear() + 1);
          const jours = Math.ceil((next.getTime() - now.getTime()) / 86400000);
          return { id: c.id, prenom: c.prenom, nom: c.nom, jours };
        })
        .filter(a => a.jours <= 30)
        .sort((a, b) => a.jours - b.jours);
      setAnniversaires(annivs);

      const delai = settingsRes.data?.delai_relance_mois ?? 2;
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - delai);
      const dernierRdv: Record<string, string> = {};
      for (const r of (allRdvsRes.data || [])) {
        if (!dernierRdv[r.client_id]) dernierRdv[r.client_id] = r.date_heure.slice(0, 10);
      }
      const storageKey = `relances_sent_${salon!.id}`;
      const stored: Record<string, string> = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const relanceCutoff = new Date(); relanceCutoff.setMonth(relanceCutoff.getMonth() - delai);
      const aRelancer = clients
        .filter(c => {
          const d = dernierRdv[c.id];
          if (!d || new Date(d) >= cutoff) return false;
          const sentAt = stored[c.id];
          if (sentAt && new Date(sentAt) > relanceCutoff) return false;
          return true;
        })
        .map(c => ({ id: c.id, prenom: c.prenom, nom: c.nom, telephone: c.telephone, email: c.email ?? null, sending: false, error: null }));
      setRelances(aRelancer);
    })();
  }, [salon]);

  async function envoyerRelance(c: Relance) {
    setRelances(rs => rs.map(r => r.id === c.id ? { ...r, sending: true, error: null } : r));
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/relance/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ client_id: c.id, salon_id: salon!.id }),
    });
    const json = await res.json();
    if (res.ok) {
      const storageKey = `relances_sent_${salon!.id}`;
      const stored: Record<string, string> = JSON.parse(localStorage.getItem(storageKey) || "{}");
      stored[c.id] = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(stored));
      setRelances(rs => rs.filter(r => r.id !== c.id));
      setRelanceConfirm(`Email de relance envoyé à ${c.prenom} ${c.nom}`);
      setTimeout(() => setRelanceConfirm(null), 4000);
    } else {
      setRelances(rs => rs.map(r => r.id === c.id ? { ...r, sending: false, error: json.error || "Erreur" } : r));
    }
  }

  if (!salon) return <div style={{ padding: 40, color: T.faint }}>Chargement...</div>;
  const m = METIERS[salon.metier];
  const ls = T.ls;

  const formatDuree = (min: number) => { const h = Math.floor(min / 60), mm = min % 60; return h === 0 ? `${mm}min` : mm ? `${h}h${mm}` : `${h}h`; };

  return (
    <main className="dash-main" style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .dash-main { padding: 20px 16px !important; }
          .dash-ca-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .dash-main-grid { grid-template-columns: 1fr !important; }
          .dash-main-grid > * { grid-column: auto !important; }
        }
      `}</style>
      {/* Header jour */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <p style={{ ...ls, color: m.couleurMuted, margin: "0 0 4px" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 style={{ fontFamily: T.heading, fontSize: "26px", fontWeight: 600, color: T.text, margin: 0 }}>
            Agenda du jour
          </h2>
        </div>
      </div>

      {attenteAlerte && (
        <Link href="/dashboard/attente" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: T.radius, marginBottom: 16, textDecoration: "none" }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
              Un créneau s'est libéré aujourd'hui, {attenteAlerte.count} personne{attenteAlerte.count > 1 ? "s" : ""} en liste d'attente {attenteAlerte.count > 1 ? "ont été prévenues" : "a été prévenue"}.
            </div>
            <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>Voir la liste d'attente →</div>
          </div>
        </Link>
      )}

      {/* Grille unifiée 3 colonnes, tuiles row1, planning+sidebar row2 */}
      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: "16px" }}>

        {/* Tuile 1, Semaine */}
        {(() => {
          const total = rdvsWeekEffectue + rdvsWeekConfirmed;
          const pct = total > 0 ? Math.round(rdvsWeekEffectue / total * 100) : 0;
          return (
            <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "14px 16px" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: "0 0 8px" }}>SEMAINE EN COURS</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#16a34a" }}>{rdvsWeekEffectue} effectué{rdvsWeekEffectue > 1 ? "s" : ""}</span>
                {rdvsWeekConfirmed > 0 && <span style={{ fontSize: "12px", color: m.couleurMuted }}>· {rdvsWeekConfirmed} à venir</span>}
                {total === 0 && <span style={{ fontSize: "13px", color: m.couleurMuted }}>Aucun RDV</span>}
              </div>
              {total > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: m.couleurClaire, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#16a34a", borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
              )}
            </div>
          );
        })()}

        {/* Tuile 2, CA semaine */}
        {(() => {
          const pct = caWeekPrev > 0 ? Math.round((caWeek - caWeekPrev) / caWeekPrev * 100) : null;
          const hausse = pct !== null && pct >= 0;
          return (
            <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "14px 16px" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: "0 0 6px" }}>CA CETTE SEMAINE</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: T.text, margin: 0 }}>{caWeek.toFixed(0)} €</p>
                {pct !== null && <span style={{ fontSize: "11px", fontWeight: 600, color: hausse ? "#16a34a" : "#dc2626" }}>{hausse ? "↑" : "↓"} {Math.abs(pct)}%</span>}
                {caWeekPrev === 0 && caWeek > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#16a34a" }}>↑ nouveau</span>}
              </div>
            </div>
          );
        })()}

        {/* Tuile 3, CA mois (col 3, alignée avec sidebar) */}
        {(() => {
          const pct = caMonthPrev > 0 ? Math.round((caMonth - caMonthPrev) / caMonthPrev * 100) : null;
          const hausse = pct !== null && pct >= 0;
          return (
            <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "14px 16px" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: "0 0 6px" }}>CA RÉALISÉ CE MOIS</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: T.text, margin: 0 }}>{caMonth.toFixed(0)} €</p>
                {pct !== null && <span style={{ fontSize: "11px", fontWeight: 600, color: hausse ? "#16a34a" : "#dc2626" }}>{hausse ? "↑" : "↓"} {Math.abs(pct)}%</span>}
                {caMonthPrev === 0 && caMonth > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#16a34a" }}>↑ nouveau</span>}
              </div>
            </div>
          );
        })()}

        {/* Planning du jour, span 2 colonnes */}
        <div style={{ gridColumn: "span 2", backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: 0 }}>Planning du jour</p>
            <button onClick={() => router.push("/dashboard/agenda/nouveau")}
              style={{ ...ls, fontSize: "10px", backgroundColor: "transparent", border: "none", color: m.couleur, cursor: "pointer", padding: 0 }}>
              + RDV
            </button>
          </div>
          {rdvsToday.length === 0 ? (
            <div style={{ color: T.faint, fontSize: "14px", textAlign: "center", padding: "40px 0" }}>Aucun rendez-vous aujourd'hui</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {rdvsToday.map(rdv => {
                const duree = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0);
                const tarif = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.tarif || 0), 0);
                return (
                  <div key={rdv.id} onClick={() => router.push(`/dashboard/agenda/${rdv.id}?from=dashboard`)}
                    style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                    <div style={{ fontSize: "11px", color: m.couleurMuted, width: 38, flexShrink: 0, fontWeight: 600 }}>
                      {rdv.date_heure.slice(11, 16)}
                    </div>
                    <div style={{ flex: 1, background: `${m.couleur}10`, border: `1px solid ${m.couleur}25`, borderLeft: `3px solid ${m.couleur}`, borderRadius: 8, padding: "8px 12px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: m.couleur, margin: "0 0 2px" }}>
                        {rdv.clients ? `${rdv.clients.prenom} ${rdv.clients.nom.charAt(0)}.` : "—"}
                      </p>
                      {(duree > 0 || tarif > 0) && (
                        <p style={{ ...ls, fontSize: "10px", color: T.muted, margin: 0 }}>
                          {duree > 0 ? formatDuree(duree) : ""}{tarif > 0 ? ` · ${tarif} €` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {relanceConfirm && (
            <div style={{ marginTop: 16, background: `${"#7a9e8a"}12`, border: `1px solid ${"#7a9e8a"}30`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <p style={{ fontSize: "11px", color: "#7a9e8a", fontWeight: 600, margin: 0 }}>{relanceConfirm}</p>
            </div>
          )}
        </div>

        {/* Sidebar, col 3 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Relances */}
          <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: 0 }}>Relances</p>
              {relances.length > 0 && (
                <span style={{ fontSize: "11px", backgroundColor: `${m.couleur}15`, color: m.couleur, padding: "2px 8px", borderRadius: "20px" }}>{relances.length}</span>
              )}
            </div>
            {relances.length === 0 ? (
              <div style={{ color: T.faint, fontSize: "13px" }}>Tout le monde est à jour</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {relances.map(c => (
                  <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: "10px", borderBottom: `1px solid ${m.couleurClaire}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: "13px", color: T.text, margin: 0, cursor: "pointer" }} onClick={() => router.push(`/dashboard/clients/${c.id}`)}>
                        {c.prenom} {c.nom}
                      </p>
                      {!c.email ? (
                        <span style={{ fontSize: "10px", color: T.faint }}>Pas d&apos;email</span>
                      ) : (
                        <button
                          onClick={() => envoyerRelance(c)}
                          disabled={c.sending}
                          style={{ ...ls, fontSize: "9px", backgroundColor: m.couleur, color: "#fff", border: "none", padding: "5px 10px", cursor: c.sending ? "not-allowed" : "pointer", borderRadius: T.radiusSm, flexShrink: 0, opacity: c.sending ? 0.6 : 1 }}>
                          {c.sending ? "..." : "Relancer"}
                        </button>
                      )}
                    </div>
                    {c.error && <p style={{ fontSize: "11px", color: "#B91C1C", margin: 0 }}>{c.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anniversaires */}
          <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "24px" }}>
            <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: "0 0 16px" }}>Anniversaires à venir</p>
            {anniversaires.length === 0 ? (
              <div style={{ color: T.faint, fontSize: "13px" }}>Aucun dans les 30 prochains jours</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {anniversaires.map(c => (
                  <div key={c.id} onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    <p style={{ fontSize: "13px", color: T.text, margin: 0 }}>{c.prenom} {c.nom}</p>
                    <p style={{ fontSize: "11px", color: c.jours <= 3 ? m.couleur : T.muted, margin: 0, fontWeight: c.jours <= 3 ? 600 : 400 }}>
                      {c.jours === 0 ? "Aujourd'hui !" : `J-${c.jours}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accès rapide */}
          <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "24px" }}>
            <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: "0 0 16px" }}>Accès rapide</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => router.push("/dashboard/agenda/nouveau")}
                style={{ backgroundColor: m.couleur, color: "#fff", border: "none", padding: "12px", ...ls, fontSize: "10px", cursor: "pointer", borderRadius: T.radiusSm }}>
                + Nouveau RDV
              </button>
              <button onClick={() => router.push("/dashboard/clients/nouveau")}
                style={{ backgroundColor: "transparent", color: m.couleur, border: `1px solid ${m.couleurClaire}`, padding: "12px", ...ls, fontSize: "10px", cursor: "pointer", borderRadius: T.radiusSm }}>
                + Nouveau client
              </button>
              <button onClick={() => router.push("/dashboard/clients")}
                style={{ backgroundColor: "transparent", color: T.muted, border: `1px solid ${m.couleurClaire}`, padding: "12px", ...ls, fontSize: "10px", cursor: "pointer", borderRadius: T.radiusSm }}>
                Voir tous les clients
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

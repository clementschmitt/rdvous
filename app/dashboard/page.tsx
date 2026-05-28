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
  const [caMonth, setCaMonth] = useState(0);
  const [caVisible, setCaVisible] = useState({ week: false, month: false });
  const [rdvsToday, setRdvsToday] = useState<RdvToday[]>([]);
  const [anniversaires, setAnniversaires] = useState<Anniversaire[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [relanceConfirm, setRelanceConfirm] = useState<string | null>(null);

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

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
      const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth()+1).padStart(2,'0')}-${String(weekEnd.getDate()).padStart(2,'0')}`;
      const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth()+1).padStart(2,'0')}-01`;
      const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth()+1).padStart(2,'0')}-01`;

      const [rdvTodayRes, rdvWeekRes, rdvMonthRes, clientsRes, settingsRes, allRdvsRes] = await Promise.all([
        supabase.from("rendez_vous").select("id, date_heure, statut, clients(prenom, nom), rendez_vous_prestations(prestations(duree_minutes, tarif))").eq("salon_id", salon!.id).gte("date_heure", `${todayStr}T00:00:00`).lte("date_heure", `${todayStr}T23:59:59`).neq("statut", "annule").order("date_heure"),
        supabase.from("rendez_vous").select("rendez_vous_prestations(prestations(tarif))").eq("salon_id", salon!.id).gte("date_heure", `${weekStartStr}T00:00:00`).lt("date_heure", `${weekEndStr}T00:00:00`).eq("statut", "termine"),
        supabase.from("rendez_vous").select("rendez_vous_prestations(prestations(tarif))").eq("salon_id", salon!.id).gte("date_heure", `${monthStartStr}T00:00:00`).lt("date_heure", `${monthEndStr}T00:00:00`).eq("statut", "termine"),
        supabase.from("clients").select("id, prenom, nom, telephone, email, date_naissance").eq("salon_id", salon!.id),
        supabase.from("app_settings").select("delai_relance_mois").eq("salon_id", salon!.id).single(),
        supabase.from("rendez_vous").select("client_id, date_heure").eq("salon_id", salon!.id).neq("statut", "annule").order("date_heure", { ascending: false }),
      ]);

      const calcCA = (rows: { rendez_vous_prestations: { prestations: { tarif: number } | null }[] }[]) =>
        (rows || []).reduce((s, r) => s + (r.rendez_vous_prestations || []).reduce((ss, rp) => ss + (rp.prestations?.tarif || 0), 0), 0);

      setCaWeek(calcCA(rdvWeekRes.data as never || []));
      setCaMonth(calcCA(rdvMonthRes.data as never || []));
      setRdvsToday((rdvTodayRes.data || []) as unknown as RdvToday[]);

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
          if (!(!d || new Date(d) < cutoff)) return false;
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
        }
      `}</style>
      <div style={{ marginBottom: "36px" }}>
        <p style={{ ...ls, color: m.couleurMuted, margin: "0 0 6px" }}>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h2 style={{ fontFamily: T.heading, fontSize: "32px", fontWeight: 300, color: T.text, margin: 0 }}>
          Bonjour 👋
        </h2>
      </div>

      {/* CA */}
      <div className="dash-ca-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {([
          { label: "CA cette semaine", value: caWeek, key: "week" as const },
          { label: "CA ce mois", value: caMonth, key: "month" as const },
        ]).map(({ label, value, key }) => (
          <div key={key} onClick={() => setCaVisible(v => ({ ...v, [key]: !v[key] }))}
            style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "20px 24px", overflow: "hidden", maxHeight: caVisible[key] ? "110px" : "52px", transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: 0 }}>{label}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {caVisible[key] ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>)}
              </svg>
            </div>
            <p style={{ fontFamily: T.heading, fontSize: "36px", fontWeight: 300, color: m.couleur, margin: "14px 0 0", opacity: caVisible[key] ? 1 : 0, transition: "opacity 0.25s ease 0.15s" }}>
              {value.toFixed(0)} €
            </p>
          </div>
        ))}
      </div>

      {/* Grille 2 colonnes */}
      <div className="dash-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>

        {/* Planning du jour */}
        <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: 0 }}>Planning du jour</p>
            <button onClick={() => router.push("/dashboard/agenda/nouveau")}
              style={{ ...ls, fontSize: "10px", backgroundColor: "transparent", border: "none", color: m.couleur, cursor: "pointer", padding: 0 }}>
              + RDV
            </button>
          </div>
          {rdvsToday.length === 0 ? (
            <div style={{ color: T.faint, fontSize: "14px", textAlign: "center", padding: "40px 0" }}>Aucun rendez-vous aujourd'hui</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {rdvsToday.map(rdv => {
                const duree = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 0), 0);
                const tarif = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.tarif || 0), 0);
                return (
                  <div key={rdv.id} onClick={() => router.push(`/dashboard/agenda/${rdv.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", backgroundColor: `${m.couleur}08`, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, cursor: "pointer" }}>
                    <div style={{ textAlign: "center", minWidth: "48px" }}>
                      <p style={{ fontSize: "16px", fontWeight: 500, color: m.couleur, margin: 0 }}>{rdv.date_heure.slice(11, 16)}</p>
                    </div>
                    <div style={{ borderLeft: `1px solid ${m.couleurClaire}`, paddingLeft: "16px", flex: 1 }}>
                      <p style={{ fontSize: "14px", color: T.text, margin: "0 0 2px" }}>
                        {rdv.clients ? `${rdv.clients.prenom} ${rdv.clients.nom}` : "—"}
                      </p>
                      <p style={{ ...ls, fontSize: "10px", color: T.muted, margin: 0 }}>
                        {duree > 0 ? formatDuree(duree) : ""}{tarif > 0 ? ` · ${tarif} €` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne droite */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Relances */}
          <div style={{ backgroundColor: T.white, border: `1px solid ${m.couleurClaire}`, borderRadius: T.radius, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ ...ls, fontSize: "10px", color: m.couleurMuted, margin: 0 }}>Relances</p>
              {relances.length > 0 && (
                <span style={{ fontSize: "11px", backgroundColor: `${m.couleur}15`, color: m.couleur, padding: "2px 8px", borderRadius: "20px" }}>{relances.length}</span>
              )}
            </div>
            {relanceConfirm && (
              <p style={{ fontSize: "12px", color: "#16a34a", margin: "0 0 12px", padding: "8px 12px", background: "#f0fdf4", borderRadius: T.radiusSm }}>✓ {relanceConfirm}</p>
            )}
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

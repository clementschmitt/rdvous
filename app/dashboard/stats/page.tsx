"use client";
import { useEffect, useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Periode = "semaine" | "mois" | "mois_precedent" | "annee";

type RdvRow = {
  date_heure: string;
  statut: string;
  rendez_vous_prestations: {
    prestations: { nom: string; tarif: number; duree_minutes: number; sur_devis: boolean } | null;
  }[];
};

type StatPrestation = { nom: string; nb: number; ca: number; heures: number };
type TopCliente = { prenom: string; nom: string; nb: number; ca: number };
type ProjectionMois = { mois: string; ca: number; nb: number };

function getRange(periode: Periode): { debut: string; fin: string; label: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periode === "semaine") {
    const day = now.getDay();
    const lundi = new Date(now);
    lundi.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    return { debut: dateStr(lundi), fin: dateStr(dimanche), label: "Cette semaine" };
  }
  if (periode === "mois") {
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { debut: dateStr(debut), fin: dateStr(fin), label: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  if (periode === "mois_precedent") {
    const debut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fin = new Date(now.getFullYear(), now.getMonth(), 0);
    return { debut: dateStr(debut), fin: dateStr(fin), label: debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  // annee
  const debut = new Date(now.getFullYear(), 0, 1);
  const fin = new Date(now.getFullYear(), 11, 31);
  return { debut: dateStr(debut), fin: dateStr(fin), label: String(now.getFullYear()) };
}

export default function StatsPage() {
  const salon = useSalon();
  const [periode, setPeriode] = useState<Periode>("mois");
  const [rdvs, setRdvs] = useState<RdvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [evolution, setEvolution] = useState<{ mois: string; ca: number; nb: number }[]>([]);
  const [nbAnnules, setNbAnnules] = useState(0);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [projection, setProjection] = useState<ProjectionMois[]>([]);

  useEffect(() => {
    if (!salon) return;
    load();
  }, [salon, periode]);

  async function load() {
    if (!salon) return;
    setLoading(true);
    const supabase = createSupabase();
    const { debut, fin } = getRange(periode);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

    const [rdvRes, evoRes, annulesRes, topRes, projRes] = await Promise.all([
      supabase
        .from("rendez_vous")
        .select("date_heure, statut, rendez_vous_prestations(prestations(nom, tarif, duree_minutes, sur_devis))")
        .eq("salon_id", salon.id)
        .gte("date_heure", `${debut}T00:00:00`)
        .lte("date_heure", `${fin}T23:59:59`)
        .neq("statut", "annule"),
      // 12 derniers mois pour l'évolution
      supabase
        .from("rendez_vous")
        .select("date_heure, rendez_vous_prestations(prestations(tarif, sur_devis))")
        .eq("salon_id", salon.id)
        .gte("date_heure", (() => { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01T00:00:00`; })())
        .neq("statut", "annule"),
      // Annulés sur la période
      supabase.from("rendez_vous").select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id).eq("statut", "annule")
        .gte("date_heure", `${debut}T00:00:00`).lte("date_heure", `${fin}T23:59:59`),
      // Top clientes
      supabase.from("rendez_vous")
        .select("clients(prenom, nom), rendez_vous_prestations(prestations(tarif, sur_devis))")
        .eq("salon_id", salon.id).neq("statut", "annule"),
      // Projection CA (RDV futurs confirmés)
      supabase.from("rendez_vous")
        .select("date_heure, rendez_vous_prestations(prestations(tarif, sur_devis))")
        .eq("salon_id", salon.id).eq("statut", "confirme")
        .gte("date_heure", `${todayStr}T00:00:00`),
    ]);

    setRdvs((rdvRes.data || []) as unknown as RdvRow[]);
    setNbAnnules(annulesRes.count || 0);

    // Top clientes
    const clientMap: Record<string, TopCliente> = {};
    for (const r of (topRes.data || []) as unknown as { clients: { prenom: string; nom: string } | null; rendez_vous_prestations: { prestations: { tarif: number; sur_devis: boolean } | null }[] }[]) {
      if (!r.clients) continue;
      const key = `${r.clients.prenom} ${r.clients.nom}`;
      if (!clientMap[key]) clientMap[key] = { prenom: r.clients.prenom, nom: r.clients.nom, nb: 0, ca: 0 };
      clientMap[key].nb++;
      for (const rp of r.rendez_vous_prestations) {
        if (!rp.prestations?.sur_devis) clientMap[key].ca += rp.prestations?.tarif || 0;
      }
    }
    setTopClientes(Object.values(clientMap).sort((a, b) => b.ca - a.ca).slice(0, 10));

    // Projection CA par mois
    const projMap: Record<string, { ca: number; nb: number }> = {};
    for (const r of (projRes.data || []) as unknown as RdvRow[]) {
      const key = r.date_heure.slice(0, 7);
      if (!projMap[key]) projMap[key] = { ca: 0, nb: 0 };
      projMap[key].nb++;
      for (const rp of r.rendez_vous_prestations) {
        if (!rp.prestations?.sur_devis) projMap[key].ca += rp.prestations?.tarif || 0;
      }
    }
    setProjection(Object.entries(projMap).sort(([a], [b]) => a.localeCompare(b)).map(([mois, v]) => ({ mois, ...v })));

    // Calcul évolution mensuelle
    const moisMap: Record<string, { ca: number; nb: number }> = {};
    for (const r of (evoRes.data || []) as unknown as RdvRow[]) {
      const key = r.date_heure.slice(0, 7);
      if (!moisMap[key]) moisMap[key] = { ca: 0, nb: 0 };
      moisMap[key].nb++;
      for (const rp of r.rendez_vous_prestations) {
        if (!rp.prestations?.sur_devis) moisMap[key].ca += rp.prestations?.tarif || 0;
      }
    }
    const evo = Object.entries(moisMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, v]) => ({ mois, ...v }));
    setEvolution(evo);
    setLoading(false);
  }

  if (!salon) return null;
  const m = METIERS[salon.metier];
  const isFree = (salon.plan || "free") === "free";
  const isBusiness = salon.plan === "business" || salon.plan === "team";
  const { label } = getRange(periode);

  function LockedSection({ children }: { children: React.ReactNode }) {
    if (isBusiness) return <>{children}</>;
    return (
      <div style={{ borderRadius: 12, border: "1px solid #e0e0e0", overflow: "hidden" }}>
        {/* Titres visibles */}
        <div className="stats-locked-header" style={{ background: "#fafafa", borderBottom: "1px solid #e0e0e0", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Fonctionnalités Business</div>
            <div style={{ fontSize: 12, color: "#999" }}>Taux d'annulation · Top clientes · Projection CA · Graphiques évolution & répartition</div>
          </div>
          <a href="/dashboard/parametres" style={{ marginLeft: "auto", padding: "7px 16px", background: m.couleur, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            Passer à Business — 39€/mois
          </a>
        </div>
        {/* Contenu flouté */}
        <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none", opacity: 0.5, padding: "16px 20px" }}>{children}</div>
      </div>
    );
  }

  // Calculs
  const totalRdv = rdvs.length;
  const totalCA = rdvs.reduce((s, r) => s + r.rendez_vous_prestations.reduce((ss, rp) => ss + (rp.prestations?.sur_devis ? 0 : rp.prestations?.tarif || 0), 0), 0);
  const totalMinutes = rdvs.reduce((s, r) => s + r.rendez_vous_prestations.reduce((ss, rp) => ss + (rp.prestations?.duree_minutes || 0), 0), 0);
  const totalHeures = Math.floor(totalMinutes / 60);
  const totalMinutesReste = totalMinutes % 60;

  // CA par prestation
  const prestationMap: Record<string, StatPrestation> = {};
  for (const r of rdvs) {
    for (const rp of r.rendez_vous_prestations) {
      if (!rp.prestations) continue;
      const nom = rp.prestations.nom;
      if (!prestationMap[nom]) prestationMap[nom] = { nom, nb: 0, ca: 0, heures: 0 };
      prestationMap[nom].nb++;
      if (!rp.prestations.sur_devis) prestationMap[nom].ca += rp.prestations.tarif;
      prestationMap[nom].heures += rp.prestations.duree_minutes / 60;
    }
  }
  const statsPrestation = Object.values(prestationMap).sort((a, b) => b.ca - a.ca);

  const PERIODES: { key: Periode; label: string }[] = [
    { key: "semaine", label: "Semaine" },
    { key: "mois", label: "Mois en cours" },
    { key: "mois_precedent", label: "Mois précédent" },
    { key: "annee", label: "Année" },
  ];

  const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "20px 24px" };
  const labelGray: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 };
  const bigNum: React.CSSProperties = { fontSize: 32, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 };

  return (
    <div className="stats-wrap" style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 640px) {
          .stats-wrap { padding: 16px !important; }
          .stats-header { flex-direction: column !important; align-items: stretch !important; }
          .stats-periodes { display: none !important; }
          .stats-select { display: block !important; }
          .stats-kpis { grid-template-columns: 1fr !important; }
          .stats-presta-grid { grid-template-columns: 1fr !important; }
          .stats-locked-header { flex-direction: column !important; gap: 10px !important; }
          .stats-locked-header a { width: 100% !important; text-align: center !important; }
        }
      `}</style>
      <div className="stats-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Statistiques</h1>
        {/* Boutons — desktop */}
        <div className="stats-periodes" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODES.map(p => (
            <button key={p.key} onClick={() => setPeriode(p.key)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: periode === p.key ? 700 : 500, background: periode === p.key ? m.couleur : "#f0f0f0", color: periode === p.key ? "#fff" : "#666", cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Select — mobile */}
        <select className="stats-select" value={periode} onChange={e => setPeriode(e.target.value as Periode)}
          style={{ display: "none", width: "100%", padding: "10px 14px", border: `1px solid #e0e0e0`, borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#fff", color: "#1a1a1a", cursor: "pointer" }}>
          {PERIODES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {isFree ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Stats disponibles en plan Indépendant</div>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 24 }}>Suivez votre CA, vos heures de travail et vos prestations les plus rentables.</div>
          <a href="/dashboard/parametres" style={{ padding: "10px 24px", background: m.couleur, color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            Passer à 19€/mois
          </a>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 14 }}>Chargement…</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 20, fontWeight: 600 }}>{label}</div>

          {/* KPIs */}
          <div className="stats-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <div style={cardStyle}>
              <div style={labelGray}>Chiffre d'affaires</div>
              <div style={bigNum}>{totalCA}€</div>
            </div>
            <div style={cardStyle}>
              <div style={labelGray}>Rendez-vous</div>
              <div style={bigNum}>{totalRdv}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelGray}>Heures travaillées</div>
              <div style={bigNum}>{totalHeures}h{totalMinutesReste > 0 ? `${totalMinutesReste}` : ""}</div>
            </div>
          </div>

          {/* CA par prestation + camembert */}
          {statsPrestation.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>CA par prestation</div>
              <div className="stats-presta-grid" style={{ display: "grid", gridTemplateColumns: statsPrestation.filter(p => p.ca > 0).length > 0 ? "1fr 280px" : "1fr", gap: 24, alignItems: "start" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                      <th style={{ textAlign: "left", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>PRESTATION</th>
                      <th style={{ textAlign: "right", padding: "6px 12px", color: "#aaa", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>RDV</th>
                      <th style={{ textAlign: "right", padding: "6px 12px", color: "#aaa", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>HEURES</th>
                      <th style={{ textAlign: "right", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsPrestation.map((p, i) => (
                      <tr key={p.nom} style={{ borderBottom: i < statsPrestation.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                        <td style={{ padding: "10px 0", fontWeight: 500 }}>{p.nom}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#666", whiteSpace: "nowrap" }}>{p.nb}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#666", whiteSpace: "nowrap" }}>{Math.floor(p.heures)}h{Math.round((p.heures % 1) * 60) > 0 ? Math.round((p.heures % 1) * 60) : ""}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: m.couleur, whiteSpace: "nowrap" }}>{p.ca}€</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 0", fontWeight: 700 }}>Total</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{totalRdv}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{totalHeures}h{totalMinutesReste > 0 ? totalMinutesReste : ""}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: m.couleur }}>{totalCA}€</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Camembert — Business uniquement */}
                {statsPrestation.filter(p => p.ca > 0).length > 0 && (
                  isBusiness ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", marginBottom: 8 }}>Répartition CA</div>
                      <PieChart width={260} height={220}>
                        <Pie data={statsPrestation.filter(p => p.ca > 0)} dataKey="ca" nameKey="nom" cx="50%" cy="50%" outerRadius={80} label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                          {statsPrestation.filter(p => p.ca > 0).map((_, i) => (
                            <Cell key={i} fill={[m.couleur, "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#ec4899", "#14b8a6"][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => [`${v}€`, "CA"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, background: "#fafafa", borderRadius: 10, border: "1px dashed #e0e0e0", gap: 10, padding: 24 }}>
                      <div style={{ fontSize: 24 }}>🔒</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#555", textAlign: "center" }}>Graphique de répartition CA</div>
                      <div style={{ fontSize: 11, color: "#aaa", textAlign: "center" }}>Disponible en plan Business</div>
                      <a href="/dashboard/parametres" style={{ marginTop: 4, padding: "8px 16px", background: m.couleur, color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                        Passer à Business — 39€/mois
                      </a>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Évolution mensuelle */}
          {evolution.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Évolution mensuelle</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                    <th style={{ textAlign: "left", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>MOIS</th>
                    <th style={{ textAlign: "right", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>RDV</th>
                    <th style={{ textAlign: "right", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>CA</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.map((e, i) => {
                    const [year, month] = e.mois.split("-");
                    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                    const isCurrentMonth = e.mois === new Date().toISOString().slice(0, 7);
                    return (
                      <tr key={e.mois} style={{ borderBottom: i < evolution.length - 1 ? "1px solid #f5f5f5" : "none", background: isCurrentMonth ? `${m.couleur}08` : "transparent" }}>
                        <td style={{ padding: "10px 0", fontWeight: isCurrentMonth ? 700 : 400, textTransform: "capitalize" }}>{label}{isCurrentMonth ? " ←" : ""}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", color: "#666" }}>{e.nb}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: m.couleur }}>{e.ca}€</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats avancées Business — un seul bloc verrouillé */}
          <LockedSection>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Taux d'annulation</div>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div><div style={labelGray}>Annulés</div><div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{nbAnnules}</div></div>
                  <div><div style={labelGray}>Total</div><div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a" }}>{totalRdv + nbAnnules}</div></div>
                  <div><div style={labelGray}>Taux</div><div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a" }}>{totalRdv + nbAnnules > 0 ? Math.round((nbAnnules / (totalRdv + nbAnnules)) * 100) : 0}%</div></div>
                </div>
              </div>

              {topClientes.length > 0 && (
                <div style={{ ...cardStyle }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top clientes — classement par CA généré</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                      <th style={{ textAlign: "left", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>CLIENTE</th>
                      <th style={{ textAlign: "right", padding: "6px 12px", color: "#aaa", fontWeight: 600, fontSize: 11 }}>VISITES</th>
                      <th style={{ textAlign: "right", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>CA TOTAL</th>
                    </tr></thead>
                    <tbody>{topClientes.map((c, i) => (
                      <tr key={i} style={{ borderBottom: i < topClientes.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                        <td style={{ padding: "10px 0", fontWeight: 500 }}>{c.prenom} {c.nom}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#666" }}>{c.nb}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: m.couleur }}>{c.ca}€</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* Graphique évolution mensuelle */}
              {evolution.length > 0 && (
                <div style={{ ...cardStyle }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Évolution du CA — 12 derniers mois</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={evolution.map(e => {
                      const [year, month] = e.mois.split("-");
                      return { mois: new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("fr-FR", { month: "short" }), ca: e.ca, rdv: e.nb };
                    })} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: unknown) => [`${v}€`, "CA"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="ca" fill={m.couleur} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {projection.length > 0 && (
                <div style={{ ...cardStyle }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Projection CA — mois à venir</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>Basé sur les rendez-vous déjà confirmés</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                      <th style={{ textAlign: "left", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>MOIS</th>
                      <th style={{ textAlign: "right", padding: "6px 12px", color: "#aaa", fontWeight: 600, fontSize: 11 }}>RDV</th>
                      <th style={{ textAlign: "right", padding: "6px 0", color: "#aaa", fontWeight: 600, fontSize: 11 }}>CA PRÉVU</th>
                    </tr></thead>
                    <tbody>{projection.map((p, i) => {
                      const [year, month] = p.mois.split("-");
                      const lbl = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                      return (
                        <tr key={p.mois} style={{ borderBottom: i < projection.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                          <td style={{ padding: "10px 0", fontWeight: 500, textTransform: "capitalize" }}>{lbl}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#666" }}>{p.nb}</td>
                          <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: m.couleur }}>{p.ca}€</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}

            </div>
          </LockedSection>

          {totalRdv === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 14 }}>
              Aucun rendez-vous sur cette période.
            </div>
          )}
        </>
      )}
    </div>
  );
}

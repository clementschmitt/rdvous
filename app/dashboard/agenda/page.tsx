"use client";
import { useEffect, useState, useCallback } from "react";
import { useSalon } from "@/lib/salon-context";
import { METIERS } from "@/lib/metiers";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RDV = { id: string; date_heure: string; statut: string; clients: { prenom: string; nom: string } | null; rendez_vous_prestations: { prestations: { nom: string; duree_minutes: number } | null }[] };

const HEURES = Array.from({ length: 25 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`).filter(h => h <= "20:00");
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function AgendaPage() {
  const salon = useSalon();
  const router = useRouter();
  const [vue, setVue] = useState<"semaine" | "mois">("semaine");
  const [semaine, setSemaine] = useState(() => getMonday(new Date()));
  const [moisCourant, setMoisCourant] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [rdvs, setRdvs] = useState<RDV[]>([]);

  const loadSemaine = useCallback(async (lundi: Date) => {
    if (!salon) return;
    const supabase = createSupabase();
    const lundiStr = `${lundi.getFullYear()}-${String(lundi.getMonth()+1).padStart(2,'0')}-${String(lundi.getDate()).padStart(2,'0')}`;
    const fin = new Date(lundi); fin.setDate(fin.getDate() + 6);
    const finStr = `${fin.getFullYear()}-${String(fin.getMonth()+1).padStart(2,'0')}-${String(fin.getDate()).padStart(2,'0')}`;
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, clients(prenom, nom), rendez_vous_prestations(prestations(nom, duree_minutes))")
      .eq("salon_id", salon!.id)
      .gte("date_heure", `${lundiStr}T00:00:00`)
      .lte("date_heure", `${finStr}T23:59:59`)
      .neq("statut", "annule")
      .order("date_heure");
    setRdvs((data || []) as unknown as RDV[]);
  }, [salon]);

  const loadMois = useCallback(async (debut: Date) => {
    if (!salon) return;
    const supabase = createSupabase();
    const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0);
    const debutStr = `${debut.getFullYear()}-${String(debut.getMonth()+1).padStart(2,'0')}-01`;
    const finStr = `${fin.getFullYear()}-${String(fin.getMonth()+1).padStart(2,'0')}-${String(fin.getDate()).padStart(2,'0')}`;
    const { data } = await supabase
      .from("rendez_vous")
      .select("id, date_heure, statut, clients(prenom, nom), rendez_vous_prestations(prestations(nom, duree_minutes))")
      .eq("salon_id", salon!.id)
      .gte("date_heure", `${debutStr}T00:00:00`)
      .lte("date_heure", `${finStr}T23:59:59`)
      .neq("statut", "annule")
      .order("date_heure");
    setRdvs((data || []) as unknown as RDV[]);
  }, [salon]);

  useEffect(() => {
    if (vue === "semaine") loadSemaine(semaine);
    else loadMois(moisCourant);
  }, [salon, vue, semaine, moisCourant, loadSemaine, loadMois]);

  if (!salon) return null;
  const m = METIERS[salon.metier];

  const rdvMap: Record<string, RDV[]> = {};
  rdvs.forEach(rdv => {
    const key = `${rdv.date_heure.slice(0, 10)}_${rdv.date_heure.slice(11, 16)}`;
    if (!rdvMap[key]) rdvMap[key] = [];
    rdvMap[key].push(rdv);
  });

  const rdvDateMap: Record<string, RDV[]> = {};
  rdvs.forEach(rdv => {
    const dateKey = rdv.date_heure.slice(0, 10);
    if (!rdvDateMap[dateKey]) rdvDateMap[dateKey] = [];
    rdvDateMap[dateKey].push(rdv);
  });

  const joursDate = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semaine); d.setDate(semaine.getDate() + i); return d;
  });

  const today = new Date().toISOString().split("T")[0];

  function formatDateUrl(d: Date, h: string) {
    return `/dashboard/agenda/nouveau?date=${d.toISOString().split("T")[0]}&heure=${h}`;
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Agenda</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 3 }}>
            {(["semaine", "mois"] as const).map(v => (
              <button key={v} onClick={() => setVue(v)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: vue === v ? "#fff" : "transparent", fontWeight: vue === v ? 600 : 400, fontSize: 13, cursor: "pointer", boxShadow: vue === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {v === "semaine" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <Link href="/dashboard/agenda/nouveau" style={{ padding: "7px 16px", background: m.couleur, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            + Nouveau RDV
          </Link>
        </div>
      </div>

      {vue === "semaine" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setSemaine(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} style={navBtn}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: "center" }}>
              {semaine.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {new Date(semaine.getTime() + 6 * 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button onClick={() => setSemaine(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} style={navBtn}>›</button>
            <button onClick={() => setSemaine(getMonday(new Date()))} style={{ ...navBtn, fontSize: 12, padding: "4px 10px" }}>Auj.</button>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid #f0f0f0" }}>
              <div />
              {joursDate.map((d, i) => {
                const str = d.toISOString().split("T")[0];
                const isToday = str === today;
                return (
                  <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{JOURS[i]}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? m.couleur : "#222", width: 28, height: 28, borderRadius: "50%", background: isToday ? `${m.couleur}18` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto 0" }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
              {HEURES.map(heure => (
                <div key={heure} style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid #f8f8f8", minHeight: 40 }}>
                  <div style={{ fontSize: 11, color: "#bbb", padding: "2px 6px", textAlign: "right", paddingTop: 4 }}>{heure}</div>
                  {joursDate.map((d, i) => {
                    const str = d.toISOString().split("T")[0];
                    const key = `${str}_${heure}`;
                    const rdvsSlot = rdvMap[key] || [];
                    return (
                      <div
                        key={i}
                        onClick={() => router.push(formatDateUrl(d, heure))}
                        style={{ borderLeft: "1px solid #f0f0f0", padding: 2, cursor: "pointer", minHeight: 40 }}
                      >
                        {rdvsSlot.map(rdv => {
                          const duree = rdv.rendez_vous_prestations.reduce((s, rp) => s + (rp.prestations?.duree_minutes || 30), 0);
                          const h = Math.max(1, Math.round(duree / 30));
                          return (
                            <Link
                              key={rdv.id}
                              href={`/dashboard/agenda/${rdv.id}`}
                              onClick={e => e.stopPropagation()}
                              style={{ display: "block", background: `${m.couleur}18`, border: `1px solid ${m.couleur}40`, borderRadius: 5, padding: "2px 6px", fontSize: 11, color: m.couleur, fontWeight: 600, textDecoration: "none", minHeight: h * 40 - 6 }}
                            >
                              {rdv.clients?.prenom} {rdv.clients?.nom?.slice(0, 1)}.
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {vue === "mois" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setMoisCourant(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={navBtn}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 160, textAlign: "center" }}>
              {moisCourant.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => setMoisCourant(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={navBtn}>›</button>
            <button onClick={() => setMoisCourant(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} style={{ ...navBtn, fontSize: 12, padding: "4px 10px" }}>Auj.</button>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0f0f0" }}>
              {JOURS.map(j => <div key={j} style={{ padding: "10px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#aaa" }}>{j}</div>)}
            </div>
            <MoisGrid moisCourant={moisCourant} rdvDateMap={rdvDateMap} couleur={m.couleur} today={today} router={router} />
          </div>
        </>
      )}
    </div>
  );
}

function MoisGrid({ moisCourant, rdvDateMap, couleur, today, router }: { moisCourant: Date; rdvDateMap: Record<string, RDV[]>; couleur: string; today: string; router: ReturnType<typeof useRouter> }) {
  const firstDay = new Date(moisCourant.getFullYear(), moisCourant.getMonth(), 1);
  const lastDay = new Date(moisCourant.getFullYear(), moisCourant.getMonth() + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array(startOffset).fill(null)];
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(moisCourant.getFullYear(), moisCourant.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
      {cells.map((d, i) => {
        if (!d) return <div key={i} style={{ minHeight: 80, borderRight: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }} />;
        const str = d.toISOString().split("T")[0];
        const isToday = str === today;
        const rdvs = rdvDateMap[str] || [];
        return (
          <div key={i} onClick={() => router.push(`/dashboard/agenda/nouveau?date=${str}`)} style={{ minHeight: 80, borderRight: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", padding: 8, cursor: "pointer" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? couleur : "transparent", color: isToday ? "#fff" : "#444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>{d.getDate()}</div>
            {rdvs.slice(0, 3).map(rdv => (
              <Link key={rdv.id} href={`/dashboard/agenda/${rdv.id}`} onClick={e => e.stopPropagation()} style={{ display: "block", fontSize: 10, color: couleur, background: `${couleur}15`, borderRadius: 3, padding: "1px 4px", marginBottom: 2, textDecoration: "none", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {rdv.date_heure.slice(11, 16)} {rdv.clients?.prenom}
              </Link>
            ))}
            {rdvs.length > 3 && <div style={{ fontSize: 10, color: "#999" }}>+{rdvs.length - 3}</div>}
          </div>
        );
      })}
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "6px 12px", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 7, cursor: "pointer", fontSize: 16, fontWeight: 600 };

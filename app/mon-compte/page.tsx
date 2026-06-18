"use client";
import { useEffect, useState } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { METIERS, type Metier } from "@/lib/metiers";
import Link from "next/link";

type Rdv = {
  id: string;
  date_heure: string;
  statut: string;
  salon_id: string;
  salons: { nom: string; slug: string; metier: string } | null;
  rendez_vous_prestations: { prestations: { nom: string } | null }[];
};

function metierCouleur(metier?: string): { couleur: string; clair: string } {
  const m = metier && METIERS[metier as Metier];
  return m ? { couleur: m.couleur, clair: m.couleurClaire } : { couleur: "#6b2d42", clair: "#d4b8b0" };
}

function joursAvant(dateStr: string): string {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - n.getTime()) / 86400000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff < 7) return `Dans ${diff} jours`;
  if (diff < 14) return "La semaine prochaine";
  return `Dans ${Math.round(diff / 7)} semaines`;
}

function rebookPath(rdv: Rdv): string {
  return rdv.salons?.slug ? `/${rdv.salons.slug}` : `/s/${rdv.salon_id}`;
}

export default function MonComptePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [cagnottes, setCagnottes] = useState<{ salon_id: string; salon_nom: string; metier: string; montant: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ rdv_id: string; action: "annuler" | "deplacer" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (user.user_metadata?.user_type === "artisan") { router.push("/dashboard"); return; }

      setEmail(user.email || null);
      const { data: { session } } = await supabase.auth.getSession();
      setToken(session?.access_token || null);

      const res = await fetch("/api/mon-compte", { headers: { authorization: `Bearer ${session?.access_token}` } });
      if (res.ok) {
        const json = await res.json();
        setCagnottes(json.cagnottes || []);
        setRdvs(json.rdvs || []);
      }
      setLoading(false);
    })();
  }, [router]);

  async function handleLogout() {
    const supabase = createSupabase();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleConfirm() {
    if (!confirm || !token) return;
    setActionLoading(true);
    setActionError("");
    const res = await fetch("/api/mon-compte/annuler", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rdv_id: confirm.rdv_id }),
    });
    const json = await res.json();
    if (!json.ok) { setActionError(json.error || "Erreur, veuillez réessayer."); setActionLoading(false); return; }
    if (confirm.action === "annuler") {
      setRdvs(prev => prev.map(r => r.id === confirm.rdv_id ? { ...r, statut: "annule" } : r));
      setConfirm(null);
    } else {
      const rdv = rdvs.find(r => r.id === confirm.rdv_id);
      if (rdv) router.push(`${rebookPath(rdv)}?email=${encodeURIComponent(email || "")}`);
    }
    setActionLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ fontSize: 13, color: T.muted }}>Chargement…</div>
    </div>
  );

  const now = new Date();
  const upcoming = rdvs
    .filter(r => new Date(r.date_heure) > now && r.statut === "planifie")
    .sort((a, b) => a.date_heure.localeCompare(b.date_heure));
  const history = rdvs
    .filter(r => !(new Date(r.date_heure) > now && r.statut === "planifie"))
    .sort((a, b) => b.date_heure.localeCompare(a.date_heure));
  const hero = upcoming[0];
  const autresAvenir = upcoming.slice(1);

  const Avatar = ({ rdv, size = 44 }: { rdv: Rdv; size?: number }) => {
    const c = metierCouleur(rdv.salons?.metier);
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: c.clair, color: c.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.heading, fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>
        {(rdv.salons?.nom || "?").charAt(0).toUpperCase()}
      </div>
    );
  };

  const ActionConfirm = ({ rdv }: { rdv: Rdv }) => (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(0,0,0,0.03)", borderRadius: 12 }}>
      <div style={{ fontSize: 13, color: T.text, marginBottom: 10, lineHeight: 1.5 }}>
        {confirm?.action === "annuler"
          ? "Confirmer l'annulation de ce rendez-vous ?"
          : "Ce rendez-vous sera annulé et on vous emmène chez le salon pour en reprendre un nouveau."}
      </div>
      {actionError && <div style={{ fontSize: 12, color: "#e74c3c", marginBottom: 10 }}>{actionError}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleConfirm} disabled={actionLoading}
          style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: confirm?.action === "annuler" ? "#e74c3c" : T.text, border: "none", borderRadius: 10, padding: "9px 18px", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}>
          {actionLoading ? "…" : confirm?.action === "annuler" ? "Oui, annuler" : "Continuer"}
        </button>
        <button onClick={() => { setConfirm(null); setActionError(""); }}
          style={{ fontSize: 13, color: T.muted, background: "none", border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 18px", cursor: "pointer" }}>
          Retour
        </button>
      </div>
    </div>
  );

  const RdvActions = ({ rdv }: { rdv: Rdv }) => (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button onClick={() => { setConfirm({ rdv_id: rdv.id, action: "deplacer" }); setActionError(""); }}
        style={{ fontSize: 12, fontWeight: 600, color: T.text, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
        Déplacer
      </button>
      <button onClick={() => { setConfirm({ rdv_id: rdv.id, action: "annuler" }); setActionError(""); }}
        style={{ fontSize: 12, fontWeight: 600, color: "#e74c3c", background: "#fff", border: "1px solid #fca5a5", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
        Annuler
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px 64px" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 600, color: T.text, margin: 0, letterSpacing: "-0.3px" }}>Bonjour 👋</h1>
            {email && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{email}</div>}
          </div>
          <button onClick={handleLogout} style={{ fontSize: 12, color: T.muted, background: "none", border: `1px solid ${T.border}`, borderRadius: 20, padding: "7px 16px", cursor: "pointer" }}>
            Déconnexion
          </button>
        </div>

        {/* Cagnotte fidélité — propre à chaque salon */}
        {cagnottes.length > 0 ? (
          <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderRadius: 18, padding: "18px 20px", marginBottom: 28, boxShadow: "0 4px 16px rgba(217,119,6,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cagnotte fidélité</div>
              <div style={{ fontSize: 22 }}>🎉</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cagnottes.map(cg => (
                <div key={cg.salon_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.55)", borderRadius: 12, padding: "11px 15px" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#78350f" }}>{cg.salon_nom}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>{cg.montant} €</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 11, textAlign: "center", opacity: 0.85 }}>Chaque cagnotte est utilisable uniquement dans son salon</div>
          </div>
        ) : (
          <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderRadius: 18, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 16px rgba(217,119,6,0.12)" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Cagnotte fidélité</div>
              <div style={{ fontSize: 14, color: "#78350f", fontWeight: 500, maxWidth: 280, lineHeight: 1.4 }}>Cumulez des points à chaque visite et gagnez des récompenses.</div>
            </div>
            <div style={{ fontSize: 34 }}>🎁</div>
          </div>
        )}

        {/* Prochain rendez-vous — hero */}
        {hero && (() => {
          const c = metierCouleur(hero.salons?.metier);
          const date = new Date(hero.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
          const heure = hero.date_heure.slice(11, 16);
          const prestations = hero.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
          const isConfirming = confirm?.rdv_id === hero.id;
          return (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Prochain rendez-vous</div>
              <div style={{ background: T.white, borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,0.07)", border: `1px solid ${c.clair}66` }}>
                <div style={{ height: 5, background: c.couleur }} />
                <div style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar rdv={hero} size={48} />
                      <div>
                        <div style={{ fontFamily: T.heading, fontSize: 20, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>{hero.salons?.nom || "Salon"}</div>
                        {prestations && <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{prestations}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.couleur, background: c.clair + "55", padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{joursAvant(hero.date_heure)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, textTransform: "capitalize" }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{date}</span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: c.couleur }}>{heure}</span>
                  </div>
                  {isConfirming ? <ActionConfirm rdv={hero} /> : <RdvActions rdv={hero} />}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Autres rendez-vous à venir */}
        {autresAvenir.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>À venir</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {autresAvenir.map(rdv => {
                const c = metierCouleur(rdv.salons?.metier);
                const date = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                const heure = rdv.date_heure.slice(11, 16);
                const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                const isConfirming = confirm?.rdv_id === rdv.id;
                return (
                  <div key={rdv.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar rdv={rdv} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{rdv.salons?.nom || "Salon"}</div>
                        <div style={{ fontSize: 12, color: T.muted, textTransform: "capitalize" }}>{date} · {heure}{prestations ? ` · ${prestations}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.couleur, whiteSpace: "nowrap" }}>{joursAvant(rdv.date_heure)}</span>
                    </div>
                    {isConfirming ? <ActionConfirm rdv={rdv} /> : <RdvActions rdv={rdv} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aucun RDV à venir */}
        {upcoming.length === 0 && (
          <div style={{ background: T.white, borderRadius: 18, border: `1px solid ${T.border}`, padding: "36px 24px", textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>Aucun rendez-vous à venir</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>Prenez rendez-vous chez vos salons préférés.</div>
            <Link href="/" style={{ display: "inline-block", background: T.text, color: "#fff", borderRadius: 12, padding: "11px 24px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Trouver un salon
            </Link>
          </div>
        )}

        {/* Historique — repliable */}
        {history.length > 0 && (
          <div>
            <button onClick={() => setShowHistory(s => !s)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 0", marginBottom: showHistory ? 10 : 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Historique ({history.length})</span>
              <span style={{ fontSize: 13, color: T.muted, transform: showHistory ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>
            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map(rdv => {
                  const date = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                  const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                  const annule = rdv.statut === "annule";
                  return (
                    <div key={rdv.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "13px 16px", opacity: annule ? 0.7 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar rdv={rdv} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{rdv.salons?.nom || "Salon"}</div>
                          <div style={{ fontSize: 12, color: T.muted, textTransform: "capitalize" }}>{date}{prestations ? ` · ${prestations}` : ""}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: annule ? "#e74c3c" : "#999", background: annule ? "#fee2e2" : "#f0f0f0", padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
                          {annule ? "Annulé" : "Terminé"}
                        </span>
                      </div>
                      <button onClick={() => router.push(`${rebookPath(rdv)}?email=${encodeURIComponent(email || "")}`)}
                        style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: metierCouleur(rdv.salons?.metier).couleur, background: "none", border: `1px solid ${metierCouleur(rdv.salons?.metier).clair}`, borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
                        Reprendre rendez-vous
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import Link from "next/link";

type Rdv = {
  id: string;
  date_heure: string;
  statut: string;
  salon_id: string;
  salons: { nom: string; slug: string } | null;
  rendez_vous_prestations: { prestations: { nom: string } | null }[];
};

export default function MonComptePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [cagnotte, setCagnotte] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ rdv_id: string; action: "annuler" | "deplacer" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (user.user_metadata?.user_type === "artisan") { router.push("/dashboard"); return; }

      setEmail(user.email || null);

      const { data: { session } } = await supabase.auth.getSession();
      setToken(session?.access_token || null);

      const res = await fetch("/api/mon-compte", {
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCagnotte(json.cagnotte || 0);
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

    if (!json.ok) {
      setActionError(json.error || "Erreur, veuillez réessayer.");
      setActionLoading(false);
      return;
    }

    if (confirm.action === "annuler") {
      setRdvs(prev => prev.map(r => r.id === confirm.rdv_id ? { ...r, statut: "annule" } : r));
      setConfirm(null);
    } else {
      const rdv = rdvs.find(r => r.id === confirm.rdv_id);
      const path = rdv?.salons?.slug ? `/${rdv.salons.slug}` : `/s/${rdv?.salon_id}`;
      router.push(`${path}?email=${encodeURIComponent(email || "")}`);
    }

    setActionLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ fontSize: 13, color: T.muted }}>Chargement…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: T.heading, fontSize: 28, fontWeight: 600, color: T.text, margin: 0 }}>Mon espace</h1>
            {email && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{email}</div>}
          </div>
          <button onClick={handleLogout} style={{ fontSize: 12, color: T.muted, background: "none", border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>
            Déconnexion
          </button>
        </div>

        {cagnotte !== null && cagnotte > 0 && (
          <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Cagnotte fidélité</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a" }}>{cagnotte} €</div>
            </div>
            <div style={{ fontSize: 28 }}>🎉</div>
          </div>
        )}

        <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mes rendez-vous</div>
          </div>
          {rdvs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: T.muted }}>
              Aucun rendez-vous trouvé.
              <div style={{ marginTop: 12 }}>
                <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Trouver un artisan →</Link>
              </div>
            </div>
          ) : (
            rdvs.map((rdv, i) => {
              const date = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
              const heure = rdv.date_heure.slice(11, 16);
              const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
              const isFuture = new Date(rdv.date_heure) > new Date();
              const isPlanifie = rdv.statut === "planifie";
              const canAct = isFuture && isPlanifie;
              const statutColor = rdv.statut === "planifie" ? "#16a34a" : rdv.statut === "annule" ? "#e74c3c" : "#999";
              const statutLabel = rdv.statut === "planifie" ? "Planifié" : rdv.statut === "effectue" ? "Effectué" : rdv.statut === "annule" ? "Annulé" : rdv.statut;
              const isConfirming = confirm?.rdv_id === rdv.id;

              return (
                <div key={rdv.id} style={{ padding: "14px 20px", borderBottom: i < rdvs.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>{rdv.salons?.nom || "Salon"}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{date} à {heure}</div>
                      {prestations && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{prestations}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statutColor, whiteSpace: "nowrap", paddingTop: 2 }}>
                      {statutLabel}
                    </span>
                  </div>

                  {canAct && !isConfirming && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => { setConfirm({ rdv_id: rdv.id, action: "deplacer" }); setActionError(""); }}
                        style={{ fontSize: 11, fontWeight: 600, color: T.text, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
                        Déplacer
                      </button>
                      <button
                        onClick={() => { setConfirm({ rdv_id: rdv.id, action: "annuler" }); setActionError(""); }}
                        style={{ fontSize: 11, fontWeight: 600, color: "#e74c3c", background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
                        Annuler
                      </button>
                    </div>
                  )}

                  {isConfirming && (
                    <div style={{ marginTop: 10, padding: "10px 12px", background: "#fafafa", borderRadius: 8, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 12, color: T.text, marginBottom: 8 }}>
                        {confirm.action === "annuler"
                          ? "Confirmer l'annulation de ce rendez-vous ?"
                          : "Ce rendez-vous sera annulé et vous serez redirigé vers le salon pour en prendre un nouveau."}
                      </div>
                      {actionError && <div style={{ fontSize: 12, color: "#e74c3c", marginBottom: 8 }}>{actionError}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleConfirm} disabled={actionLoading}
                          style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: confirm.action === "annuler" ? "#e74c3c" : T.text, border: "none", borderRadius: 6, padding: "6px 14px", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                          {actionLoading ? "…" : confirm.action === "annuler" ? "Oui, annuler" : "Continuer"}
                        </button>
                        <button onClick={() => { setConfirm(null); setActionError(""); }}
                          style={{ fontSize: 12, color: T.muted, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                          Retour
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

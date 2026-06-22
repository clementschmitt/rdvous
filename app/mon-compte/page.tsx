"use client";
import { useEffect, useRef, useState } from "react";
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
  tarif: number | null;
  photo_reference_url: string | null;
  salons: { nom: string; slug: string; metier: string } | null;
  rendez_vous_prestations: { prestations: { nom: string; tarif: number; sur_devis: boolean } | null }[];
};

type Favori = {
  salon_id: string;
  salons: { nom: string; slug: string; metier: string } | null;
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

function calcPrix(rdv: Rdv): number | null {
  if (rdv.tarif != null) return rdv.tarif;
  const items = rdv.rendez_vous_prestations.filter(rp => rp.prestations && !rp.prestations.sur_devis);
  if (!items.length) return null;
  return items.reduce((s, rp) => s + (rp.prestations?.tarif || 0), 0);
}

function Stars({ note, size = 16 }: { note: number; size?: number }) {
  return (
    <span>{[1,2,3,4,5].map(i => (
      <span key={i} style={{ fontSize: size, color: i <= note ? "#f5a623" : "#e0e0e0" }}>★</span>
    ))}</span>
  );
}

function StarSelector({ note, onChange }: { note: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", color: i <= (hover || note) ? "#f5a623" : "#e0e0e0", padding: "0 2px", lineHeight: 1 }}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function MonComptePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [cagnottes, setCagnottes] = useState<{ salon_id: string; salon_nom: string; metier: string; montant: number }[]>([]);
  const [favoris, setFavoris] = useState<Favori[]>([]);
  const [salonsRevus, setSalonsRevus] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ rdv_id: string; action: "annuler" | "deplacer" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const [avisForm, setAvisForm] = useState<Record<string, { note: number; commentaire: string }>>({});
  const [avisLoading, setAvisLoading] = useState<Record<string, boolean>>({});
  const [avisSubmitted, setAvisSubmitted] = useState<Set<string>>(new Set());

  const [photoLoading, setPhotoLoading] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
        setFavoris(json.favoris || []);
        setSalonsRevus(new Set(json.salonsRevus || []));
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
    setActionLoading(true); setActionError("");
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

  async function toggleFavori(salon_id: string, salonData: { nom: string; slug: string; metier: string } | null) {
    if (!token) return;
    const isFavori = favoris.some(f => f.salon_id === salon_id);
    setFavoris(prev => isFavori ? prev.filter(f => f.salon_id !== salon_id) : [...prev, { salon_id, salons: salonData }]);
    await fetch("/api/mon-compte/favoris", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id, action: isFavori ? "remove" : "add" }),
    });
  }

  async function submitAvis(rdv_id: string, salon_id: string) {
    const form = avisForm[rdv_id];
    if (!form?.note || !token) return;
    setAvisLoading(prev => ({ ...prev, [rdv_id]: true }));
    const res = await fetch("/api/mon-compte/avis", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rdv_id, salon_id, note: form.note, commentaire: form.commentaire }),
    });
    setAvisLoading(prev => ({ ...prev, [rdv_id]: false }));
    if (res.ok) {
      setAvisSubmitted(prev => new Set([...prev, rdv_id]));
      setSalonsRevus(prev => new Set([...prev, salon_id]));
    }
  }

  async function uploadPhoto(rdv_id: string, file: File) {
    if (!token) return;
    setPhotoLoading(prev => ({ ...prev, [rdv_id]: true }));
    setPhotoError(prev => ({ ...prev, [rdv_id]: "" }));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("rdv_id", rdv_id);
    try {
      const res = await fetch("/api/mon-compte/photo", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        setRdvs(prev => prev.map(r => r.id === rdv_id ? { ...r, photo_reference_url: json.url } : r));
      } else {
        setPhotoError(prev => ({ ...prev, [rdv_id]: json.error || "Erreur upload" }));
      }
    } catch {
      setPhotoError(prev => ({ ...prev, [rdv_id]: "Erreur réseau" }));
    }
    setPhotoLoading(prev => ({ ...prev, [rdv_id]: false }));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ fontSize: 13, color: T.muted }}>Chargement…</div>
    </div>
  );

  const now = new Date();
  const upcoming = rdvs.filter(r => new Date(r.date_heure) > now && r.statut === "planifie").sort((a, b) => a.date_heure.localeCompare(b.date_heure));
  const history = rdvs.filter(r => !(new Date(r.date_heure) > now && r.statut === "planifie")).sort((a, b) => b.date_heure.localeCompare(a.date_heure));
  const hero = upcoming[0];
  const autresAvenir = upcoming.slice(1);

  // Premier rdv effectué par salon sans avis → afficher le formulaire
  const rdvsWithAvisForm = new Set<string>();
  const seenSalons = new Set<string>();
  for (const rdv of history) {
    if (rdv.statut === "effectue" && !salonsRevus.has(rdv.salon_id) && !seenSalons.has(rdv.salon_id) && !avisSubmitted.has(rdv.id)) {
      rdvsWithAvisForm.add(rdv.id);
      seenSalons.add(rdv.salon_id);
    }
  }

  const Avatar = ({ rdv, size = 44 }: { rdv: Rdv; size?: number }) => {
    const c = metierCouleur(rdv.salons?.metier);
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: c.clair, color: c.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.heading, fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>
        {(rdv.salons?.nom || "?").charAt(0).toUpperCase()}
      </div>
    );
  };

  const HeartBtn = ({ rdv }: { rdv: Rdv }) => {
    const isFavori = favoris.some(f => f.salon_id === rdv.salon_id);
    return (
      <button onClick={() => toggleFavori(rdv.salon_id, rdv.salons)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 4px", color: isFavori ? "#e74c3c" : "#ccc", lineHeight: 1 }}
        title={isFavori ? "Retirer des favoris" : "Ajouter aux favoris"}>
        {isFavori ? "♥" : "♡"}
      </button>
    );
  };

  const ActionConfirm = ({ rdv }: { rdv: Rdv }) => (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(0,0,0,0.03)", borderRadius: 12 }}>
      <div style={{ fontSize: 13, color: T.text, marginBottom: 10, lineHeight: 1.5 }}>
        {confirm?.action === "annuler" ? "Confirmer l'annulation de ce rendez-vous ?" : "Ce rendez-vous sera annulé et on vous emmène chez le salon pour en reprendre un nouveau."}
      </div>
      {actionError && <div style={{ fontSize: 12, color: "#e74c3c", marginBottom: 10 }}>{actionError}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleConfirm} disabled={actionLoading}
          style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: confirm?.action === "annuler" ? "#e74c3c" : T.text, border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer", opacity: actionLoading ? 0.6 : 1 }}>
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

  const AvisForm = ({ rdv }: { rdv: Rdv }) => {
    const form = avisForm[rdv.id] || { note: 0, commentaire: "" };
    const loading = avisLoading[rdv.id];
    const submitted = avisSubmitted.has(rdv.id);

    if (submitted) return (
      <div style={{ marginTop: 12, padding: "12px 14px", background: "#f0fdf4", borderRadius: 12, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
        ✓ Merci pour votre avis !
      </div>
    );

    return (
      <div style={{ marginTop: 12, padding: "14px", background: "#fafafa", borderRadius: 12, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Laisser un avis</div>
        <StarSelector note={form.note} onChange={n => setAvisForm(prev => ({ ...prev, [rdv.id]: { ...form, note: n } }))} />
        {form.note > 0 && (
          <>
            <textarea
              placeholder="Commentaire (optionnel)"
              value={form.commentaire}
              onChange={e => setAvisForm(prev => ({ ...prev, [rdv.id]: { ...form, commentaire: e.target.value } }))}
              style={{ marginTop: 10, width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", minHeight: 60, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <button onClick={() => submitAvis(rdv.id, rdv.salon_id)} disabled={loading}
              style={{ marginTop: 8, padding: "8px 18px", background: T.text, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Envoi…" : "Envoyer"}
            </button>
          </>
        )}
      </div>
    );
  };

  const PhotoSection = ({ rdv }: { rdv: Rdv }) => {
    const loading = photoLoading[rdv.id];
    const err = photoError[rdv.id];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        {err && <div style={{ fontSize: 11, color: "#e74c3c", maxWidth: 140, textAlign: "right" }}>{err}</div>}
        {rdv.photo_reference_url ? (
          <div style={{ position: "relative" }}>
            <img
              src={rdv.photo_reference_url} alt="Photo de référence"
              onClick={() => setLightboxUrl(rdv.photo_reference_url)}
              style={{ width: 130, height: 110, borderRadius: 10, objectFit: "cover", cursor: "zoom-in", display: "block" }}
            />
            <button onClick={() => photoInputRefs.current[rdv.id]?.click()}
              style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>
              Changer
            </button>
          </div>
        ) : (
          <button onClick={() => photoInputRefs.current[rdv.id]?.click()} disabled={loading}
            style={{ fontSize: 11, color: T.muted, background: "none", border: `1px dashed ${T.border}`, borderRadius: 9, padding: "8px 12px", cursor: "pointer", opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {loading ? "Envoi…" : "📷 Ajouter une photo"}
          </button>
        )}
        <input type="file" accept="image/*" style={{ display: "none" }}
          ref={el => { photoInputRefs.current[rdv.id] = el; }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(rdv.id, f); }}
        />
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 64px" }}>

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

        {/* Cagnotte fidélité */}
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

        {/* Salons favoris */}
        {favoris.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Mes salons favoris</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {favoris.map(f => {
                const c = metierCouleur(f.salons?.metier);
                const path = f.salons?.slug ? `/${f.salons.slug}` : `/s/${f.salon_id}`;
                return (
                  <div key={f.salon_id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.clair, color: c.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.heading, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {(f.salons?.nom || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{f.salons?.nom || "Salon"}</div>
                    </div>
                    <Link href={path} style={{ fontSize: 12, fontWeight: 700, color: c.couleur, background: c.clair + "55", padding: "6px 14px", borderRadius: 20, textDecoration: "none", whiteSpace: "nowrap" }}>
                      Prendre RDV
                    </Link>
                    <button onClick={() => toggleFavori(f.salon_id, f.salons)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#e74c3c", padding: 0, lineHeight: 1 }}>♥</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Prochain rendez-vous — hero */}
        {hero && (() => {
          const c = metierCouleur(hero.salons?.metier);
          const date = new Date(hero.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
          const heure = hero.date_heure.slice(11, 16);
          const prestations = hero.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
          const isConfirming = confirm?.rdv_id === hero.id;
          const prix = calcPrix(hero);
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
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontFamily: T.heading, fontSize: 20, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>{hero.salons?.nom || "Salon"}</span>
                          <HeartBtn rdv={hero} />
                        </div>
                        {prestations && <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{prestations}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.couleur, background: c.clair + "55", padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>{joursAvant(hero.date_heure)}</span>
                      {prix != null && <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{prix} €</span>}
                    </div>
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
                const prix = calcPrix(rdv);
                return (
                  <div key={rdv.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar rdv={rdv} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{rdv.salons?.nom || "Salon"}</span>
                          <HeartBtn rdv={rdv} />
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, textTransform: "capitalize" }}>{date} · {heure}{prestations ? ` · ${prestations}` : ""}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.couleur, whiteSpace: "nowrap" }}>{joursAvant(rdv.date_heure)}</span>
                        {prix != null && <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{prix} €</span>}
                      </div>
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

        {/* Historique */}
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
                  const effectue = rdv.statut === "effectue";
                  const prix = calcPrix(rdv);
                  const showAvis = rdvsWithAvisForm.has(rdv.id);
                  return (
                    <div key={rdv.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "13px 16px", opacity: annule ? 0.7 : 1, display: "flex", gap: 16, alignItems: "flex-start" }}>
                      {/* Contenu gauche */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar rdv={rdv} size={38} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{rdv.salons?.nom || "Salon"}</span>
                              {effectue && <HeartBtn rdv={rdv} />}
                            </div>
                            <div style={{ fontSize: 12, color: T.muted, textTransform: "capitalize" }}>{date}{prestations ? ` · ${prestations}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: annule ? "#e74c3c" : "#999", background: annule ? "#fee2e2" : "#f0f0f0", padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
                              {annule ? "Annulé" : "Terminé"}
                            </span>
                            {prix != null && <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{prix} €</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <button onClick={() => router.push(`${rebookPath(rdv)}?email=${encodeURIComponent(email || "")}`)}
                            style={{ fontSize: 12, fontWeight: 600, color: metierCouleur(rdv.salons?.metier).couleur, background: "none", border: `1px solid ${metierCouleur(rdv.salons?.metier).clair}`, borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
                            Reprendre rendez-vous
                          </button>
                        </div>
                        {showAvis && <AvisForm rdv={rdv} />}
                      </div>
                      {/* Photo droite */}
                      {effectue && <PhotoSection rdv={rdv} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "zoom-out" }}>
          <img src={lightboxUrl} alt="Photo agrandie"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          />
          <button onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: "50%", width: 38, height: 38, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { METIERS, type Metier } from "@/lib/metiers";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { useAccueilHref } from "@/lib/accueil";
import { useAccentColor } from "@/lib/accent-color";

type Rdv = {
  id: string;
  date_heure: string;
  statut: string;
  salon_id: string;
  tarif: number | null;
  duree_minutes: number | null;
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
  // "La semaine prochaine" uniquement si dans la vraie semaine calendaire suivante
  const lundiCetteSemai = new Date(n); lundiCetteSemai.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  const lundiProchaine = new Date(lundiCetteSemai); lundiProchaine.setDate(lundiCetteSemai.getDate() + 7);
  const dimancheProchaine = new Date(lundiProchaine); dimancheProchaine.setDate(lundiProchaine.getDate() + 6);
  if (d >= lundiProchaine && d <= dimancheProchaine) return "La semaine prochaine";
  return `Dans ${Math.round(diff / 7)} semaines`;
}

function calendarData(rdv: Rdv) {
  const dateStr = rdv.date_heure.slice(0, 10).replace(/-/g, "");
  const startH = parseInt(rdv.date_heure.slice(11, 13));
  const startM = parseInt(rdv.date_heure.slice(14, 16));
  const duree = rdv.duree_minutes || 60;
  const endTotalMin = startH * 60 + startM + duree;
  const endH = String(Math.floor(endTotalMin / 60) % 24).padStart(2, "0");
  const endM = String(endTotalMin % 60).padStart(2, "0");
  const startTime = `${String(startH).padStart(2, "0")}${String(startM).padStart(2, "0")}00`;
  const endTime = `${endH}${endM}00`;
  const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
  const title = `${prestations || "Rendez-vous"}, ${rdv.salons?.nom || ""}`;
  return { dateStr, startTime, endTime, title };
}

function googleCalendarUrl(rdv: Rdv): string {
  const { dateStr, startTime, endTime, title } = calendarData(rdv);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateStr}T${startTime}/${dateStr}T${endTime}`;
}

function outlookUrl(rdv: Rdv): string {
  const { dateStr, startTime, endTime, title } = calendarData(rdv);
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${dateStr}T${startTime}&enddt=${dateStr}T${endTime}&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent`;
}

function office365Url(rdv: Rdv): string {
  const { dateStr, startTime, endTime, title } = calendarData(rdv);
  return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${dateStr}T${startTime}&enddt=${dateStr}T${endTime}&path=%2Fcalendar%2Faction%2Fcompose&rru=addevent`;
}

function yahooUrl(rdv: Rdv): string {
  const { dateStr, startTime, endTime, title } = calendarData(rdv);
  return `https://calendar.yahoo.com/?v=60&title=${encodeURIComponent(title)}&st=${dateStr}T${startTime}&et=${dateStr}T${endTime}`;
}


/**
 * Ouvre le fichier calendrier servi par le serveur. Sur mobile le système
 * propose alors l'application de calendrier de l'utilisatrice, et contrairement
 * au blob ci-dessus ça fonctionne dans le webview de l'application.
 */
function ouvrirIcs(rdv: Rdv): void {
  window.open(`/api/rdv/ics?id=${rdv.id}`, "_blank");
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
  const [prenom, setPrenom] = useState<string | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [cagnottes, setCagnottes] = useState<{ salon_id: string; salon_nom: string; metier: string; montant: number; nb_visites: number; nb_visites_fidelite: number; montant_recompense: number }[]>([]);
  const [favoris, setFavoris] = useState<Favori[]>([]);
  const [salonsRevus, setSalonsRevus] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ rdv_id: string; action: "annuler" | "deplacer" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const accueilHref = useAccueilHref();

  const [avisForm, setAvisForm] = useState<Record<string, { note: number; commentaire: string }>>({});
  const [avisLoading, setAvisLoading] = useState<Record<string, boolean>>({});
  const [avisSubmitted, setAvisSubmitted] = useState<Set<string>>(new Set());
  const [calendarMenuOpen, setCalendarMenuOpen] = useState<string | null>(null);

  const [photoLoading, setPhotoLoading] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"rdvs" | "favoris" | "galerie">("rdvs");
  const { color: accentColor } = useAccentColor();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      // On ne renvoie vers le dashboard que si le compte gère réellement un salon.
      const { data: suPro } = await supabase.from("salon_users").select("salon_id").eq("user_id", user.id).maybeSingle();
      if (suPro) { router.push("/dashboard"); return; }

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
        setPrenom(json.prenom || null);
      }
      setLoading(false);
    })();
  }, [router]);

  async function handleLogout() {
    const supabase = createSupabase();
    await supabase.auth.signOut();
    // Se déconnecter ne doit pas faire sortir de l'application.
    router.push(accueilHref);
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
    const res = await fetch("/api/mon-compte/favoris", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id, action: isFavori ? "remove" : "add" }),
    });
    const json = await res.json();
    if (!json.ok) console.error("Favoris error:", json.error);
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

  const CalendarMenu = ({ rdv }: { rdv: Rdv }) => {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const open = calendarMenuOpen === rdv.id;
    useEffect(() => {
      if (open && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
      }
    }, [open]);
    useEffect(() => {
      if (!open) return;
      const close = () => setCalendarMenuOpen(null);
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }, [open]);
    // Sur un téléphone, cinq services de calendrier de bureau n'ont aucun sens :
    // le système sait déjà quelle application ouvrir avec un fichier .ics.
    if (isMobile) {
      return (
        <button onClick={e => { e.stopPropagation(); ouvrirIcs(rdv); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1a73e8", background: "#fff", border: "1px solid #c5dbf7", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Ajouter au calendrier
        </button>
      );
    }

    return (
      <div style={{ position: "relative" }}>
        <button ref={btnRef} onClick={e => { e.stopPropagation(); setCalendarMenuOpen(open ? null : rdv.id); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1a73e8", background: "#fff", border: "1px solid #c5dbf7", borderRadius: 9, padding: "7px 14px", cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Ajouter au calendrier
        </button>
        {open && pos && createPortal(
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: pos.top, left: pos.left, background: "#fff", border: "1px solid #e8e0d8", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 190, overflow: "hidden" }}>
            {[
              { label: "Google Agenda", href: googleCalendarUrl(rdv) },
              { label: "Outlook.com", href: outlookUrl(rdv) },
              { label: "Office 365", href: office365Url(rdv) },
              { label: "Yahoo Calendar", href: yahooUrl(rdv) },
            ].map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                onClick={() => setCalendarMenuOpen(null)}
                style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#2c1810", textDecoration: "none", borderBottom: "1px solid #f0ebe4" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9f5f1")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                {label}
              </a>
            ))}
            <button onClick={() => { ouvrirIcs(rdv); setCalendarMenuOpen(null); }}
              style={{ display: "block", width: "100%", padding: "10px 16px", fontSize: 13, color: "#2c1810", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9f5f1")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Apple / iCal (.ics)
            </button>
          </div>,
          document.body
        )}
      </div>
    );
  };

  const RdvActions = ({ rdv }: { rdv: Rdv }) => (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <CalendarMenu rdv={rdv} />
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

      {/* Sur mobile, la barre partagée de la coquille : l'espace client et
          l'accueil doivent avoir exactement le même cadre. Le bandeau large est
          conservé sur bureau, où la mise en page est différente. */}
      <AppHeader retour retourAccueil action="parametres" />
      {!isMobile && (
      <div style={{ background: accentColor, padding: "28px 40px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 56, height: 1.5, background: "rgba(255,255,255,0.5)", marginBottom: 5 }} />
            <div style={{ fontFamily: T.heading, fontSize: 28, fontWeight: 400, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>rdvous</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}>
            {new Date().getHours() < 12 ? "Bonjour" : new Date().getHours() < 18 ? "Bon après-midi" : "Bonsoir"}{prenom ? `, ${prenom}` : ""}
          </div>
          {!isMobile && <Link href="/mon-compte/parametres" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "rgba(255,255,255,0.12)", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", textDecoration: "none", flexShrink: 0 }} title="Paramètres">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </Link>}
          {!isMobile && (
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Prendre un rendez-vous
            </Link>
          )}
        </div>
      </div>
      )}

      {/* Top tabs, mobile uniquement */}
      {isMobile && (
        <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", display: "flex" }}>
          {(["rdvs", "favoris", "galerie"] as const).map((tab, i) => {
            const labels = ["Agenda", "Favoris", "Photos"];
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "14px 0", background: "none", border: "none", cursor: "pointer",
                  borderBottom: active ? "2px solid #1a1a1a" : "2px solid transparent",
                  fontSize: 14, fontWeight: active ? 600 : 400, color: active ? "#1a1a1a" : "#aaa" }}>
                {labels[i]}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "24px 16px 88px" : "36px 32px 64px" }}>

        {/* Grid 2 colonnes */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: isMobile ? 20 : 28, alignItems: "start" }}>

          {/* Colonne gauche, RDVs */}
          <div style={{ order: isMobile ? 2 : 1, display: isMobile && activeTab !== "rdvs" ? "none" : undefined, minWidth: 0, overflow: "hidden" }}>
            {/* Prochain rendez-vous */}
            {hero && (() => {
              const c = metierCouleur(hero.salons?.metier);
              const date = new Date(hero.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
              const heure = hero.date_heure.slice(11, 16);
              const prestations = hero.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
              const isConfirming = confirm?.rdv_id === hero.id;
              const prix = calcPrix(hero);
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Prochain rendez-vous</div>
                  <div style={{ background: T.white, borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.09)", border: `1px solid ${c.clair}` }}>
                    {/* Bandeau couleur métier */}
                    <div style={{ background: c.couleur + "18", borderBottom: `1px solid ${c.clair}`, padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar rdv={hero} size={48} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontFamily: T.heading, fontSize: 21, fontWeight: 600, color: T.text }}>{hero.salons?.nom || "Salon"}</span>
                            <HeartBtn rdv={hero} />
                          </div>
                          {prestations && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{prestations}</div>}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.couleur, background: "#fff", padding: "5px 13px", borderRadius: 20, border: `1px solid ${c.clair}`, whiteSpace: "nowrap" }}>{joursAvant(hero.date_heure)}</span>
                    </div>
                    <div style={{ padding: "20px 22px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, textTransform: "capitalize", letterSpacing: "-0.3px" }}>{date}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: c.couleur, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{heure}</div>
                        </div>
                        {prix != null && <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>{prix} €</div>}
                      </div>
                      {isConfirming ? <ActionConfirm rdv={hero} /> : <RdvActions rdv={hero} />}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Autres à venir */}
            {autresAvenir.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>À venir</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {autresAvenir.map(rdv => {
                    const c = metierCouleur(rdv.salons?.metier);
                    const date = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                    const heure = rdv.date_heure.slice(11, 16);
                    const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                    const isConfirming = confirm?.rdv_id === rdv.id;
                    const prix = calcPrix(rdv);
                    return (
                      <div key={rdv.id} style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.border}`, padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar rdv={rdv} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{rdv.salons?.nom || "Salon"}</span>
                              <HeartBtn rdv={rdv} />
                            </div>
                            <div style={{ fontSize: 12, color: T.muted, textTransform: "capitalize", marginTop: 2 }}>{date} · <strong style={{ color: c.couleur }}>{heure}</strong>{prestations ? ` · ${prestations}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: c.couleur, background: c.clair + "55", padding: "3px 9px", borderRadius: 20 }}>{joursAvant(rdv.date_heure)}</span>
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

            {/* Aucun RDV */}
            {upcoming.length === 0 && (
              <div style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Aucun rendez-vous à venir</div>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>Prenez rendez-vous chez vos salons préférés.</div>
                <Link href={accueilHref} style={{ display: "inline-block", background: T.text, color: "#fff", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Trouver un salon
                </Link>
              </div>
            )}

            {/* Historique */}
            {history.length > 0 && (
              <div>
                <button onClick={() => setShowHistory(s => !s)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 0", marginBottom: showHistory ? 10 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Historique ({history.length})</span>
                  <span style={{ fontSize: 13, color: T.muted, transform: showHistory ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </button>
                {showHistory && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {history.map(rdv => {
                      const date = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                      const prestations = rdv.rendez_vous_prestations.map(rp => rp.prestations?.nom).filter(Boolean).join(", ");
                      const annule = rdv.statut === "annule";
                      const effectue = rdv.statut === "effectue";
                      const prix = calcPrix(rdv);
                      const showAvis = rdvsWithAvisForm.has(rdv.id);
                      return (
                        <div key={rdv.id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "13px 16px", opacity: annule ? 0.65 : 1, display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar rdv={rdv} size={36} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rdv.salons?.nom || "Salon"}</span>
                                  {effectue && <HeartBtn rdv={rdv} />}
                                </div>
                                <div style={{ fontSize: 11, color: T.muted, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{date}{prestations ? ` · ${prestations}` : ""}</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: annule ? "#e74c3c" : "#999", background: annule ? "#fee2e2" : "#f0f0f0", padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                                  {annule ? "Annulé" : "Terminé"}
                                </span>
                                {prix != null && <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{prix} €</span>}
                              </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <button onClick={() => router.push(`${rebookPath(rdv)}?email=${encodeURIComponent(email || "")}`)}
                                style={{ fontSize: 11, fontWeight: 600, color: metierCouleur(rdv.salons?.metier).couleur, background: "none", border: `1px solid ${metierCouleur(rdv.salons?.metier).clair}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                                Reprendre rendez-vous
                              </button>
                            </div>
                            {showAvis && <AvisForm rdv={rdv} />}
                          </div>
                          {effectue && <PhotoSection rdv={rdv} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colonne droite, Sidebar */}
          <div style={{ display: isMobile && activeTab === "rdvs" ? "none" : "flex", flexDirection: "column", gap: 20, order: isMobile ? 1 : 2, minWidth: 0 }}>

            {/* Favoris */}
            {favoris.length > 0 && (!isMobile || activeTab === "favoris") && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Mes salons favoris</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {favoris.map(f => {
                    const c = metierCouleur(f.salons?.metier);
                    const path = f.salons?.slug ? `/${f.salons.slug}` : `/s/${f.salon_id}`;
                    return (
                      <div key={f.salon_id} style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.clair, color: c.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.heading, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                          {(f.salons?.nom || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.salons?.nom || "Salon"}</div>
                        <Link href={path} style={{ fontSize: 11, fontWeight: 700, color: c.couleur, background: c.clair + "55", padding: "5px 12px", borderRadius: 20, textDecoration: "none", whiteSpace: "nowrap" }}>
                          RDV
                        </Link>
                        <button onClick={() => toggleFavori(f.salon_id, f.salons)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#e74c3c", padding: 0, lineHeight: 1, flexShrink: 0 }}>♥</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fidélité */}
            {cagnottes.length > 0 && (!isMobile || activeTab === "favoris") && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Fidélité</div>
                <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {cagnottes.map(cg => {
                      const progression = cg.nb_visites % cg.nb_visites_fidelite === 0 ? cg.nb_visites_fidelite : cg.nb_visites % cg.nb_visites_fidelite;
                      const pct = Math.round((progression / cg.nb_visites_fidelite) * 100);
                      return (
                        <div key={cg.salon_id} style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 13px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#78350f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{cg.salon_nom}</span>
                            {cg.montant > 0
                              ? <span style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a" }}>🎉 {cg.montant} €</span>
                              : <span style={{ fontSize: 11, color: "#92400e" }}>{progression} / {cg.nb_visites_fidelite}</span>
                            }
                          </div>
                          <div style={{ height: 5, background: "rgba(0,0,0,0.1)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#d97706", borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 10, color: "#92400e", marginTop: 4, opacity: 0.8 }}>
                            {cg.montant_recompense} € offerts tous les {cg.nb_visites_fidelite} visites
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Dernières photos */}
            {(!isMobile || activeTab === "galerie") && (() => {
              const photos = rdvs.filter(r => r.photo_reference_url && r.statut === "effectue").slice(0, 9);
              if (!photos.length) return null;
              return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Mes photos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {photos.map(r => (
                      <div key={r.id} onClick={() => setLightboxUrl(r.photo_reference_url!)}
                        style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "zoom-in", position: "relative" }}>
                        <img src={r.photo_reference_url!} alt={r.salons?.nom || "photo"}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0)")} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}


          </div>
        </div>

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

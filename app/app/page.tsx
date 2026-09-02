"use client";
import { useState, useEffect } from "react";
import { createSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useAccentColor } from "@/lib/accent-color";
import AppHeader from "@/app/components/AppHeader";

const METIER_CONFIG: Record<string, { emoji: string; bg: string; color: string }> = {
  manucure:   { emoji: "💅", bg: "#fdf0f3", color: "#a0415a" },
  coiffure:   { emoji: "✂️", bg: "#f0f4fd", color: "#3a5ea0" },
  toilettage: { emoji: "🐾", bg: "#f0fdf4", color: "#3a7a50" },
};

type SalonLie = { nom: string; slug: string | null; metier: string; adresse: string | null; ville: string | null; photos: string[] | null };
type Salon = { id: string; nom: string; metier: string; ville: string | null; adresse: string | null; description: string | null; slug: string | null; photos: string[] | null };
type Prestation = { nom: string; tarif: number; sur_devis: boolean; duree_minutes: number | null };
type Rdv = {
  id: string; date_heure: string; statut: string; salon_id: string;
  tarif: number | null; duree_minutes: number | null;
  salons: SalonLie | null;
  rendez_vous_prestations: { prestations: Prestation | null }[];
};

/** Mots de liaison ignorés : sans ça « L'atelier de Pauline » donnait « LD ». */
const LIAISONS = new Set(["de", "du", "des", "la", "le", "les", "et", "aux", "par", "chez", "d", "l"]);

function initiales(nom: string): string {
  const mots = nom.replace(/['’]/g, " ").split(/[\s\-—&]+/).map(m => m.trim())
    .filter(m => m.length > 0 && /[a-zA-ZÀ-ÿ]/.test(m[0]) && !LIAISONS.has(m.toLowerCase()));
  const lettres = mots.slice(0, 2).map(m => m[0]).join("");
  if (lettres.length >= 2) return lettres.toUpperCase();
  return (nom.replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(0, 2) || "?").toUpperCase();
}

function Vignette({ nom, metier, photos, taille = 46 }: { nom: string; metier: string; photos?: string[] | null; taille?: number }) {
  const cfg = METIER_CONFIG[metier] || { bg: "#f3f0ee", color: "#8a7a6a" };
  const photo = photos?.[0];
  return (
    <div style={{
      width: taille, height: taille, borderRadius: 12, flexShrink: 0,
      background: photo ? `center/cover no-repeat url(${photo})` : cfg.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: taille / 3.2, fontWeight: 700, color: cfg.color, letterSpacing: "-0.5px",
    }}>
      {!photo && initiales(nom)}
    </div>
  );
}

function Icone({ d, cercle }: { d: string; cercle?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0a79f" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      {cercle && <circle cx="12" cy="12" r="9" />}
      <path d={d} />
    </svg>
  );
}

const ICONES = {
  lieu: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z",
  prestation: "M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z",
  horloge: "M12 7v5l3 2",
  euro: "M15 8a4 4 0 1 0 0 8M6 11h6M6 14h6",
};

function Ligne({ icone, cercle, children }: { icone: string; cercle?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "#6d635b", lineHeight: 1.45 }}>
      <Icone d={icone} cercle={cercle} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function formatDate(dateHeure: string) {
  const d = new Date(dateHeure.slice(0, 10) + "T12:00:00");
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return jour.charAt(0).toUpperCase() + jour.slice(1) + " · " + dateHeure.slice(11, 16).replace(":", "h");
}

function formatDuree(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m} min`;
}

export default function AppHomePage() {
  const [search, setSearch] = useState("");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [prenom, setPrenom] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const { color } = useAccentColor();

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      setConnecte(!!session);
      if (!session) return;
      const res = await fetch("/api/mon-compte", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (json?.prenom) setPrenom(json.prenom);
      setRdvs((json?.rdvs || []) as Rdv[]);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setChargement(true);
      const supabase = createSupabase();
      let q = supabase.from("salons_public")
        .select("id, nom, metier, ville, adresse, description, slug, photos").order("nom").limit(30);
      if (search.trim()) q = q.ilike("nom", `%${search.trim()}%`);
      const { data } = await q;
      setSalons((data || []) as Salon[]);
      setChargement(false);
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const maintenant = new Date().toISOString().slice(0, 19);
  const aVenir = rdvs
    .filter(r => r.statut !== "annule" && r.date_heure.slice(0, 19) >= maintenant)
    .sort((a, b) => a.date_heure.localeCompare(b.date_heure));

  // Salons déjà fréquentés, du plus récent au plus ancien : c'est là qu'une
  // cliente retourne, une manucure revient toutes les trois semaines chez la même.
  const mesSalons: (SalonLie & { salon_id: string })[] = [];
  for (const r of rdvs) {
    if (!r.salons || mesSalons.some(s => s.salon_id === r.salon_id)) continue;
    mesSalons.push({ ...r.salons, salon_id: r.salon_id });
  }

  const lien = (s: { slug: string | null; salon_id?: string; id?: string }) => s.slug ? `/${s.slug}` : `/s/${s.salon_id || s.id}`;
  const recherche = search.trim().length > 0;
  const aUnHistorique = mesSalons.length > 0 && !recherche;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#faf8f6", minHeight: "100vh" }}>

<AppHeader action="compte" />

      {/* Bandeau de recherche, comme une entrée en matière et non comme un décor. */}
      <div style={{ background: "#f3efec", padding: "22px 16px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 25, fontWeight: 500, color: "#1a1614", marginBottom: 16 }}>
          {prenom ? `Bonjour ${prenom}` : "Vos rendez-vous en ligne"}
        </div>
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b0a79f" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Nom du salon" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "14px 44px 14px 44px", borderRadius: 13, border: "none", fontSize: 15, background: "#fff", outline: "none", color: "#1a1614" }} />
          {recherche && (
            <button onClick={() => setSearch("")} aria-label="Effacer la recherche"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: 15, border: "none", background: "#f3efec", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a7f76" strokeWidth="2.4" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px 40px" }}>

        {/* Les rendez-vous à venir, en tête et détaillés : la raison d'ouvrir l'application.
            Masqués dès qu'une recherche est en cours, pour que les résultats
            apparaissent juste sous le champ. */}
        {aVenir.length > 0 && !recherche && (
          <>
            <Titre>Mes rendez-vous</Titre>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {aVenir.slice(0, 3).map(r => {
                const prestations = r.rendez_vous_prestations.map(p => p.prestations).filter(Boolean) as Prestation[];
                const duree = r.duree_minutes || prestations.reduce((s, p) => s + (p.duree_minutes || 0), 0);
                const tarif = r.tarif ?? (prestations.some(p => p.sur_devis) ? null : prestations.reduce((s, p) => s + (p.tarif || 0), 0));
                const adresse = [r.salons?.adresse, r.salons?.ville].filter(Boolean).join(", ");
                return (
                  <div key={r.id} style={{ background: "#fff", borderRadius: 18, padding: 18, border: "1px solid #f0ebe7" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1614", marginBottom: 14 }}>
                      {formatDate(r.date_heure)}
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                      <Vignette nom={r.salons?.nom || ""} metier={r.salons?.metier || ""} photos={r.salons?.photos} />
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: "#1a1614", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.salons?.nom}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                      {adresse && <Ligne icone={ICONES.lieu}>{adresse}</Ligne>}
                      {prestations.length > 0 && <Ligne icone={ICONES.prestation}>{prestations.map(p => p.nom).join(" · ")}</Ligne>}
                      {(duree > 0 || tarif !== null) && (
                        <Ligne icone={ICONES.horloge} cercle>
                          {duree > 0 && formatDuree(duree)}
                          {duree > 0 && tarif !== null && "  ·  "}
                          {tarif !== null && tarif > 0 && `${tarif} €`}
                        </Ligne>
                      )}
                    </div>
                    <Link href={lien({ slug: r.salons?.slug ?? null, salon_id: r.salon_id })}
                      style={{ display: "block", textAlign: "center", padding: "13px", background: color, color: "#fff", borderRadius: 12, fontSize: 14.5, fontWeight: 600, textDecoration: "none" }}>
                      Voir le salon
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aUnHistorique && (
          <>
            <Titre>{aVenir.length ? "Reprendre rendez-vous" : "Mes salons"}</Titre>
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #f0ebe7", overflow: "hidden" }}>
              {mesSalons.slice(0, 5).map((s, i) => (
                <Link key={s.salon_id} href={lien(s)} style={{ textDecoration: "none", display: "flex", gap: 13, alignItems: "center", padding: "13px 16px", borderTop: i ? "1px solid #f5f1ee" : "none" }}>
                  <Vignette nom={s.nom} metier={s.metier} photos={s.photos} taille={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1614", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nom}</div>
                    {s.ville && <div style={{ fontSize: 12.5, color: "#a89e96" }}>{s.ville}</div>}
                  </div>
                  <Chevron />
                </Link>
              ))}
            </div>
          </>
        )}

        <Titre>{recherche ? "Résultats" : aUnHistorique ? "Découvrir" : "Trouver un salon"}</Titre>
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #f0ebe7", overflow: "hidden" }}>
          {chargement ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 13, alignItems: "center", padding: "13px 16px", borderTop: i ? "1px solid #f5f1ee" : "none" }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "#f3efec", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, background: "#f3efec", borderRadius: 6, width: "55%", marginBottom: 8 }} />
                  <div style={{ height: 10, background: "#f8f5f2", borderRadius: 6, width: "35%" }} />
                </div>
              </div>
            ))
          ) : salons.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 20px", color: "#b8aca4", fontSize: 14 }}>
              {recherche ? <>Aucun salon ne correspond à « {search.trim()} »</> : "Aucun salon trouvé"}
            </div>
          ) : salons.map((s, i) => {
            const cfg = METIER_CONFIG[s.metier] || { emoji: "✨", bg: "#f3f0ee", color: "#8a7a6a" };
            return (
              <Link key={s.id} href={lien(s)} style={{ textDecoration: "none", display: "flex", gap: 13, alignItems: "center", padding: "13px 16px", borderTop: i ? "1px solid #f5f1ee" : "none" }}>
                <Vignette nom={s.nom} metier={s.metier} photos={s.photos} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1614", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nom}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {cfg.emoji} {s.metier.charAt(0).toUpperCase() + s.metier.slice(1)}
                    </span>
                    {s.ville && <span style={{ fontSize: 12.5, color: "#a89e96", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.ville}</span>}
                  </div>
                </div>
                <Chevron />
              </Link>
            );
          })}
        </div>

        {connecte === false && (
          <Link href="/rejoindre" style={{ textDecoration: "none" }}>
            <div style={{ marginTop: 20, background: "#fff", borderRadius: 18, padding: "18px", textAlign: "center", border: "1px solid #f0ebe7" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1614", marginBottom: 4 }}>Retrouvez vos rendez-vous ici</div>
              <div style={{ fontSize: 13, color: "#a89e96" }}>Créez votre espace en trente secondes</div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "26px 2px 12px", fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: "#1a1614" }}>
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d8d0ca" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

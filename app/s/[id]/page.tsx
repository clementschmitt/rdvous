import { createClient } from "@supabase/supabase-js";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import AppNavConditional from "@/app/components/AppNavConditional";
import { formatPrix } from "@/lib/prix";
import PrestationDescription from "./PrestationDescription";
import SidebarContact from "./SidebarContact";
import AvisWidget from "./AvisWidget";
import HeroPhotos from "./HeroPhotos";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; sur_devis: boolean; categorie_id: string | null; description?: string | null; reservable?: boolean };
type Category = { id: string; nom: string; ordre: number; selection_type: "unique" | "multiple" | "libre" };

const METIER_EMOJI: Record<string, string> = { manucure: "💅", coiffure: "✂️", toilettage: "🐾" };

export async function getSalon(idOrSlug: string, bySlug = false) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: salon } = await admin
    .from("salons")
    .select("id, nom, metier, ville, adresse, description, telephone, visible_recherche, photos, slug, deplacement")
    .eq(bySlug ? "slug" : "id", idOrSlug)
    .single();
  if (!salon || salon.visible_recherche === false) return null;
  const [{ data: prestations }, { data: appSettings }, { data: categories }, { data: dispos }, { data: avisData }] = await Promise.all([
    admin.from("prestations").select("id, nom, duree_minutes, tarif, sur_devis, categorie_id, description, reservable").eq("salon_id", salon.id).eq("actif", true).order("nom"),
    admin.from("app_settings").select("*").eq("salon_id", salon.id).single(),
    admin.from("prestation_categories").select("id, nom, ordre, selection_type").eq("salon_id", salon.id).order("ordre"),
    admin.from("disponibilites").select("jour_semaine, heure_debut, heure_fin").eq("salon_id", salon.id).order("jour_semaine"),
    admin.from("avis").select("note, commentaire, created_at").eq("salon_id", salon.id).eq("statut", "visible").not("note", "is", null).order("created_at", { ascending: false }).limit(20),
  ]);
  const s = appSettings as Record<string, unknown> | null;
  const prestationsLabel = (s?.prestations_label as string) || "Prestations";
  const googleAvisUrl = (s?.google_avis_url as string | undefined) || null;
  const googleNote = (s?.google_note as number | undefined) || null;
  const googleNbAvis = (s?.google_nb_avis as number | undefined) || null;
  const delaiMinReservationHeures = (s?.delai_min_reservation_heures as number | undefined) || 0;
  const planningHorizonJours = (s?.planning_horizon_jours as number | undefined) || 0;
  const planningOuvertureMode = (s?.planning_ouverture_mode as string | undefined) || "horizon";
  const planningOuvertureJour = (s?.planning_ouverture_jour as number | undefined) || 23;
  const messagePrestations = (s?.message_prestations as string | undefined) || "";
  const modeReservation = ((s?.mode_reservation as string | undefined) === "guide" ? "guide" : "menu") as "menu" | "guide";
  const planningDateLimite = (s?.date_limite_planning as string | undefined) || null;
const avis = (avisData || []) as { note: number; commentaire: string | null; created_at: string }[];
  const avisMoyenne = avis.length > 0 ? avis.reduce((s, a) => s + a.note, 0) / avis.length : null;

  return {
    salon,
    prestations: (prestations || []) as Prestation[],
    prestationsLabel,
    messagePrestations,
    categories: (categories || []) as Category[],
    dispos: (dispos || []) as { jour_semaine: number; heure_debut: string; heure_fin: string }[],
    googleAvisUrl,
    googleNote,
    googleNbAvis,
    avis,
    avisMoyenne,
    delaiMinReservationHeures,
    planningHorizonJours,
    planningOuvertureMode,
    planningOuvertureJour,
    modeReservation,
    planningDateLimite,
  };
}

function formatDuree(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m} min` : m ? `${h}h${m}` : `${h}h`;
}

function formatTel(tel: string) {
  return tel.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

function groupPrestationsByCategory(prestations: Prestation[], categories: Category[]): { label: string; items: Prestation[] }[] {
  const withCat = categories.map(cat => ({
    label: cat.nom,
    items: prestations.filter(p => p.categorie_id === cat.id),
  })).filter(g => g.items.length > 0);
  const uncategorized = prestations.filter(p => !p.categorie_id);
  if (uncategorized.length > 0) withCat.push({ label: "Autres", items: uncategorized });
  return withCat;
}

export default async function PublicSalonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSalon(id, false);
  if (!result) notFound();

  const { salon, prestations, prestationsLabel, messagePrestations, categories, dispos, googleAvisUrl, googleNote, googleNbAvis, avis, avisMoyenne } = result;
  const m = METIERS[salon.metier as keyof typeof METIERS];
  const couleur = m?.couleur || "#333";
  const couleurClaire = m?.couleurClaire || couleur + "22";
  const photos: string[] = salon.photos || [];
  const deplacement: string = salon.deplacement || "non";
  const mapsUrl = salon.adresse && salon.ville
    ? `https://maps.google.com/?q=${encodeURIComponent(`${salon.adresse}, ${salon.ville}`)}`
    : salon.ville ? `https://maps.google.com/?q=${encodeURIComponent(salon.ville)}` : null;
  const groups = groupPrestationsByCategory(prestations, categories);
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0].label !== "Autres");
  const JOURS_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const horaires = JOURS_LABELS.map((jour, i) => {
    const plages = dispos.filter(d => d.jour_semaine === i);
    return { jour, isToday: i === todayIdx, heures: plages.map(p => `${p.heure_debut.slice(0, 5)} - ${p.heure_fin.slice(0, 5)}`).join(", ") };
  });
  const hasHoraires = dispos.length > 0;

  return (
    <div className="rdvous-page-body" style={{ minHeight: "100vh", background: "#f7f7f5", fontFamily: "'Inter', system-ui, sans-serif", overflowX: "clip", paddingTop: 56, boxSizing: "border-box" }}>
      <style>{`
        @media (max-width: 640px) {
          .vitrine-layout { flex-direction: column !important; align-items: stretch !important; padding-top: 16px !important; }
          .vitrine-sidebar { position: static !important; width: auto !important; order: -1 !important; flex-shrink: 1 !important; }
          .vitrine-hero { height: 340px !important; }
          .vitrine-hero-text h1 { font-size: 28px !important; }
          .vitrine-main { padding: 16px !important; }
          .vitrine-contact-bar { display: none !important; }
        }
        .slot-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Header, transparent over hero, solid white on scroll */}
      <SiteHeader links={[{ label: "Accueil", href: "/" }, { label: "Espace pro", href: "/pro" }]} />
      <AppNavConditional showTopBar />

      {/* Hero */}
      {photos.length > 0 ? (
        <div className="vitrine-hero" style={{ position: "relative", height: 540, overflow: "hidden" }}>
          {/* Photos mosaïque + diaporama plein écran */}
          <HeroPhotos photos={photos} />
          {/* Gradient overlay (non bloquant pour les clics sur les photos) */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.75) 100%)" }} />
          {/* Salon info overlaid */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 32px 28px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div className="vitrine-hero-text">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m?.label || salon.metier}{salon.ville ? ` · ${salon.ville}` : ""}</span>
                  {deplacement === "possible" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(4px)" }}>🚗 Domicile possible</span>}
                  {deplacement === "uniquement" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(4px)" }}>🚗 Domicile uniquement</span>}
                </div>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{salon.nom}</h1>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: 220, background: `linear-gradient(135deg, ${couleur} 0%, ${couleur}cc 100%)`, position: "relative", display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%)" }} />
          <div style={{ padding: "28px 32px", width: "100%", maxWidth: 1200, margin: "0 auto", position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{m?.label || salon.metier}{salon.ville ? ` · ${salon.ville}` : ""}</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.2, textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>{salon.nom}</h1>
            {(deplacement === "possible" || deplacement === "uniquement") && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                  {deplacement === "possible" ? "🚗 Domicile possible" : "🚗 Domicile uniquement"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div className="vitrine-layout" style={{ display: "flex", gap: 20, alignItems: "flex-start", paddingBottom: 48, paddingTop: 24 }}>

          {/* Colonne gauche */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Infos contact, masquées sur mobile (la barre latérale remontée affiche déjà le contact) */}
            {(salon.adresse || salon.ville || salon.telephone) && (
              <div id="vitrine-contact-top" className="vitrine-contact-bar" style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid #ebebeb", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {(salon.adresse || salon.ville) && mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555", textDecoration: "none" }}>
                    📍 {[salon.adresse, salon.ville].filter(Boolean).join(", ")}
                  </a>
                )}
                {salon.telephone && (
                  <a href={`tel:${salon.telephone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555", textDecoration: "none" }}>
                    📞 {formatTel(salon.telephone)}
                  </a>
                )}
              </div>
            )}

            {/* Description */}
            {salon.description && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "18px 22px", border: "1px solid #ebebeb", fontSize: 14, color: "#555", lineHeight: 1.8 }}>
                {salon.description}
              </div>
            )}

            {/* Prestations */}
            {prestations.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid #f5f5f5" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: "#666", margin: 0 }}>{prestationsLabel}</h2>
                </div>
                {hasGroups ? (
                  groups.map(({ label, items }) => (
                    <div key={label}>
                      <div style={{ padding: "10px 22px", background: couleurClaire }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: couleur, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                      </div>
                      {items.map((p, i) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "13px 22px", borderBottom: i < items.length - 1 ? "1px solid #f9f9f9" : "none" }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                            <span style={{ fontSize: 14, color: "#1a1a1a" }}>{p.nom}</span>
                            {p.reservable === false && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: couleur, background: couleur + "15", padding: "1px 7px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Sur demande</span>}
                            {p.description && <PrestationDescription text={p.description} couleur={couleur} />}
                          </div>
                          <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: "#ccc" }}>{formatDuree(p.duree_minutes)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: p.sur_devis ? "#888" : couleur, minWidth: 44, textAlign: "right", whiteSpace: "nowrap" }}>{formatPrix(p.tarif, p.sur_devis)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  prestations.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "13px 22px", borderBottom: i < prestations.length - 1 ? "1px solid #f9f9f9" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                            <span style={{ fontSize: 14, color: "#1a1a1a" }}>{p.nom}</span>
                            {p.reservable === false && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: couleur, background: couleur + "15", padding: "1px 7px", borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Sur demande</span>}
                            {p.description && <PrestationDescription text={p.description} couleur={couleur} />}
                          </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: "#ccc" }}>{formatDuree(p.duree_minutes)}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: p.sur_devis ? "#888" : couleur, minWidth: 44, textAlign: "right", whiteSpace: "nowrap" }}>{formatPrix(p.tarif, p.sur_devis)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Message informatif prestations */}
            {messagePrestations && (
              <div style={{ background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                <p style={{ margin: 0, fontSize: 15, color: "#92400e", lineHeight: 1.6, fontWeight: 500 }}>{messagePrestations}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="vitrine-sidebar" style={{ width: 300, flexShrink: 0, position: "sticky", top: 68, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Avis rdvous, widget interactif */}
            {avis.length > 0 && avisMoyenne && (
              <AvisWidget avis={avis} avisMoyenne={avisMoyenne} />
            )}

            {/* CTA + contact */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", padding: "14px" }}>
              {prestations.length > 0 ? (
                <Link href={salon.slug ? `/${salon.slug}/reserver` : `/s/${salon.id}/reserver`} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: couleur, padding: "15px 20px", textDecoration: "none", textAlign: "center",
                  borderRadius: 9, boxShadow: `0 4px 14px ${couleur}55`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Prendre rendez-vous</span>
                </Link>
              ) : (
                <div style={{ padding: "15px 20px", background: couleur, borderRadius: 9, textAlign: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Nous contacter</span>
                </div>
              )}
              <SidebarContact
                telephone={salon.telephone || null}
                telFormate={salon.telephone ? formatTel(salon.telephone) : null}
                mapsUrl={mapsUrl || null}
                adresseLabel={[salon.adresse, salon.ville].filter(Boolean).join(", ")}
              />
            </div>

            {/* Avis Google */}
            {googleNote && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", padding: "16px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Avis clients</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ background: "#1a1a1a", borderRadius: 8, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>{String(googleNote).replace(".", ",")}</span>
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 1, marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <span key={i} style={{ fontSize: 15, color: i <= Math.round(googleNote) ? "#f5a623" : "#e0e0e0", lineHeight: 1 }}>★</span>
                      ))}
                    </div>
                    {googleNbAvis ? <div style={{ fontSize: 12, color: "#888" }}>{googleNbAvis} avis</div> : null}
                  </div>
                </div>
                {googleAvisUrl && (
                  <a href={googleAvisUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f5f5f5", fontSize: 12, color: couleur, fontWeight: 600, textDecoration: "none" }}>
                    Voir les avis Google →
                  </a>
                )}
              </div>
            )}

            {/* Horaires */}
            {hasHoraires && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", padding: "16px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Horaires</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {horaires.map(({ jour, isToday, heures }) => (
                    <div key={jour} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: isToday ? "4px 8px" : "2px 0", background: isToday ? couleurClaire : "transparent", borderRadius: isToday ? 6 : 0, margin: isToday ? "0 -8px" : 0 }}>
                      <span style={{ fontWeight: isToday ? 700 : 400, color: isToday ? couleur : "#555" }}>{jour}</span>
                      <span style={{ fontWeight: isToday ? 700 : 400, color: heures ? (isToday ? couleur : "#555") : "#ccc" }}>
                        {heures || "Fermé"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #ebebeb", padding: "20px 24px", textAlign: "center", background: "#fff" }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>
        <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>Gérez votre salon sur rdvous.fr</div>
      </div>
    </div>
  );
}

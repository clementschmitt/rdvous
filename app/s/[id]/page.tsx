import { createClient } from "@supabase/supabase-js";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingWidget from "./BookingWidget";
import VitrineHeader from "./VitrineHeader";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number; sur_devis: boolean };

const METIER_EMOJI: Record<string, string> = { manucure: "💅", coiffure: "✂️", toilettage: "🐾" };

export async function getSalon(idOrSlug: string, bySlug = false) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: salon } = await admin
    .from("salons")
    .select("id, nom, metier, ville, adresse, description, telephone, visible_recherche, photos, slug, deplacement")
    .eq(bySlug ? "slug" : "id", idOrSlug)
    .single();
  if (!salon || salon.visible_recherche === false) return null;
  const { data: prestations } = await admin
    .from("prestations")
    .select("id, nom, duree_minutes, tarif, sur_devis")
    .eq("salon_id", salon.id)
    .eq("actif", true)
    .order("nom");
  return { salon, prestations: (prestations || []) as Prestation[] };
}

function formatDuree(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m} min` : m ? `${h}h${m}` : `${h}h`;
}

function formatTel(tel: string) {
  return tel.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

function groupPrestations(prestations: Prestation[]) {
  const groups: Record<string, Prestation[]> = {};
  for (const p of prestations) {
    const match = p.nom.match(/^(étape|etape|step)\s*\d+/i);
    const key = match ? match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase() : "Autres";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

export default async function PublicSalonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSalon(id, false);
  if (!result) notFound();

  const { salon, prestations } = result;
  const m = METIERS[salon.metier as keyof typeof METIERS];
  const couleur = m?.couleur || "#333";
  const couleurClaire = m?.couleurClaire || couleur + "22";
  const emoji = METIER_EMOJI[salon.metier] || "✂️";
  const photos: string[] = salon.photos || [];
  const deplacement: string = salon.deplacement || "non";
  const mapsUrl = salon.adresse && salon.ville
    ? `https://maps.google.com/?q=${encodeURIComponent(`${salon.adresse}, ${salon.ville}`)}`
    : salon.ville ? `https://maps.google.com/?q=${encodeURIComponent(salon.ville)}` : null;
  const grouped = groupPrestations(prestations);
  const hasGroups = Object.keys(grouped).some(k => k !== "Autres");

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .vitrine-layout { flex-direction: column !important; padding-top: 16px !important; }
          .vitrine-sidebar { position: static !important; width: auto !important; }
          .vitrine-hero { height: 280px !important; }
          .vitrine-hero-text h1 { font-size: 28px !important; }
          .vitrine-hero-actions { display: none !important; }
          .vitrine-main { padding: 16px !important; }
        }
        .slot-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Header — transparent over hero, solid white on scroll */}
      <VitrineHeader />

      {/* Hero */}
      {photos.length > 0 ? (
        <div className="vitrine-hero" style={{ position: "relative", height: 460, overflow: "hidden" }}>
          {/* Photos mosaic */}
          {photos.length === 1 ? (
            <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${photos[0]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", gap: 3 }}>
              <div style={{ flex: 2, backgroundImage: `url(${photos[0]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                {photos.slice(1, 3).map((url, i) => (
                  <div key={i} style={{ flex: 1, backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                ))}
              </div>
            </div>
          )}
          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.75) 100%)" }} />
          {/* Salon info overlaid */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 32px 28px" }}>
            <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div className="vitrine-hero-text">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m?.label || salon.metier}{salon.ville ? ` · ${salon.ville}` : ""}</span>
                  {deplacement === "possible" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(4px)" }}>🚗 Domicile possible</span>}
                  {deplacement === "uniquement" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(4px)" }}>🚗 Domicile uniquement</span>}
                </div>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{salon.nom}</h1>
              </div>
              <div className="vitrine-hero-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {salon.telephone && (
                  <a href={`tel:${salon.telephone}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "#fff", color: "#1a1a1a", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    📞 {formatTel(salon.telephone)}
                  </a>
                )}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>
                    📍 Itinéraire
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: 220, background: `linear-gradient(135deg, ${couleur} 0%, ${couleur}cc 100%)`, position: "relative", display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%)" }} />
          <div style={{ padding: "28px 32px", width: "100%", maxWidth: 900, margin: "0 auto", position: "relative" }}>
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

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
        <div className="vitrine-layout" style={{ display: "flex", gap: 20, alignItems: "flex-start", paddingBottom: 48, paddingTop: 24 }}>

          {/* Colonne gauche */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Infos contact si pas de photos (mobile aussi) */}
            {(salon.adresse || salon.ville || salon.telephone) && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", border: "1px solid #ebebeb", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
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
                  <h2 style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Prestations</h2>
                </div>
                {hasGroups ? (
                  Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      <div style={{ padding: "10px 22px", background: couleurClaire }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: couleur, textTransform: "uppercase", letterSpacing: "0.06em" }}>{group}</span>
                      </div>
                      {items.map((p, i) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 22px", borderBottom: i < items.length - 1 ? "1px solid #f9f9f9" : "none" }}>
                          <span style={{ fontSize: 14, color: "#1a1a1a" }}>{p.nom.replace(/^(étape|etape|step)\s*\d+\s*:\s*/i, "")}</span>
                          <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: "#ccc" }}>{formatDuree(p.duree_minutes)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: p.sur_devis ? "#888" : couleur, minWidth: 44, textAlign: "right" }}>{p.sur_devis ? "Sur devis" : `${p.tarif} €`}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  prestations.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 22px", borderBottom: i < prestations.length - 1 ? "1px solid #f9f9f9" : "none" }}>
                      <span style={{ fontSize: 14, color: "#1a1a1a" }}>{p.nom}</span>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: "#ccc" }}>{formatDuree(p.duree_minutes)}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: p.sur_devis ? "#888" : couleur, minWidth: 44, textAlign: "right" }}>{p.sur_devis ? "Sur devis" : `${p.tarif} €`}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sidebar booking */}
          <div className="vitrine-sidebar" style={{ width: 340, flexShrink: 0, position: "sticky", top: 68 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", overflow: "hidden" }}>
              <div style={{ background: couleur, padding: "18px 22px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Cormorant Garamond', serif", marginBottom: 2 }}>Prendre rendez-vous</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {prestations.length > 0 ? "Choisissez votre prestation et votre créneau." : `Contactez ${salon.nom} directement.`}
                </div>
              </div>
              <div style={{ padding: "20px 22px" }}>
                {prestations.length > 0 ? (
                  <BookingWidget salonId={salon.id} prestations={prestations} couleur={couleur} deplacement={deplacement} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {salon.telephone && (
                      <a href={`tel:${salon.telephone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: couleur, color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                        📞 Appeler — {formatTel(salon.telephone)}
                      </a>
                    )}
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#f5f5f5", color: "#555", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                        📍 Voir sur Google Maps
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
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

import { createClient } from "@supabase/supabase-js";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";
import { notFound } from "next/navigation";

type Prestation = { id: string; nom: string; duree_minutes: number; tarif: number };

const METIER_EMOJI: Record<string, string> = { manucure: "💅", coiffure: "✂️", toilettage: "🐾" };

async function getSalon(id: string) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: salon } = await admin
    .from("salons")
    .select("id, nom, metier, ville, adresse, description, telephone, visible_recherche")
    .eq("id", id)
    .single();
  if (!salon || salon.visible_recherche === false) return null;
  const { data: prestations } = await admin
    .from("prestations")
    .select("id, nom, duree_minutes, tarif")
    .eq("salon_id", id)
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

export default async function PublicSalonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSalon(id);
  if (!result) notFound();

  const { salon, prestations } = result;
  const m = METIERS[salon.metier as keyof typeof METIERS];
  const couleur = m?.couleur || "#333";
  const emoji = METIER_EMOJI[salon.metier] || "✂️";
  const mapsUrl = salon.adresse && salon.ville
    ? `https://maps.google.com/?q=${encodeURIComponent(`${salon.adresse}, ${salon.ville}`)}`
    : salon.ville
    ? `https://maps.google.com/?q=${encodeURIComponent(salon.ville)}`
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/recherche" style={{ fontSize: 13, color: "#999", textDecoration: "none" }}>← Recherche</Link>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>
      </div>

      {/* Hero */}
      <div style={{ background: couleur, padding: "40px 24px 48px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>
              {emoji}
            </div>
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: "#fff", margin: "0 0 4px", lineHeight: 1.2 }}>{salon.nom}</h1>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{m?.label || salon.metier}</div>
            </div>
          </div>

          {/* Infos rapides */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(salon.adresse || salon.ville) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                <span>📍</span>
                {mapsUrl
                  ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "underline" }}>
                      {[salon.adresse, salon.ville].filter(Boolean).join(", ")}
                    </a>
                  : <span>{[salon.adresse, salon.ville].filter(Boolean).join(", ")}</span>
                }
              </div>
            )}
            {salon.telephone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                <span>📞</span>
                <a href={`tel:${salon.telephone}`} style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>
                  {formatTel(salon.telephone)}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 24px" }}>

        {/* Description */}
        {salon.description && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #ebebeb", fontSize: 14, color: "#555", lineHeight: 1.75 }}>
            {salon.description}
          </div>
        )}

        {/* Prestations */}
        {prestations.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #ebebeb", marginBottom: 16 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>Prestations</h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {prestations.map((p, i) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < prestations.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <span style={{ fontSize: 14, color: "#1a1a1a" }}>{p.nom}</span>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#bbb" }}>{formatDuree(p.duree_minutes)}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: couleur, minWidth: 48, textAlign: "right" }}>{p.tarif} €</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA contact */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ebebeb", overflow: "hidden" }}>
          <div style={{ background: couleur, padding: "20px 24px" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", fontFamily: "'Cormorant Garamond', serif", marginBottom: 4 }}>
              Prendre rendez-vous
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              Contactez {salon.nom} directement pour réserver.
            </div>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {salon.telephone && (
              <a href={`tel:${salon.telephone}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: couleur, color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                📞 Appeler — {formatTel(salon.telephone)}
              </a>
            )}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#f5f5f5", color: "#555", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                📍 Voir sur Google Maps
              </a>
            )}
            {!salon.telephone && !mapsUrl && (
              <div style={{ textAlign: "center", fontSize: 13, color: "#bbb", padding: "8px 0" }}>
                Retrouvez ce salon pour prendre rendez-vous.
              </div>
            )}
          </div>
        </div>

        {/* Footer rdvous */}
        <div style={{ textAlign: "center", marginTop: 32, paddingTop: 24, borderTop: "1px solid #ebebeb" }}>
          <div style={{ fontSize: 12, color: "#ccc", marginBottom: 8 }}>Propulsé par</div>
          <Link href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, textDecoration: "none", color: "#1a1a1a" }}>rdvous</Link>
          <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>Gérez votre salon sur rdvous.fr</div>
        </div>
      </div>
    </div>
  );
}

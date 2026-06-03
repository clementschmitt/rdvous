import { notFound } from "next/navigation";
import { getSalon } from "../page";
import VitrineHeader from "../VitrineHeader";
import BookingWidget from "../BookingWidget";
import { METIERS } from "@/lib/metiers";
import Link from "next/link";

export default async function ReserverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSalon(id, false);
  if (!result) notFound();

  const { salon, prestations, categories, delaiMinReservationHeures } = result;
  const m = METIERS[salon.metier as keyof typeof METIERS];
  const couleur = m?.couleur || "#333";
  const deplacement: string = salon.deplacement || "non";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @media (max-width: 640px) {
          .reserver-card { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
        }
      `}</style>

      <VitrineHeader />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "76px 16px 48px" }}>
        <Link href={`/s/${salon.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#999", textDecoration: "none", marginBottom: 20, fontWeight: 500 }}>
          ← {salon.nom}
        </Link>

        <div className="reserver-card" style={{ background: "#fff", borderRadius: 14, border: "1px solid #ebebeb", overflow: "hidden" }}>
          <div style={{ background: couleur, padding: "22px 28px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'Cormorant Garamond', serif", marginBottom: 2 }}>
              Prendre rendez-vous
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{salon.nom}</div>
          </div>

          <div style={{ padding: "28px" }}>
            {prestations.length > 0 ? (
              <BookingWidget salonId={salon.id} prestations={prestations} categories={categories} couleur={couleur} deplacement={deplacement} delaiMinHeures={delaiMinReservationHeures} salonTel={salon.telephone || undefined} />
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#888", fontSize: 14 }}>
                Aucune prestation disponible en ligne pour le moment.
                {salon.telephone && (
                  <div style={{ marginTop: 16 }}>
                    <a href={`tel:${salon.telephone}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", background: couleur, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                      📞 Nous appeler
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

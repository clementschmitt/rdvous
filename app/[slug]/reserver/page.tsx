import { notFound } from "next/navigation";
import { getSalon } from "@/app/s/[id]/page";
import ReserverPage from "@/app/s/[id]/reserver/page";

// URL propre de réservation : /<slug>/reserver → rend la même page que /s/<id>/reserver
export default async function SlugReserver({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getSalon(slug, true);
  if (!result) notFound();
  return ReserverPage({ params: Promise.resolve({ id: result.salon.id }) });
}

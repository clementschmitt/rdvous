import { notFound } from "next/navigation";
import { getSalon } from "@/app/s/[id]/page";
import PublicSalonPage from "@/app/s/[id]/page";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getSalon(slug, true);
  if (!result) notFound();
  // Rendre la même page avec l'id du salon
  return PublicSalonPage({ params: Promise.resolve({ id: result.salon.id }) });
}

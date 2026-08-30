import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Salons mis en avant sur l'accueil. Route serveur en service_role parce que la
 * table `avis` est fermée à la clé anonyme : le navigateur ne peut pas calculer
 * une note moyenne lui-même.
 *
 * Règle éditoriale : un salon n'apparaît que s'il est visible en recherche et a
 * au moins une photo. La photo est le vrai filtre, c'est elle qui fait la carte
 * et elle écarte d'elle-même les salons de test. Les avis ne sont pas exigés,
 * sinon un salon qui vient d'ouvrir ne pourrait jamais être mis en avant.
 */
export const revalidate = 300;

export async function GET() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: salons }, { data: avis }] = await Promise.all([
    admin.from("salons").select("id, nom, slug, metier, ville, secteur, deplacement, photos").eq("visible_recherche", true),
    admin.from("avis").select("salon_id, note").eq("statut", "visible").not("note", "is", null),
  ]);

  const notesParSalon = new Map<string, number[]>();
  for (const a of avis || []) {
    const liste = notesParSalon.get(a.salon_id) || [];
    liste.push(a.note as number);
    notesParSalon.set(a.salon_id, liste);
  }

  const vitrine = (salons || [])
    .map(s => {
      const notes = notesParSalon.get(s.id) || [];
      const photos = Array.isArray(s.photos) ? (s.photos as string[]) : [];
      return {
        nom: s.nom,
        slug: s.slug,
        metier: s.metier,
        // Un salon qui ne travaille qu'à domicile n'a pas d'adresse à montrer.
        // On affiche alors sa zone d'intervention, et à défaut le simple fait
        // qu'il se déplace, ce qui reste plus utile qu'une pastille vide.
        ville: s.ville || s.secteur || (s.deplacement === "uniquement" ? "À domicile" : null),
        photo: photos[0] || null,
        note: notes.length ? Math.round((notes.reduce((t, n) => t + n, 0) / notes.length) * 10) / 10 : null,
        nbAvis: notes.length,
      };
    })
    .filter(s => s.slug && s.photo)
    // Les salons notés d'abord, du mieux noté au moins bien noté, puis ceux qui
    // n'ont pas encore d'avis. Comparer des notes nulles donnerait un NaN et un
    // ordre imprévisible.
    .sort((a, b) => {
      if (a.note === null && b.note === null) return a.nom.localeCompare(b.nom);
      if (a.note === null) return 1;
      if (b.note === null) return -1;
      return (b.note - a.note) || (b.nbAvis - a.nbAvis);
    })
    .slice(0, 4);

  return NextResponse.json({ salons: vitrine });
}

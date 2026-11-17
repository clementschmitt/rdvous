import type { SupabaseClient } from "@supabase/supabase-js";

// Renvoie l'adresse si elle en est une, sinon null. Un champ des paramètres rempli avec autre chose
// qu'une adresse (vu le 17/11/2026 sur un salon de test : « test ») faisait échouer l'envoi chez Brevo
// (« email is not valid in to ») et la professionnelle n'était jamais prévenue.
export function adresseValide(s?: string | null): string | null {
  const v = s?.trim();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

// Adresse où prévenir la professionnelle : l'adresse de réception des paramètres, sinon l'adresse
// d'expéditeur, sinon l'adresse du compte qui gère le salon. Une adresse invalide est ignorée.
export async function adresseDeLaPro(
  admin: SupabaseClient,
  salonId: string,
  settings?: { email_reception?: string | null; email_expediteur?: string | null } | null,
): Promise<string | null> {
  const parametree = adresseValide(settings?.email_reception) || adresseValide(settings?.email_expediteur);
  if (parametree) return parametree;
  const { data: su } = await admin.from("salon_users").select("user_id").eq("salon_id", salonId).limit(1).single();
  if (!su?.user_id) return null;
  const { data: { user } } = await admin.auth.admin.getUserById(su.user_id);
  return adresseValide(user?.email);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Fichier calendrier d'un rendez-vous.
 *
 * Servi par le serveur et non fabriqué dans le navigateur : un blob et un lien
 * de téléchargement ne fonctionnent pas dans un webview Capacitor, l'ajout au
 * calendrier échouait donc silencieusement dans l'application mobile.
 *
 * L'accès repose sur l'identifiant du rendez-vous, un UUID non devinable, comme
 * le fait déjà le lien d'annulation envoyé par email. Le contenu se limite au
 * salon, à la date et aux prestations.
 */
function echapper(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("Paramètre manquant", { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: rdv } = await admin
    .from("rendez_vous")
    .select("date_heure, duree_minutes, statut, salons(nom, adresse, ville), rendez_vous_prestations(prestations(nom, duree_minutes))")
    .eq("id", id)
    .maybeSingle();

  if (!rdv || rdv.statut === "annule") return new NextResponse("Introuvable", { status: 404 });

  const salon = rdv.salons as unknown as { nom: string; adresse: string | null; ville: string | null } | null;
  const prestations = ((rdv.rendez_vous_prestations || []) as unknown as { prestations: { nom: string; duree_minutes: number | null } | null }[])
    .map(p => p.prestations).filter(Boolean) as { nom: string; duree_minutes: number | null }[];

  const duree = rdv.duree_minutes || prestations.reduce((s, p) => s + (p.duree_minutes || 0), 0) || 60;
  // Les horaires sont stockés sans fuseau : on les écrit en heure locale, ce que
  // la norme iCalendar accepte lorsqu'aucun Z ni TZID n'est indiqué.
  const debut = rdv.date_heure.slice(0, 16);
  const finMs = new Date(debut + ":00").getTime() + duree * 60000;
  const fin = new Date(finMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: string) => d.replace(/[-:]/g, "") + "00";
  const finStr = `${fin.getFullYear()}${pad(fin.getMonth() + 1)}${pad(fin.getDate())}T${pad(fin.getHours())}${pad(fin.getMinutes())}00`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//rdvous//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${id}@rdvous.fr`,
    `DTSTART:${fmt(debut)}`,
    `DTEND:${finStr}`,
    `SUMMARY:${echapper(salon?.nom || "Rendez-vous")}`,
    prestations.length ? `DESCRIPTION:${echapper(prestations.map(p => p.nom).join(", "))}` : "",
    salon?.adresse || salon?.ville ? `LOCATION:${echapper([salon?.adresse, salon?.ville].filter(Boolean).join(", "))}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rendez-vous.ics"',
      "Cache-Control": "no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, salon_id } = await req.json();

  if (!salon_id || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const origin = new URL(req.url).origin;

  const [{ data: salon }, { data: prestations }, { data: dispos }] = await Promise.all([
    admin.from("salons").select("nom, metier, adresse, ville, telephone").eq("id", salon_id).single(),
    admin.from("prestations").select("id, nom, duree_minutes, tarif, sur_devis").eq("salon_id", salon_id).eq("actif", true).order("nom"),
    admin.from("disponibilites").select("jour_semaine, heure_debut, heure_fin").eq("salon_id", salon_id).order("jour_semaine"),
  ]);

  const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const horairesText = JOURS.map((j, i) => {
    const plages = (dispos || []).filter(d => d.jour_semaine === i);
    if (!plages.length) return `${j} : Fermé`;
    return `${j} : ${plages.map(p => `${p.heure_debut.slice(0, 5)}-${p.heure_fin.slice(0, 5)}`).join(", ")}`;
  }).join("\n");

  const prestationsText = (prestations || []).map(p =>
    `- ${p.nom} | ${p.duree_minutes} min | ${p.sur_devis ? "sur devis" : p.tarif + "€"} | id:${p.id}`
  ).join("\n");

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const systemPrompt = `Tu es l'assistante virtuelle de ${salon?.nom}, salon de ${salon?.metier} situé à ${salon?.ville || ""}.
Tu aides les clients à répondre à leurs questions et à prendre rendez-vous.

PRESTATIONS :
${prestationsText}

HORAIRES :
${horairesText}

TÉLÉPHONE : ${salon?.telephone || "non renseigné"}
AUJOURD'HUI : ${today}

POUR PRENDRE UN RDV :
1. Identifie la prestation (utilise l'id exact dans les outils)
2. Demande la date souhaitée puis appelle get_available_slots
3. Propose les créneaux disponibles, laisse le client choisir
4. Collecte prénom, nom, email et téléphone
5. Confirme le récapitulatif et appelle create_rdv
6. Annonce la confirmation avec date, heure et prestation

RÈGLES :
- Réponds toujours en français, de façon chaleureuse et concise
- Ne collecte jamais les données personnelles avant qu'un créneau soit choisi
- Si aucun créneau disponible à une date, propose d'essayer une autre date`;

  const tools: Anthropic.Tool[] = [
    {
      name: "get_available_slots",
      description: "Récupère les créneaux disponibles pour une prestation à une date donnée",
      input_schema: {
        type: "object" as const,
        properties: {
          date: { type: "string", description: "Date au format YYYY-MM-DD" },
          duree: { type: "number", description: "Durée de la prestation en minutes" },
        },
        required: ["date", "duree"],
      },
    },
    {
      name: "create_rdv",
      description: "Crée le rendez-vous après confirmation du client",
      input_schema: {
        type: "object" as const,
        properties: {
          prestation_ids: { type: "array", items: { type: "string" }, description: "IDs des prestations choisies" },
          date: { type: "string", description: "Date au format YYYY-MM-DD" },
          heure: { type: "string", description: "Heure au format HH:MM" },
          prenom: { type: "string" },
          nom: { type: "string" },
          email: { type: "string" },
          telephone: { type: "string" },
        },
        required: ["prestation_ids", "date", "heure", "prenom", "nom", "email", "telephone"],
      },
    },
  ];

  let currentMessages: Anthropic.MessageParam[] = messages;

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find(b => b.type === "text")?.text || "";
      return NextResponse.json({ text });
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      currentMessages = [...currentMessages, { role: "assistant", content: response.content }];

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        let result: string;

        if (toolUse.name === "get_available_slots") {
          const { date, duree } = toolUse.input as { date: string; duree: number };
          try {
            const res = await fetch(`${origin}/api/booking/slots?salon_id=${salon_id}&date=${date}&duree=${duree}`);
            const data = await res.json();
            result = JSON.stringify({ slots: data.slots || [] });
          } catch {
            result = JSON.stringify({ error: "Impossible de récupérer les créneaux" });
          }
        } else if (toolUse.name === "create_rdv") {
          const input = toolUse.input as Record<string, unknown>;
          try {
            const res = await fetch(`${origin}/api/booking/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ salon_id, ...input }),
            });
            const data = await res.json();
            result = JSON.stringify(data);
          } catch {
            result = JSON.stringify({ error: "Erreur lors de la création du rendez-vous" });
          }
        } else {
          result = JSON.stringify({ error: "Outil inconnu" });
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      currentMessages = [...currentMessages, { role: "user", content: toolResults }];
    } else {
      break;
    }
  }

  return NextResponse.json({ text: "Désolée, je n'ai pas pu traiter votre demande. Veuillez réessayer." });
}

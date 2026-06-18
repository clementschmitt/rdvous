import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type PrestationImport = { nom: string; duree_minutes: number; tarif: number; sur_devis: boolean; description?: string };
type CategorieImport = { nom: string; prestations: PrestationImport[] };

const CATALOGUE_TOOL: Anthropic.Tool = {
  name: "catalogue",
  description: "Le catalogue de prestations extrait de la page du salon",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nom: { type: "string", description: "Titre de la catégorie/section" },
            prestations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nom: { type: "string" },
                  duree_minutes: { type: "number", description: "Durée en minutes (ex: 1h15 = 75)" },
                  tarif: { type: "number", description: "Prix de départ en euros. Pour 'à partir de X€' ou 'de X à Y€', mettre X (le montant le plus bas). 0 UNIQUEMENT si aucun montant n'est indiqué." },
                  sur_devis: { type: "boolean", description: "true si prix variable ('à partir de', 'de X à Y') ou absent ; false si prix fixe" },
                  description: { type: "string", description: "Description/détail de la prestation si présent sur la page, sinon chaîne vide" },
                },
                required: ["nom", "duree_minutes", "tarif", "sur_devis"],
              },
            },
          },
          required: ["nom", "prestations"],
        },
      },
    },
    required: ["categories"],
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as "preview" | "import";

  // ── Prévisualisation : fetch Planity + extraction par Claude ──
  if (action === "preview") {
    const url = String(body.url || "");
    if (!url.includes("planity")) return NextResponse.json({ error: "URL Planity invalide." }, { status: 400 });

    let html = "";
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" } });
      html = await res.text();
    } catch {
      return NextResponse.json({ error: "Impossible de récupérer la page Planity." }, { status: 502 });
    }

    // On garde le texte, on retire scripts/styles/balises pour limiter les tokens
    const texte = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 60000);

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: [CATALOGUE_TOOL],
        tool_choice: { type: "tool", name: "catalogue" },
        messages: [{
          role: "user",
          content: `Voici le contenu d'une page de salon Planity. Extrais le catalogue complet des prestations, regroupées par catégorie (le titre de section). Pour chaque prestation : nom exact, durée en minutes, et le prix.

Règles de prix, applique-les strictement :
- Prix fixe (ex "45€") → sur_devis=false, tarif=45.
- "à partir de X€" (ex "à partir de 45€") → sur_devis=true, tarif=45. CAPTURE bien le 45, ne mets jamais 0 ici.
- "de X à Y€" (ex "de 15 à 30€") → sur_devis=true, tarif=15 (le plus bas).
- Aucun prix indiqué ou "sur devis" → sur_devis=true, tarif=0.

N'invente rien, n'extrais que ce qui est réellement présent.\n\n${texte}`,
        }],
      });
      const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!block) return NextResponse.json({ error: "Aucune prestation détectée sur la page." }, { status: 422 });
      const data = block.input as { categories: CategorieImport[] };
      const categories = (data.categories || []).filter(c => c.nom && (c.prestations || []).length > 0);
      if (categories.length === 0) return NextResponse.json({ error: "Aucune prestation détectée sur la page." }, { status: 422 });
      return NextResponse.json({ categories });
    } catch (e) {
      console.error("Import Planity extraction error:", e);
      return NextResponse.json({ error: "Erreur lors de l'extraction." }, { status: 500 });
    }
  }

  // ── Import : insertion des catégories + prestations dans le salon ──
  if (action === "import") {
    const salon_id = String(body.salon_id || "");
    const categories = body.categories as CategorieImport[];
    if (!salon_id || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let nbCat = 0, nbPresta = 0;

    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      if (!cat.nom) continue;
      const { data: catRow, error: catErr } = await admin
        .from("prestation_categories")
        .insert({ salon_id, nom: cat.nom, ordre: ci, selection_type: "unique" })
        .select("id")
        .single();
      if (catErr || !catRow) { console.error("cat insert error:", catErr); continue; }
      nbCat++;

      const rows = (cat.prestations || [])
        .filter(p => p.nom)
        .map((p, pi) => ({
          salon_id,
          nom: p.nom,
          duree_minutes: Math.max(0, Math.round(p.duree_minutes || 0)),
          tarif: Math.max(0, p.tarif || 0),
          sur_devis: !!p.sur_devis,
          description: p.description?.trim() || null,
          categorie_id: catRow.id,
          ordre: pi,
          actif: true,
        }));
      if (rows.length) {
        const { error: pErr } = await admin.from("prestations").insert(rows);
        if (pErr) console.error("presta insert error:", pErr);
        else nbPresta += rows.length;
      }
    }

    return NextResponse.json({ ok: true, nbCat, nbPresta });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}

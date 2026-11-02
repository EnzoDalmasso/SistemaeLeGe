import { z } from "zod";
import type { PriceItem } from "./db/schema";
import { normalizePhone } from "./format";
import { parseByRules, type ParsedMessage } from "./parser";

// Cualquier API compatible con OpenAI: Groq (gratis, demo) u OpenAI (producción).
const base = () => (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
export const aiEnabled = () => Boolean(process.env.AI_API_KEY);

// Extensiones que acepta Whisper. Las notas de voz de Telegram llegan como .oga (es ogg/opus).
const AUDIO_EXT: Record<string, string> = { oga: "ogg", ogg: "ogg", opus: "opus", mp3: "mp3", m4a: "m4a", mp4: "mp4", wav: "wav", webm: "webm", flac: "flac", mpeg: "mpeg", mpga: "mpga" };

// Vocabulario del lavadero: orienta a Whisper con la ortografía del mostrador. Sin nombres ni teléfonos de ejemplo:
// con audio bajo o con ruido, Whisper tiende a "copiar" la pista y devolvería un cliente inventado.
const AUDIO_HINT =
  "Lavadero eLeGe. Vocabulario: acolchado de 1 plaza, acolchado de 2 plazas, plumón, frazada de plaza y media, campera, almohada, " +
  "kilos de ropa, seña, paga todo, mil, lucas, teléfono 3471, orden lista, entregada.";

export async function transcribe(audio: ArrayBuffer, filename: string, hint = ""): Promise<string> {
  if (!aiEnabled()) throw new Error("Para entender audios hay que configurar AI_API_KEY");
  const ext = AUDIO_EXT[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "ogg";
  const form = new FormData();
  form.append("file", new Blob([audio]), `audio.${ext}`);
  form.append("model", process.env.AI_AUDIO_MODEL || "whisper-large-v3");
  form.append("language", "es");
  form.append("temperature", "0");
  form.append("prompt", `${AUDIO_HINT} ${hint}`.trim().slice(0, 800));
  const res = await fetch(`${base()}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcripción falló (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { text: string }).text.trim();
}

const aiSchema = z.object({
  intent: z.enum(["nueva_orden", "marcar_listo", "marcar_entregado", "otro"]).catch("otro"),
  orderId: z.coerce.number().int().positive().nullable().catch(null),
  clientName: z.string().trim().min(1).nullable().catch(null),
  phone: z.string().nullable().catch(null),
  items: z
    .array(
      z.object({
        priceItemId: z.coerce.number().int().nullable().catch(null),
        description: z.string().nullable().catch(null),
        quantity: z.coerce.number().positive().catch(1),
        unitPrice: z.coerce.number().nonnegative().nullable().catch(null),
      }),
    )
    .catch([]),
  deposit: z.coerce.number().nonnegative().catch(0),
  paidInFull: z.boolean().catch(false),
  paidAmount: z.coerce.number().nonnegative().nullable().catch(null),
  notes: z.string().nullable().catch(null),
});

function systemPrompt(prices: PriceItem[]) {
  const list = prices
    .map(
      (p) =>
        `- id ${p.id}: ${p.name} (${p.unit === "kg" ? `$${p.priceMin}/kg, mínimo $${p.minCharge ?? 0} hasta ${p.minChargeUpToKg ?? 0} kg` : `$${p.priceMin}${p.priceMax ? `–$${p.priceMax}` : ""}`}) sinónimos: ${p.keywords ?? ""}`,
    )
    .join("\n");
  return `Sos el asistente del Lavadero eLeGe (Argentina). El personal te manda mensajes o audios transcriptos.
Extraé los datos y respondé SOLO un JSON con esta forma:
{"intent":"nueva_orden|marcar_listo|marcar_entregado|otro","orderId":number|null,"clientName":string|null,"phone":string|null,
 "items":[{"priceItemId":number|null,"description":string|null,"quantity":number,"unitPrice":number|null}],
 "deposit":number,"paidInFull":boolean,"paidAmount":number|null,"notes":string|null}

Lista de precios:
${list}

Reglas:
- "nueva_orden": alguien deja ropa. clientName = nombre y apellido del cliente; phone = teléfono tal cual lo dijeron.
- Cada prenda va en items con el priceItemId de la lista. Para "Ropa por kg" quantity = kilos (si no dicen el peso, usá el mínimo y anotalo en notes).
- description: solo detalles para reconocer la prenda (colores, marca, estado). No repitas el nombre del ítem.
- Abreviaturas del cuaderno: "ac" = acolchado, "1p"/"2p" = 1 o 2 plazas, "fr" = frazada.
- Si la prenda no está en la lista (ej. frazada, cortina), priceItemId = null, description = qué es, y unitPrice solo si dijeron el precio.
- unitPrice solo si dijeron un precio explícito para esa prenda; si no, null.
- deposit = seña o "entrega" que dejó al traer la ropa (0 si no dijeron).
- paidInFull = true si dijeron que paga/pagó todo, el total o completo al dejar la ropa (en ese caso deposit = 0).
- "marcar_listo": avisan que una orden está lista (orderId = número de orden).
- "marcar_entregado": el cliente retiró (orderId, paidAmount = lo que pagó al retirar si lo dicen).
- Montos en pesos, como números enteros (ej. "quince mil" = 15000, "15 lucas" = 15000).
- notes: aclaraciones útiles (manchas, urgencia, etc.) o null.`;
}

export async function interpret(text: string, prices: PriceItem[]): Promise<ParsedMessage & { engine: "ia" | "reglas" }> {
  if (!aiEnabled()) return { ...parseByRules(text, prices), engine: "reglas" };
  try {
    const res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.AI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_TEXT_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(prices) },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = aiSchema.parse(JSON.parse(data.choices[0].message.content));
    const validIds = new Set(prices.map((p) => p.id));
    return {
      ...parsed,
      phone: normalizePhone(parsed.phone),
      items: parsed.items.map((i) => ({ ...i, priceItemId: i.priceItemId && validIds.has(i.priceItemId) ? i.priceItemId : null })),
      engine: "ia",
    };
  } catch (e) {
    console.error("Fallo la IA, uso reglas:", e);
    return { ...parseByRules(text, prices), engine: "reglas" };
  }
}

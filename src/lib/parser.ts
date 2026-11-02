// Interpretación de mensajes del personal ("Ana Pérez 3471555123, 1 acolchado 2 plazas, seña 5000").
// Este parser por reglas funciona sin IA; si hay AI_API_KEY se usa el modelo y esto queda de respaldo.
import type { PriceItem } from "./db/schema";
import { normalizePhone } from "./format";

export type ParsedItem = {
  priceItemId: number | null;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
};

export type ParsedMessage = {
  intent: "nueva_orden" | "marcar_listo" | "marcar_entregado" | "otro";
  orderId: number | null;
  clientName: string | null;
  phone: string | null;
  items: ParsedItem[];
  deposit: number;
  paidAmount: number | null;
  notes: string | null;
};

const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };

function strip(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const parseAmount = (s: string) => Number(s.replace(/[.\s]/g, "").replace(",", "."));

type Rule = { test: RegExp; pick: (items: PriceItem[]) => PriceItem | undefined };

// Orden importante: lo más específico primero.
const RULES: Rule[] = [
  { test: /plumon|pluma/, pick: (i) => i.find((p) => /plum/i.test(strip(p.name))) },
  { test: /(acolchado|\bac\b|\bacol).*(2\s*p\b|2\s*plazas?|dos plazas|matrimonial)|(2\s*p\b|2\s*plazas?)\s*(acolchado)?/, pick: (i) => i.find((p) => /acolchado 2/i.test(strip(p.name))) },
  { test: /acolchado|\bac\b|\bacol/, pick: (i) => i.find((p) => /acolchado 1/i.test(strip(p.name))) },
  { test: /camper/, pick: (i) => i.find((p) => /camper/i.test(strip(p.name))) },
  { test: /almohad/, pick: (i) => i.find((p) => /almohad/i.test(strip(p.name))) },
  { test: /\d\s*(kg|kilos?)\b|\bropa\b|\bbolsa/, pick: (i) => i.find((p) => p.unit === "kg") },
];

// Prendas que no están en el cartel: van como línea con precio manual.
const OTHER_GARMENTS = /\b(frazadas?|mantas?|cortinas?|sabanas?|manteles?|mantel|cubrecamas?|colchas?|edredon(es)?|toallas?|alfombras?|almohadones?|fundas?)\b/;

function otherGarment(seg: string, s: string): ParsedItem {
  const lead = s.match(/^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis)\s+/);
  const quantity = lead ? (/^\d+$/.test(lead[1]) ? Number(lead[1]) : NUMBER_WORDS[lead[1]] ?? 1) : 1;
  // "a 14 mil", "$14000", "por 14.000"
  const price = s.match(/(?:\ba|\$|\bpor)\s*\$?\s*(\d[\d.,]*)\s*(mil|lucas?|k\b)?/);
  const unitPrice = price ? parseAmount(price[1]) * (price[2] ? 1000 : 1) : null;
  let description = seg.slice(lead ? lead[0].length : 0);
  if (price?.index !== undefined) description = description.slice(0, price.index - (lead ? lead[0].length : 0));
  description = description.trim().replace(/^\p{L}/u, (c) => c.toUpperCase());
  return { priceItemId: null, description, quantity, unitPrice: unitPrice && unitPrice >= 100 ? unitPrice : null };
}

export function parseByRules(text: string, prices: PriceItem[]): ParsedMessage {
  const raw = text.trim();
  const t = strip(raw);
  const result: ParsedMessage = {
    intent: "nueva_orden",
    orderId: null,
    clientName: null,
    phone: null,
    items: [],
    deposit: 0,
    paidAmount: null,
    notes: null,
  };

  const ready = t.match(/(?:orden|pedido|ticket|numero|nro|#)\s*#?\s*(\d{1,6})\b.*\b(lista|listo)\b/) ?? t.match(/\b(lista|listo)\b.*(?:orden|pedido|ticket|numero|nro|#)\s*#?\s*(\d{1,6})\b/);
  if (ready) {
    result.intent = "marcar_listo";
    result.orderId = Number(/^\d+$/.test(ready[1]) ? ready[1] : ready[2]);
    return result;
  }
  const delivered = t.match(/(?:orden|pedido|ticket|numero|nro|#)\s*#?\s*(\d{1,6})\b.*\b(entregad[oa]|retir[oó]|se llevo)\b/);
  if (delivered) {
    result.intent = "marcar_entregado";
    result.orderId = Number(delivered[1]);
    const paid = t.match(/(?:pago|abono|pag[oó])\s*\$?\s*([\d.]+)/);
    if (paid) result.paidAmount = parseAmount(paid[1]);
    return result;
  }

  // "seña 10000", "deja 10 mil", "10.000 de seña". strip() conserva la longitud, así que los índices sirven sobre el texto original.
  const AMOUNT = String.raw`\$?\s*(\d[\d.,]*)\s*(mil|lucas?|k\b)?`;
  const amountOf = (m: RegExpMatchArray) => parseAmount(m[1]) * (m[2] ? 1000 : 1);
  // Montos chicos no son seña: "deja 2 acolchados" es una cantidad.
  const deposit = [
    ...t.matchAll(new RegExp(String.raw`(?:deja|dejo)?\s*${AMOUNT}\s*(?:de\s*)?(?:sena|adelanto)`, "g")),
    ...t.matchAll(new RegExp(String.raw`(?:sena|entrega|deja|dejo|adelant\w*|a cuenta)\s*(?:de|con)?\s*${AMOUNT}`, "g")),
  ].find((m) => amountOf(m) >= 100);
  let rest = raw;
  if (deposit && deposit.index !== undefined) {
    result.deposit = amountOf(deposit);
    rest = raw.slice(0, deposit.index) + " " + raw.slice(deposit.index + deposit[0].length);
  }

  // Solo espacios/guiones dentro del número: un salto de línea separa el teléfono de la línea siguiente.
  const phoneMatch = rest.match(/(?:tel[eé]fono|tel|cel(?:ular)?)?[: \t]*(\+?\d[\d \t-]{6,}\d)/i);
  if (phoneMatch) {
    result.phone = normalizePhone(phoneMatch[1]);
    rest = rest.replace(phoneMatch[0], " ");
  }

  const nameParts: string[] = [];
  // "Enzo Dalmazo lleva una frazada…": lo que va antes del verbo es el cliente.
  const verb = rest.match(/^\s*([^\d,;\n]{3,60}?)\s+(?:lleva|llev[oó]|deja|dej[oó]|trae|traj[oó])\s+/i);
  if (verb && verb[1].trim().split(/\s+/).length <= 4) {
    nameParts.push(verb[1].trim());
    rest = rest.slice(verb[0].length);
  }

  const segments = rest
    // "y"/"más" separan prendas solo si sigue una cantidad ("1 acolchado negro y gris y 5 kg de ropa").
    .split(/[,\n;]+|\s+(?:y|mas|más)\s+(?=(?:\d|un\b|una\b|uno\b|dos\b|tres\b|cuatro\b|cinco\b|seis\b))/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const s = strip(seg);
    // Antes que las reglas: "frazada de 2 plazas" no es un acolchado de 2 plazas.
    if (OTHER_GARMENTS.test(s)) {
      result.items.push(otherGarment(seg, s));
      continue;
    }
    const rule = RULES.find((r) => r.test.test(s));
    const item = rule?.pick(prices);
    if (!item) {
      const named = seg.match(/(?:nombre|cliente|a nombre de)[:\s]+(.+)/i);
      if (named) nameParts.push(named[1]);
      else if (!/\d/.test(s) && s.split(/\s+/).length <= 4) nameParts.push(seg);
      continue;
    }
    let quantity = 1;
    if (item.unit === "kg") {
      const kg = s.match(/([\d.,]+)\s*(kg|kilos?)/);
      quantity = kg ? parseAmount(kg[1]) : item.minChargeUpToKg ?? 1;
    } else {
      const n = s.match(/^(\d+)\s/) ?? s.match(/^(\w+)\s/);
      if (n) quantity = /^\d+$/.test(n[1]) ? Number(n[1]) : NUMBER_WORDS[n[1]] ?? 1;
    }
    const colors = s.match(/\b(negr\w*|blanc\w*|gris\w*|azul\w*|roj\w*|verde\w*|rosa\w*|beige|marron\w*|celeste\w*|violeta\w*|lila\w*|estampad\w*|floreado\w*)\b/g);
    result.items.push({ priceItemId: item.id, description: colors ? colors.join(" ") : null, quantity, unitPrice: null });
  }

  if (nameParts.length) {
    result.clientName = nameParts[0]
      .replace(/^(hola|buenas|buen dia)[,!\s]*/i, "")
      .trim()
      .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  }
  if (!result.items.length) result.intent = result.clientName || result.phone ? "nueva_orden" : "otro";
  return result;
}

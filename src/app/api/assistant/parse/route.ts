import { eq } from "drizzle-orm";
import { z } from "zod";
import { interpret } from "@/lib/ai";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { clients, priceItems } from "@/lib/db/schema";
import { sameName } from "@/lib/format";

/** "Carga rápida": interpreta un mensaje libre y devuelve un borrador de orden para revisar en el panel. */
export const POST = route(async (req) => {
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(3).max(4000) }));
  const prices = await db.select().from(priceItems).where(eq(priceItems.active, true));
  const parsed = await interpret(text, prices);
  // Solo se toma el cliente existente si coincide el nombre: un teléfono puede ser de toda la familia.
  const samePhone = parsed.phone ? await db.query.clients.findMany({ where: eq(clients.phone, parsed.phone) }) : [];
  const existing = samePhone.find((c) => !parsed.clientName || sameName(c.name, parsed.clientName));
  return { ...parsed, existingClient: existing ? { id: existing.id, name: existing.name, phone: existing.phone } : null };
});

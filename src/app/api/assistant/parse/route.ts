import { eq } from "drizzle-orm";
import { z } from "zod";
import { interpret } from "@/lib/ai";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { priceItems } from "@/lib/db/schema";
import { matchClient } from "@/lib/orders";

/** "Carga rápida": interpreta un mensaje libre y devuelve un borrador de orden para revisar en el panel. */
export const POST = route(async (req) => {
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(3).max(4000) }));
  const prices = await db.select().from(priceItems).where(eq(priceItems.active, true));
  const parsed = await interpret(text, prices);
  // Mismo criterio que al guardar: teléfono + nombre de pila, o el nombre "como suena" (Dalmazo = Dalmasso).
  const existing = await matchClient(parsed.clientName, parsed.phone);
  return { ...parsed, existingClient: existing ? { id: existing.id, name: existing.name, phone: existing.phone } : null };
});

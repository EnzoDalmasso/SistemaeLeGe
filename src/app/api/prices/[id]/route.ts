import { eq } from "drizzle-orm";
import { HttpError, idParam, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { orderItems, priceItems } from "@/lib/db/schema";
import { priceSchema } from "@/lib/shared";

export const PATCH = route<{ params: Promise<{ id: string }> }>(
  async (req, { params }) => {
    const id = idParam((await params).id);
    const body = await parseBody(req, priceSchema.partial());
    const [updated] = await db.update(priceItems).set(body).where(eq(priceItems.id, id)).returning();
    if (!updated) throw new HttpError(404, "Precio no encontrado");
    return updated;
  },
  { admin: true },
);

/** Las órdenes viejas conservan el nombre y el importe de la prenda: solo se suelta la referencia. */
export const DELETE = route<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const id = idParam((await params).id);
    const deleted = await db.transaction(async (tx) => {
      await tx.update(orderItems).set({ priceItemId: null }).where(eq(orderItems.priceItemId, id));
      return tx.delete(priceItems).where(eq(priceItems.id, id)).returning();
    });
    if (!deleted.length) throw new HttpError(404, "Precio no encontrado");
    return { ok: true };
  },
  { admin: true },
);

import { eq } from "drizzle-orm";
import { HttpError, idParam, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { priceItems } from "@/lib/db/schema";
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

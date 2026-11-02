import { eq } from "drizzle-orm";
import { z } from "zod";
import { HttpError, idParam, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { normalizePhone } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = idParam((await params).id);
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
    with: { orders: { with: { items: true }, orderBy: (o, { desc }) => desc(o.receivedAt) } },
  });
  if (!client) throw new HttpError(404, "Cliente no encontrado");
  const { telegramChatId, ...rest } = client;
  return { ...rest, telegramLinked: telegramChatId !== null };
});

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const body = await parseBody(req, schema);
  const [updated] = await db
    .update(clients)
    .set({ ...body, ...(body.phone !== undefined ? { phone: normalizePhone(body.phone) } : {}) })
    .where(eq(clients.id, id))
    .returning({ id: clients.id });
  if (!updated) throw new HttpError(404, "Cliente no encontrado");
  return updated;
});

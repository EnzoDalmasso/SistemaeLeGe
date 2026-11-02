import { eq } from "drizzle-orm";
import { z } from "zod";
import { idParam, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { ORDER_STATUSES, orders } from "@/lib/db/schema";
import { whatsappLink } from "@/lib/format";
import { changeStatus, getOrder, readyMessage } from "@/lib/orders";
import { clientLink, telegramEnabled } from "@/lib/telegram";

type Ctx = { params: Promise<{ id: string }> };

async function detail(id: number) {
  const { order, text } = await readyMessage(id);
  const telegramLink = telegramEnabled() ? await clientLink(order.client.linkToken).catch(() => null) : null;
  const expired = order.status === "listo" && !!order.notifiedAt && Date.now() - order.notifiedAt.getTime() > 30 * 86400_000;
  return { ...order, expired, readyText: text, whatsappUrl: whatsappLink(order.client.phone, text), telegramLink };
}

export const GET = route<Ctx>(async (_req, { params }) => detail(idParam((await params).id)));

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paidOnPickup: z.number().int().nonnegative().optional(),
  deposit: z.number().int().positive("La seña es obligatoria").optional(),
  notes: z.string().max(1000).nullable().optional(),
  markNotified: z.literal(true).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const id = idParam((await params).id);
  const body = await parseBody(req, patchSchema);
  const current = await getOrder(id);

  const set: Partial<typeof orders.$inferInsert> = {};
  if (body.deposit !== undefined) set.deposit = body.deposit;
  if (body.notes !== undefined) set.notes = body.notes;
  if (body.paidOnPickup !== undefined && !body.status)
    set.paidOnPickup = Math.min(body.paidOnPickup, Math.max(0, current.total - (body.deposit ?? current.deposit)));
  if (body.markNotified && !current.notifiedAt) set.notifiedAt = new Date();
  if (Object.keys(set).length) await db.update(orders).set(set).where(eq(orders.id, id));

  const notification = body.status ? (await changeStatus(id, { status: body.status, paidOnPickup: body.paidOnPickup })).notification : null;
  return { ...(await detail(id)), notification };
});

import { randomBytes } from "node:crypto";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { db } from "./db";
import { clients, orderItems, orders, priceItems, users, type OrderStatus } from "./db/schema";
import { balance, money, normalizePhone, ticket } from "./format";
import { HttpError } from "./api";
import { sendToClient, type SendResult } from "./messaging";
import { computeLine, depositProblem, type LineInput } from "./pricing";
import { getSettings } from "./settings";
import { escapeHtml, sendMessage, telegramEnabled } from "./telegram";

export const newLinkToken = () => randomBytes(9).toString("base64url");

export type ClientInput = { clientId?: number | null; name?: string | null; phone?: string | null };

/** Busca el cliente por id, por teléfono o por nombre exacto; si no existe lo crea. */
export async function findOrCreateClient(input: ClientInput) {
  if (input.clientId) {
    const c = await db.query.clients.findFirst({ where: eq(clients.id, input.clientId) });
    if (!c) throw new HttpError(404, "Cliente no encontrado");
    return c;
  }
  const phone = normalizePhone(input.phone);
  const name = input.name?.trim();
  if (phone) {
    const byPhone = await db.query.clients.findFirst({ where: eq(clients.phone, phone) });
    if (byPhone) return byPhone;
  } else if (name) {
    const byName = await db.query.clients.findFirst({ where: ilike(clients.name, name) });
    if (byName) return byName;
  }
  if (!name) throw new HttpError(400, "Falta el nombre del cliente");
  const [created] = await db.insert(clients).values({ name, phone, linkToken: newLinkToken() }).returning();
  return created;
}

export async function computeLines(lines: LineInput[]) {
  const ids = lines.map((l) => l.priceItemId).filter((x): x is number => !!x);
  const items = ids.length ? await db.select().from(priceItems).where(inArray(priceItems.id, ids)) : [];
  return lines.map((l) => computeLine(items.find((i) => i.id === l.priceItemId), l));
}

export type CreateOrderInput = {
  client: ClientInput;
  items: LineInput[];
  deposit?: number;
  /** Pagó todo al dejar la ropa: la seña pasa a ser el importe. */
  paidInFull?: boolean;
  notes?: string | null;
  source?: "panel" | "telegram" | "whatsapp";
  rawMessage?: string | null;
  createdById?: number | null;
};

export async function createOrder(input: CreateOrderInput) {
  if (!input.items.length) throw new HttpError(400, "La orden no tiene prendas");
  const lines = await computeLines(input.items);
  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const deposit = input.paidInFull ? total : Math.round(input.deposit ?? 0);
  const problem = depositProblem(total, deposit);
  if (problem) throw new HttpError(400, problem);
  const client = await findOrCreateClient(input.client);

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        clientId: client.id,
        total,
        deposit,
        notes: input.notes?.trim() || null,
        source: input.source ?? "panel",
        rawMessage: input.rawMessage ?? null,
        createdById: input.createdById ?? null,
      })
      .returning();
    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));
    return { ...order, client };
  });
}

export async function getOrder(id: number) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      client: true,
      items: { orderBy: (i, { asc }) => asc(i.id) },
      notifications: { orderBy: (n, { desc }) => desc(n.createdAt) },
      createdBy: { columns: { name: true } },
    },
  });
  if (!order) throw new HttpError(404, `No existe la orden ${ticket(id)}`);
  return order;
}

export async function readyMessage(orderId: number) {
  const order = await getOrder(orderId);
  const s = await getSettings();
  const due = balance(order);
  const text = s.ready_template
    .replaceAll("{nombre}", order.client.name.split(" ")[0])
    .replaceAll("{ticket}", ticket(order.id))
    .replaceAll("{negocio}", s.business_name)
    .replaceAll("{total}", money(order.total))
    .replaceAll("{saldo}", due > 0 ? `Saldo a abonar: ${money(due)}.` : "Ya está todo abonado.");
  return { order, text };
}

export async function notifyReady(orderId: number): Promise<SendResult> {
  const { order, text } = await readyMessage(orderId);
  const result = await sendToClient(order.client, text, order.id);
  if (result.status === "enviado" && !order.notifiedAt) {
    await db.update(orders).set({ notifiedAt: new Date() }).where(eq(orders.id, order.id));
  }
  if (result.status !== "enviado") await alertStaff(order.id, order.client.name, result);
  return result;
}

/** Si el aviso no salió automáticamente, avisa al personal por Telegram para que lo manden a mano. */
async function alertStaff(orderId: number, clientName: string, result: SendResult) {
  if (!telegramEnabled()) return;
  const staff = await db.query.users.findMany({ where: and(eq(users.active, true)), columns: { telegramChatId: true } });
  const why = result.status === "error" ? `Error: ${result.error}` : "El cliente no tiene el chat vinculado.";
  const text = `⚠️ No se pudo avisar automáticamente a <b>${escapeHtml(clientName)}</b> (${ticket(orderId)}).\n${escapeHtml(why)}\nAbrí la orden en el panel y usá «Enviar por WhatsApp».`;
  await Promise.allSettled(staff.filter((u) => u.telegramChatId).map((u) => sendMessage(u.telegramChatId!, text)));
}

export type StatusChange = { status: OrderStatus; paidOnPickup?: number };

export async function changeStatus(orderId: number, change: StatusChange) {
  const order = await getOrder(orderId);
  if (order.status === change.status) return { order, notification: null };
  const now = new Date();
  const set: Partial<typeof orders.$inferInsert> = { status: change.status };
  if (change.status === "listo" && !order.readyAt) set.readyAt = now;
  if (change.status === "entregado") {
    set.deliveredAt = now;
    // Al retirar solo se cobra el saldo: si pagó todo con la seña, no se vuelve a cobrar.
    const due = Math.max(0, order.total - order.deposit);
    set.paidOnPickup = Math.min(due, Math.max(0, Math.round(change.paidOnPickup ?? due)));
  }
  if (change.status !== "entregado" && order.status === "entregado") set.deliveredAt = null;
  await db.update(orders).set(set).where(eq(orders.id, orderId));

  const notification = change.status === "listo" ? await notifyReady(orderId) : null;
  return { order: await getOrder(orderId), notification };
}

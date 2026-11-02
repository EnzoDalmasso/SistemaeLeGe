import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { clients, ORDER_STATUSES, orders, type OrderStatus } from "@/lib/db/schema";
import { normalizePhone } from "@/lib/format";
import { createOrder } from "@/lib/orders";

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const filters: SQL[] = [];
  if (status === "activas") filters.push(inArray(orders.status, ["recibido", "lavando", "listo"]));
  else if (status && (ORDER_STATUSES as readonly string[]).includes(status)) filters.push(eq(orders.status, status as OrderStatus));
  if (q) {
    const phone = normalizePhone(q);
    const num = Number(q.replace("#", ""));
    const conds = [ilike(clients.name, `%${q}%`)];
    if (phone) conds.push(ilike(clients.phone, `%${phone}%`));
    if (Number.isInteger(num) && num > 0) conds.push(eq(orders.id, num));
    filters.push(or(...conds)!);
  }
  return db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      deposit: orders.deposit,
      paidOnPickup: orders.paidOnPickup,
      receivedAt: orders.receivedAt,
      readyAt: orders.readyAt,
      notifiedAt: orders.notifiedAt,
      deliveredAt: orders.deliveredAt,
      source: orders.source,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      items: sql<string>`(select string_agg(case when quantity <> 1 and description not like '% kg%' then quantity::text || ' × ' else '' end || description, ', ' order by id) from order_items where order_id = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(orders.receivedAt))
    .limit(Math.min(Number(url.searchParams.get("limit")) || 100, 500));
});

const itemSchema = z.object({
  priceItemId: z.number().int().positive().nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  quantity: z.number().positive().max(1000),
  unitPrice: z.number().int().nonnegative().nullable().optional(),
});

const createSchema = z.object({
  clientId: z.number().int().positive().nullable().optional(),
  clientName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos una prenda"),
  deposit: z.number().int().nonnegative().default(0),
  notes: z.string().max(1000).nullable().optional(),
  rawMessage: z.string().max(4000).nullable().optional(),
});

export const POST = route(async (req, _ctx, user) => {
  const body = await parseBody(req, createSchema);
  const order = await createOrder({
    client: { clientId: body.clientId, name: body.clientName, phone: body.phone },
    items: body.items,
    deposit: body.deposit,
    notes: body.notes,
    rawMessage: body.rawMessage,
    source: "panel",
    createdById: user.id,
  });
  return { id: order.id };
});

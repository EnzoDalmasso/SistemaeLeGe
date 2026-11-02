import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { clients, orders } from "@/lib/db/schema";
import { normalizePhone } from "@/lib/format";
import { findOrCreateClient } from "@/lib/orders";

export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const phone = normalizePhone(q);
  return db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      telegramLinked: sql<boolean>`${clients.telegramChatId} is not null`,
      orders: sql<number>`count(${orders.id})::int`,
      lastVisit: sql<string | null>`max(${orders.receivedAt})`,
      debt: sql<number>`coalesce(sum(case when ${orders.status} = 'entregado' then ${orders.total} - ${orders.deposit} - ${orders.paidOnPickup} else 0 end), 0)::int`,
    })
    .from(clients)
    .leftJoin(orders, eq(orders.clientId, clients.id))
    .where(q ? or(ilike(clients.name, `%${q}%`), phone ? ilike(clients.phone, `%${phone}%`) : undefined) : undefined)
    .groupBy(clients.id)
    .orderBy(desc(sql`max(${orders.receivedAt})`), clients.name)
    .limit(200);
});

const schema = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(40).nullable().optional() });

export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  return findOrCreateClient(body);
});

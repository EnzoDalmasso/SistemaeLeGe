import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { clients, orders } from "@/lib/db/schema";
import { arDayStart } from "@/lib/format";

const DAY = 86400_000;

export const GET = route(async () => {
  const today = arDayStart();
  const arNow = new Date(Date.now() - 3 * 3600_000);
  const monthStart = new Date(Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), 1, 3));
  const seriesStart = new Date(today.getTime() - 13 * DAY);
  const expiredBefore = new Date(Date.now() - 30 * DAY);
  // postgres.js v4 no serializa Date dentro de sql``: van como ISO.
  const [todayIso, monthIso, seriesIso] = [today, monthStart, seriesStart].map((d) => d.toISOString());

  const [byStatus, income, movements, ready, recent, expired, notNotified, monthOrders] = await Promise.all([
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({
        today: sql<number>`(coalesce(sum(case when ${orders.receivedAt} >= ${todayIso} then ${orders.deposit} end), 0)
          + coalesce(sum(case when ${orders.deliveredAt} >= ${todayIso} then ${orders.paidOnPickup} end), 0))::int`,
        month: sql<number>`(coalesce(sum(case when ${orders.receivedAt} >= ${monthIso} then ${orders.deposit} end), 0)
          + coalesce(sum(case when ${orders.deliveredAt} >= ${monthIso} then ${orders.paidOnPickup} end), 0))::int`,
        receivedToday: sql<number>`(count(*) filter (where ${orders.receivedAt} >= ${todayIso}))::int`,
        deliveredToday: sql<number>`(count(*) filter (where ${orders.deliveredAt} >= ${todayIso}))::int`,
      })
      .from(orders)
      .where(sql`${orders.status} <> 'cancelado'`),
    db
      .select({ receivedAt: orders.receivedAt, deposit: orders.deposit, deliveredAt: orders.deliveredAt, paid: orders.paidOnPickup })
      .from(orders)
      .where(and(sql`${orders.status} <> 'cancelado'`, sql`(${orders.receivedAt} >= ${seriesIso} or ${orders.deliveredAt} >= ${seriesIso})`)),
    db.query.orders.findMany({ where: eq(orders.status, "listo"), with: { client: true }, orderBy: asc(orders.readyAt), limit: 12 }),
    db.query.orders.findMany({ with: { client: true }, orderBy: desc(orders.receivedAt), limit: 8 }),
    db
      .select({ id: orders.id, name: clients.name, notifiedAt: orders.notifiedAt })
      .from(orders)
      .innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(eq(orders.status, "listo"), lt(orders.notifiedAt, expiredBefore))),
    db.$count(orders, and(eq(orders.status, "listo"), isNull(orders.notifiedAt))),
    db.$count(orders, gte(orders.receivedAt, monthStart)),
  ]);

  // Ingresos por día (seña al dejar + pago al retirar), últimos 14 días.
  const series = Array.from({ length: 14 }, (_, i) => ({ day: new Date(seriesStart.getTime() + i * DAY).toISOString(), amount: 0 }));
  const bucket = (d: Date | null) => (d && d >= seriesStart ? Math.floor((d.getTime() - seriesStart.getTime()) / DAY) : -1);
  for (const m of movements) {
    const a = bucket(m.receivedAt);
    if (a >= 0 && a < 14) series[a].amount += m.deposit;
    const b = bucket(m.deliveredAt);
    if (b >= 0 && b < 14) series[b].amount += m.paid;
  }

  return {
    counts: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    income: income[0],
    monthOrders,
    notNotified,
    series,
    ready,
    recent,
    expired,
  };
});

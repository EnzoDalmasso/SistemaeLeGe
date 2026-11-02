"use client";

import Link from "next/link";
import { useUser } from "@/components/shell";
import { Card, Empty, ErrorBox, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/client";
import { balance, fmtDate, money, ticket, type STATUS_LABELS } from "@/lib/format";

type MiniOrder = {
  id: number;
  status: keyof typeof STATUS_LABELS;
  total: number;
  deposit: number;
  paidOnPickup: number;
  receivedAt: string;
  readyAt: string | null;
  notifiedAt: string | null;
  client: { name: string };
};

type Dashboard = {
  counts: Partial<Record<keyof typeof STATUS_LABELS, number>>;
  income: { today: number; month: number; receivedToday: number; deliveredToday: number };
  monthOrders: number;
  notNotified: number;
  series: { day: string; amount: number }[];
  ready: MiniOrder[];
  recent: MiniOrder[];
  expired: { id: number; name: string; notifiedAt: string }[];
};

function Stat({ label, value, sub, tone = "ink", href }: { label: string; value: string | number; sub?: string; tone?: "ink" | "warn" | "brand" | "ok"; href?: string }) {
  const color = { ink: "text-ink", warn: "text-warn", brand: "text-brand-strong", ok: "text-ok" }[tone];
  const body = (
    <Card className="h-full p-4 transition hover:border-brand/40">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums sm:text-3xl ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const user = useUser();
  const { data, error } = useApi<Dashboard>("/api/dashboard");
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;

  const inProcess = (data.counts.recibido ?? 0) + (data.counts.lavando ?? 0);
  const max = Math.max(...data.series.map((s) => s.amount), 1);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <>
      <PageHeader title={`${greet}, ${user?.name.split(" ")[0]}`} subtitle={new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} />

      {data.expired.length > 0 && (
        <div className="mb-4 rounded-2xl border border-bad/20 bg-bad-soft p-4 text-sm text-bad">
          <b>{data.expired.length} orden(es) superaron los 30 días desde el aviso</b> y perdieron derecho a reclamo:{" "}
          {data.expired.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ", "}
              <Link className="underline" href={`/ordenes/${e.id}`}>
                {ticket(e.id)} {e.name}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="En proceso" value={inProcess} sub={`${data.counts.recibido ?? 0} recibidas · ${data.counts.lavando ?? 0} lavando`} href="/ordenes" />
        <Stat label="Listas p/ retirar" value={data.counts.listo ?? 0} tone="warn" sub={data.notNotified ? `${data.notNotified} sin avisar al cliente` : "Todas avisadas"} href="/ordenes" />
        <Stat label="Cobrado hoy" value={money(data.income.today)} tone="ok" sub={`${data.income.receivedToday} ingresos · ${data.income.deliveredToday} entregas`} />
        <Stat label="Cobrado en el mes" value={money(data.income.month)} tone="brand" sub={`${data.monthOrders} órdenes este mes`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Cobros de los últimos 14 días</h2>
            <span className="text-xs text-muted">señas + pagos al retirar</span>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {data.series.map((s) => {
              const d = new Date(s.day);
              return (
                <div key={s.day} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="min-h-1 rounded-t-md bg-brand/80 transition group-hover:bg-brand"
                    style={{ height: `${(s.amount / max) * 100}%` }}
                    title={`${d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short" })}: ${money(s.amount)}`}
                  />
                  <span className="mt-1 text-center text-[10px] text-muted">{d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Listas para retirar</h2>
            <Link href="/ordenes" className="text-xs text-brand">
              Ver todas
            </Link>
          </div>
          {data.ready.length === 0 ? (
            <Empty>No hay ropa esperando retiro 🎉</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.ready.map((o) => (
                <li key={o.id}>
                  <Link href={`/ordenes/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.client.name}</p>
                      <p className="text-xs text-muted">
                        {ticket(o.id)} · lista {fmtDate(o.readyAt)} {o.notifiedAt ? "· avisado" : <span className="text-warn">· sin avisar</span>}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{money(balance(o))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Últimos ingresos</h2>
          <Link href="/ordenes" className="text-xs text-brand">
            Historial completo
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <Empty>
            Todavía no hay órdenes. <Link href="/ordenes/nueva" className="text-brand underline">Cargá la primera</Link>.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/ordenes/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.client.name}</p>
                    <p className="text-xs text-muted">
                      {ticket(o.id)} · {fmtDate(o.receivedAt, true)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-sm tabular-nums sm:inline">{money(o.total)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

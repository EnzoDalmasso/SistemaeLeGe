"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconPlus, IconSearch } from "@/components/icons";
import { Card, Empty, ErrorBox, LinkButton, Loading, PageHeader, StatusBadge, inputCls } from "@/components/ui";
import { useApi } from "@/lib/client";
import { balance, fmtDate, money, ticket, type STATUS_LABELS } from "@/lib/format";

type Row = {
  id: number;
  status: keyof typeof STATUS_LABELS;
  total: number;
  deposit: number;
  paidOnPickup: number;
  receivedAt: string;
  deliveredAt: string | null;
  notifiedAt: string | null;
  source: string;
  clientName: string;
  clientPhone: string | null;
  items: string | null;
};

const TABS = [
  { key: "activas", label: "Activas" },
  { key: "recibido", label: "Recibidas" },
  { key: "lavando", label: "Lavando" },
  { key: "listo", label: "Listas" },
  { key: "entregado", label: "Entregadas" },
  { key: "", label: "Todas" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [status, setStatus] = useState("activas");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (debounced) params.set("q", debounced);
  const { data, error, loading } = useApi<Row[]>(`/api/orders?${params}`);

  return (
    <>
      <PageHeader
        title="Órdenes"
        subtitle="El historial de todos los lavados"
        actions={
          <LinkButton href="/ordenes/nueva" variant="primary" className="hidden sm:inline-flex">
            <IconPlus /> Nueva orden
          </LinkButton>
        }
      />

      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className={`${inputCls} pl-10`} placeholder="Buscar por nombre, teléfono o número de orden" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition ${status === t.key ? "bg-ink text-white" : "border border-line bg-card text-ink-soft hover:border-brand/40"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!data && loading ? (
        <Loading />
      ) : !data?.length ? (
        <Card>
          <Empty>No hay órdenes con ese filtro.</Empty>
        </Card>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <div className="space-y-2 md:hidden">
            {data.map((o) => (
              <Link key={o.id} href={`/ordenes/${o.id}`}>
                <Card className="mb-2 p-3.5 active:bg-paper">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.clientName}</p>
                      <p className="text-xs text-muted">
                        {ticket(o.id)} · {fmtDate(o.receivedAt)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{o.items}</p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted">Importe {money(o.total)}</span>
                    {balance(o) > 0 && o.status !== "cancelado" ? <span className="font-medium text-warn">Saldo {money(balance(o))}</span> : <span className="text-ok">Pagado</span>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* PC: como el cuaderno */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Nombre</th>
                  <th className="px-3 py-3 font-medium">Prenda / descripción</th>
                  <th className="px-3 py-3 text-right font-medium">Entrega</th>
                  <th className="px-3 py-3 text-right font-medium">Importe</th>
                  <th className="px-3 py-3 font-medium">Lleva</th>
                  <th className="px-3 py-3 text-right font-medium">Abona</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((o) => (
                  <tr key={o.id} onClick={() => router.push(`/ordenes/${o.id}`)} className="cursor-pointer hover:bg-paper">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{ticket(o.id)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{fmtDate(o.receivedAt)}</td>
                    <td className="px-3 py-3 font-medium">{o.clientName}</td>
                    <td className="max-w-xs truncate px-3 py-3 text-ink-soft" title={o.items ?? ""}>
                      {o.items}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.deposit ? money(o.deposit) : "—"}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{money(o.total)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{o.deliveredAt ? fmtDate(o.deliveredAt) : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.paidOnPickup ? money(o.paidOnPickup) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}

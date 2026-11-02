"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSearch } from "@/components/icons";
import { Card, Empty, ErrorBox, inputCls, Loading, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client";
import { fmtDate, money } from "@/lib/format";

type Row = { id: number; name: string; phone: string | null; telegramLinked: boolean; orders: number; lastVisit: string | null; debt: number };

export default function ClientsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error } = useApi<Row[]>(`/api/clients?q=${encodeURIComponent(debounced)}`);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Historial de cada cliente" />
      <div className="relative mb-4">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className={`${inputCls} pl-10`} placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? (
        <Loading />
      ) : (
        <Card>
          {data.length === 0 ? (
            <Empty>No se encontraron clientes.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.map((c) => (
                <li key={c.id}>
                  <Link href={`/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-strong">
                        {c.name
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {c.name} {c.telegramLinked && <span title="Recibe avisos automáticos" className="text-xs text-ok">●</span>}
                        </p>
                        <p className="text-xs text-muted">
                          {c.phone ?? "sin teléfono"} · {c.orders} {c.orders === 1 ? "orden" : "órdenes"} · última {fmtDate(c.lastVisit)}
                        </p>
                      </div>
                    </div>
                    {c.debt > 0 && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Debe {money(c.debt)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

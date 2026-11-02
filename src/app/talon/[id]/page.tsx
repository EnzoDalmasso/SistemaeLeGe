"use client";

import { useParams } from "next/navigation";
import { Logo } from "@/components/icons";
import { Loading } from "@/components/ui";
import { useApi } from "@/lib/client";
import { fmtDate, itemLabel, money, ticket } from "@/lib/format";

type Detail = {
  id: number;
  total: number;
  deposit: number;
  receivedAt: string;
  client: { name: string; phone: string | null };
  items: { id: number; description: string; quantity: number }[];
};

function Half({ o, who }: { o: Detail; who: string }) {
  return (
    <div className="flex-1 p-5 text-[13px] leading-relaxed">
      <div className="flex items-start justify-between">
        <span className="text-[10px] italic text-ink-soft">Documento no válido como factura</span>
        <span className="rounded border border-ink px-1.5 font-mono text-xs">{ticket(o.id)}</span>
      </div>
      <div className="my-2 text-center">
        <p className="text-xs font-bold tracking-[0.3em]">LAVADERO</p>
        <Logo className="text-4xl text-ink" />
        <p className="text-xs">Celular: 3471-687792</p>
      </div>
      <dl className="space-y-1 border-t border-ink pt-2">
        <div className="flex gap-2 border-b border-dotted border-ink-soft/60">
          <dt>Fecha ingreso:</dt>
          <dd className="font-medium">{fmtDate(o.receivedAt)}</dd>
        </div>
        <div className="flex gap-2 border-b border-dotted border-ink-soft/60">
          <dt>Nombre:</dt>
          <dd className="font-medium">{o.client.name}</dd>
        </div>
        <div className="flex gap-2 border-b border-dotted border-ink-soft/60">
          <dt>Teléfono:</dt>
          <dd className="font-medium">{o.client.phone ?? ""}</dd>
        </div>
        <div className="border-b border-dotted border-ink-soft/60">
          <dt>Prendas:</dt>
          <dd className="font-medium">
            {o.items.map((i) => (
              <div key={i.id}>{itemLabel(i)}</div>
            ))}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between">
        <span>Importe</span>
        <span className="min-w-28 border-2 border-ink px-2 py-1 text-right text-base font-bold">{money(o.total)}</span>
      </div>
      {o.deposit > 0 && <p className="mt-1 text-right text-xs">Seña: {money(o.deposit)} · Saldo: {money(o.total - o.deposit)}</p>}
      <div className="mt-3 text-center text-[11px]">
        <p className="font-bold underline">IMPORTANTE</p>
        <p>La Empresa no se responsabiliza por daños o pérdidas. Pasados los 30 días del primer aviso perderá todo derecho a reclamo.</p>
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted">{who}</p>
    </div>
  );
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { data: o } = useApi<Detail>(`/api/orders/${id}`);

  if (!o) return <Loading />;
  return (
    <main className="mx-auto max-w-3xl bg-white p-4 text-ink">
      <div className="no-print mb-4 flex gap-2">
        <button onClick={() => window.print()} className="flex-1 rounded-xl bg-ink py-3 text-white">
          Imprimir talón
        </button>
        <button onClick={() => window.close()} className="rounded-xl border border-line px-4">
          Cerrar
        </button>
      </div>
      <div className="flex flex-col border border-ink sm:flex-row">
        <Half o={o} who="Copia cliente" />
        <div className="border-t border-dashed border-ink sm:border-l sm:border-t-0" />
        <Half o={o} who="Copia lavadero" />
      </div>
    </main>
  );
}

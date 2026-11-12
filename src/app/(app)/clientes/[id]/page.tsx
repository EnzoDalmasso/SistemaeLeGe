"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { IconTrash } from "@/components/icons";
import { useUser } from "@/components/shell";
import { Button, Card, Empty, ErrorBox, Field, inputCls, Loading, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { balance, fmtDate, itemLabel, money, ticket, type STATUS_LABELS } from "@/lib/format";

type ClientDetail = {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  telegramLinked: boolean;
  createdAt: string;
  orders: {
    id: number;
    status: keyof typeof STATUS_LABELS;
    total: number;
    deposit: number;
    paidOnPickup: number;
    receivedAt: string;
    deliveredAt: string | null;
    items: { id: number; description: string; quantity: number }[];
  }[];
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useUser()?.role === "admin";
  const { data: c, error, reload } = useApi<ClientDetail>(`/api/clients/${id}`);
  const [edit, setEdit] = useState<{ name: string; phone: string; notes: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!c) return <Loading />;

  async function remove() {
    if (!c) return;
    const orders = c.orders.length;
    const warning = orders
      ? `Se van a borrar también sus ${orders === 1 ? "1 orden" : `${orders} órdenes`} y los cobros dejan de figurar en el panel.`
      : "No tiene órdenes.";
    if (!confirm(`¿Eliminar a ${c.name}? ${warning} No se puede deshacer.`)) return;
    setSaving(true);
    try {
      await api(`/api/clients/${c.id}`, { method: "DELETE" });
      router.replace("/clientes");
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar el cliente");
      setSaving(false);
    }
  }

  const spent = c.orders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.total, 0);
  const debt = c.orders.filter((o) => o.status === "entregado").reduce((s, o) => s + Math.max(balance(o), 0), 0);

  return (
    <>
      <PageHeader
        back="/clientes"
        title={c.name}
        subtitle={`${c.phone ?? "Sin teléfono"} · cliente desde ${fmtDate(c.createdAt)}${c.telegramLinked ? " · recibe avisos automáticos" : ""}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdit({ name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" })}>
              Editar
            </Button>
            {isAdmin && (
              <Button variant="danger" loading={saving} onClick={remove}>
                <IconTrash /> Eliminar
              </Button>
            )}
          </>
        }
      />
      {c.notes && <p className="mb-4 rounded-xl bg-brand-soft/60 px-4 py-3 text-sm">📌 {c.notes}</p>}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Órdenes</p>
          <p className="mt-1 text-2xl font-semibold">{c.orders.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Total</p>
          <p className="mt-1 text-2xl font-semibold">{money(spent)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Debe</p>
          <p className={`mt-1 text-2xl font-semibold ${debt ? "text-warn" : "text-ok"}`}>{money(debt)}</p>
        </Card>
      </div>

      <Card>
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold">Historial</h2>
        </div>
        {c.orders.length === 0 ? (
          <Empty>Sin órdenes todavía.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {c.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/ordenes/${o.id}`} className="block px-4 py-3 hover:bg-paper">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      <span className="font-mono text-xs text-muted">{ticket(o.id)}</span> · {fmtDate(o.receivedAt)}
                      {o.deliveredAt && <span className="text-muted"> → retiró {fmtDate(o.deliveredAt)}</span>}
                    </span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{o.items.map(itemLabel).join(", ")}</p>
                  <p className="mt-1 text-xs text-muted">
                    Importe {money(o.total)} · Entrega {money(o.deposit)} · Abona {money(o.paidOnPickup)}
                    {balance(o) > 0 && o.status !== "cancelado" && <span className="font-medium text-warn"> · Saldo {money(balance(o))}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar cliente">
        {edit && (
          <div className="space-y-3">
            <Field label="Nombre">
              <input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <input className={inputCls} type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Notas">
              <textarea className={`${inputCls} min-h-20 py-2`} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <ErrorBox>{saveError}</ErrorBox>
            <Button
              className="w-full"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                setSaveError(null);
                try {
                  const r = await api<{ id: number; merged: boolean }>(`/api/clients/${c.id}`, {
                    method: "PATCH",
                    json: { name: edit.name, phone: edit.phone || null, notes: edit.notes || null },
                  });
                  setEdit(null);
                  if (r.id !== c.id) router.replace(`/clientes/${r.id}`);
                  else reload();
                } catch (e) {
                  setSaveError(e instanceof Error ? e.message : "Error");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Guardar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

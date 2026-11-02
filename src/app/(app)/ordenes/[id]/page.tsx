"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { IconPrint, IconSend, IconWhatsapp } from "@/components/icons";
import { QrCode } from "@/components/qr-code";
import { Button, Card, ErrorBox, Field, inputCls, LinkButton, Loading, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { balance, fmtDate, money, STATUS_LABELS, ticket, whatsappLink } from "@/lib/format";

type Detail = {
  id: number;
  status: keyof typeof STATUS_LABELS;
  total: number;
  deposit: number;
  paidOnPickup: number;
  notes: string | null;
  source: string;
  rawMessage: string | null;
  receivedAt: string;
  readyAt: string | null;
  notifiedAt: string | null;
  deliveredAt: string | null;
  client: { id: number; name: string; phone: string | null; telegramChatId: number | null };
  createdBy: { name: string } | null;
  items: { id: number; description: string; quantity: number; unitPrice: number; subtotal: number }[];
  notifications: { id: number; channel: string; status: string; body: string; error: string | null; createdAt: string }[];
  readyText: string;
  whatsappUrl: string;
  telegramLink: string | null;
  expired: boolean;
  notification?: { status: string; error?: string } | null;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: o, error, setData } = useApi<Detail>(`/api/orders/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [paid, setPaid] = useState("");
  const [copied, setCopied] = useState(false);

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api<Detail>(`/api/orders/${id}`, { method: "PATCH", json: body });
      setData(r);
      if (r.notification) {
        setMsg(
          r.notification.status === "enviado"
            ? { tone: "ok", text: "✓ Se le avisó al cliente por Telegram." }
            : { tone: "warn", text: "El cliente no tiene el aviso automático vinculado. Usá «Enviar por WhatsApp»." },
        );
      }
      return r;
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy("resend");
    try {
      const r = await api<{ status: string; error?: string }>(`/api/orders/${id}/notify`, { method: "POST" });
      setMsg(r.status === "enviado" ? { tone: "ok", text: "✓ Aviso reenviado." } : { tone: "warn", text: r.error ?? "No se pudo enviar automáticamente." });
      setData(await api<Detail>(`/api/orders/${id}`));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!o) return <Loading />;

  const due = balance(o);

  return (
    <>
      <PageHeader
        back="/ordenes"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Orden {ticket(o.id)} <StatusBadge status={o.status} />
          </span>
        }
        subtitle={`Ingresó el ${fmtDate(o.receivedAt, true)}${o.createdBy ? ` · cargó ${o.createdBy.name}` : ""}${o.source === "telegram" ? " · vía Telegram" : ""}`}
        actions={
          <LinkButton href={`/talon/${o.id}`} external>
            <IconPrint /> Talón
          </LinkButton>
        }
      />

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${{ ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" }[msg.tone]}`}>{msg.text}</div>
      )}
      {o.expired && <div className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">Pasaron más de 30 días desde el primer aviso: el cliente perdió el derecho a reclamo.</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Acciones según el estado */}
          {o.status !== "entregado" && o.status !== "cancelado" && (
            <Card className="p-4">
              <p className="mb-3 text-sm text-muted">Siguiente paso</p>
              <div className="flex flex-wrap gap-2">
                {o.status === "recibido" && (
                  <Button onClick={() => patch({ status: "lavando" }, "lavando")} loading={busy === "lavando"}>
                    Pasar a lavado
                  </Button>
                )}
                {(o.status === "recibido" || o.status === "lavando") && (
                  <Button variant="success" onClick={() => patch({ status: "listo" }, "listo")} loading={busy === "listo"}>
                    ✓ Está lista — avisar al cliente
                  </Button>
                )}
                {o.status === "listo" && (
                  <>
                    <Button
                      variant="success"
                      onClick={() => {
                        setPaid(String(Math.max(due, 0)));
                        setDeliverOpen(true);
                      }}
                    >
                      {due > 0 ? "Entregar y cobrar" : "Entregar"}
                    </Button>
                    <a
                      href={o.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => !o.notifiedAt && patch({ markNotified: true }, "wa")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25d366] px-4 text-sm font-medium text-white hover:brightness-105"
                    >
                      <IconWhatsapp /> Enviar por WhatsApp
                    </a>
                    {o.client.telegramChatId && (
                      <Button variant="secondary" onClick={resend} loading={busy === "resend"}>
                        <IconSend /> Reenviar por Telegram
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-semibold">Prendas</h2>
            </div>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p>{i.description}</p>
                    <p className="text-xs text-muted">
                      {i.quantity} × {money(i.unitPrice)}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">{money(i.subtotal)}</span>
                </li>
              ))}
            </ul>
            {o.notes && <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">📌 {o.notes}</p>}
            {o.rawMessage && (
              <details className="border-t border-line px-4 py-3 text-sm">
                <summary className="cursor-pointer text-muted">Mensaje original</summary>
                <p className="mt-2 whitespace-pre-wrap italic text-ink-soft">“{o.rawMessage}”</p>
              </details>
            )}
          </Card>

          <Card>
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-semibold">Avisos al cliente</h2>
            </div>
            {o.notifications.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Todavía no se envió ningún aviso. Se envía solo al marcar la orden como lista.</p>
            ) : (
              <ul className="divide-y divide-line">
                {o.notifications.map((n) => (
                  <li key={n.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className={n.status === "enviado" ? "text-ok" : n.status === "error" ? "text-bad" : "text-warn"}>
                        {n.status === "enviado" ? "✓ Enviado" : n.status === "error" ? "✗ Error" : "Pendiente"} · {n.channel}
                      </span>
                      <span className="text-muted">{fmtDate(n.createdAt, true)}</span>
                    </div>
                    {n.error && <p className="mt-1 text-xs text-muted">{n.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Cliente</p>
            <Link href={`/clientes/${o.client.id}`} className="mt-1 block text-lg font-semibold hover:text-brand">
              {o.client.name}
            </Link>
            <p className="text-sm text-ink-soft">{o.client.phone ?? "Sin teléfono"}</p>
            <p className={`mt-2 text-xs ${o.client.telegramChatId ? "text-ok" : "text-muted"}`}>
              {o.client.telegramChatId ? "✓ Recibe avisos automáticos" : "Sin aviso automático vinculado"}
            </p>
            {!o.client.telegramChatId && o.telegramLink && (
              <div className="mt-3 rounded-xl bg-paper p-3 text-xs">
                <p className="mb-2 text-ink-soft">Que el cliente escanee este código con el celular y toque «Iniciar», o mandale el link:</p>
                <QrCode value={o.telegramLink} className="mx-auto mb-3 size-56 max-w-full" />
                {o.client.phone && (
                  <LinkButton
                    external
                    variant="secondary"
                    className="mb-3 w-full"
                    href={whatsappLink(
                      o.client.phone,
                      `Hola ${o.client.name.split(" ")[0]}! Para que te avisemos cuando tu ropa esté lista, tocá este link y apretá «Iniciar»: ${o.telegramLink}`,
                    )}
                  >
                    <IconWhatsapp /> Mandarle el link por WhatsApp
                  </LinkButton>
                )}
                <div className="flex gap-2">
                  <input readOnly value={o.telegramLink} className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[11px]" />
                  <button
                    className="rounded-lg bg-ink px-2.5 text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(o.telegramLink!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Importe</dt>
                <dd className="font-semibold tabular-nums">{money(o.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Entrega (seña)</dt>
                <dd className="tabular-nums">{money(o.deposit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Abona al retirar</dt>
                <dd className="tabular-nums">{money(o.paidOnPickup)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-medium">Saldo</dt>
                <dd className={`font-semibold tabular-nums ${due > 0 ? "text-warn" : "text-ok"}`}>{due > 0 ? money(due) : "Pagado"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <ol className="space-y-3 text-sm">
              {[
                ["Recibida", o.receivedAt],
                ["Lista", o.readyAt],
                ["Avisado al cliente", o.notifiedAt],
                ["Retirada (lleva)", o.deliveredAt],
              ].map(([label, at]) => (
                <li key={label} className="flex items-center gap-3">
                  <span className={`size-2.5 rounded-full ${at ? "bg-brand" : "border border-line bg-card"}`} />
                  <span className={at ? "" : "text-muted"}>{label}</span>
                  <span className="ml-auto text-muted">{at ? fmtDate(at, true) : "—"}</span>
                </li>
              ))}
            </ol>
          </Card>

          {o.status !== "cancelado" && o.status !== "entregado" && (
            <button
              className="w-full text-center text-sm text-muted hover:text-bad"
              onClick={() => confirm("¿Cancelar esta orden?") && patch({ status: "cancelado" }, "cancel")}
            >
              Cancelar orden
            </button>
          )}
          {(o.status === "entregado" || o.status === "cancelado") && (
            <button className="w-full text-center text-sm text-muted hover:text-brand" onClick={() => patch({ status: "listo" }, "reopen")}>
              Volver a «lista para retirar»
            </button>
          )}
        </div>
      </div>

      <Modal open={deliverOpen} onClose={() => setDeliverOpen(false)} title={`Entregar ${ticket(o.id)}`}>
        <p className="mb-4 text-sm text-ink-soft">
          Importe {money(o.total)} − seña {money(o.deposit)} = <b>saldo {money(due)}</b>
        </p>
        {due > 0 ? (
          <Field label="¿Cuánto abona ahora?" hint={`Como máximo el saldo: ${money(due)}`}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input className={`${inputCls} pl-7 text-lg`} inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} autoFocus />
            </div>
          </Field>
        ) : (
          <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm font-medium text-ok">✓ Ya está todo pagado: no hay que cobrar nada.</p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeliverOpen(false)}>
            Volver
          </Button>
          <Button
            variant="success"
            className="flex-1"
            loading={busy === "deliver"}
            onClick={async () => {
              const r = await patch({ status: "entregado", paidOnPickup: due > 0 ? Math.min(due, Number(paid.replace(/\D/g, "")) || 0) : 0 }, "deliver");
              if (r) setDeliverOpen(false);
            }}
          >
            Confirmar entrega
          </Button>
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconSparkle, IconTrash } from "@/components/icons";
import { Button, Card, ErrorBox, Field, inputCls, PageHeader } from "@/components/ui";
import { VoiceButton } from "@/components/voice-button";
import { api, useApi } from "@/lib/client";
import type { PriceItem } from "@/lib/db/schema";
import { money } from "@/lib/format";
import { computeLine, depositProblem, priceLabel } from "@/lib/pricing";

type Line = { key: number; priceItemId: number | null; quantity: string; unitPrice: string; description: string };
type ClientHit = { id: number; name: string; phone: string | null; orders: number };
type Parsed = {
  clientName: string | null;
  phone: string | null;
  items: { priceItemId: number | null; description: string | null; quantity: number; unitPrice: number | null }[];
  deposit: number;
  paidInFull: boolean;
  notes: string | null;
  engine: "ia" | "reglas";
  existingClient: { id: number; name: string; phone: string | null } | null;
};

let keySeq = 1;
const emptyLine = (priceItemId: number | null = null): Line => ({ key: keySeq++, priceItemId, quantity: "1", unitPrice: "", description: "" });
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

export default function NewOrderPage() {
  const router = useRouter();
  const { data: prices } = useApi<PriceItem[]>("/api/prices");
  const active = useMemo(() => (prices ?? []).filter((p) => p.active), [prices]);

  const [raw, setRaw] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseInfo, setParseInfo] = useState<string | null>(null);

  const [client, setClient] = useState<{ id: number | null; name: string; phone: string }>({ id: null, name: "", phone: "" });
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [deposit, setDeposit] = useState("");
  const [paidInFull, setPaidInFull] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sugerencias de clientes existentes mientras se escribe el nombre o el teléfono.
  const search = client.id ? "" : (client.phone.replace(/\D/g, "").length >= 4 ? client.phone : client.name).trim();
  useEffect(() => {
    if (search.length < 2) return;
    const t = setTimeout(() => api<ClientHit[]>(`/api/clients?q=${encodeURIComponent(search)}`).then((r) => setHits(r.slice(0, 5))).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [search]);

  const computed = lines.map((l) => {
    const item = active.find((p) => p.id === l.priceItemId);
    return computeLine(item, { quantity: num(l.quantity) ?? 1, unitPrice: num(l.unitPrice), description: l.description });
  });
  const total = computed.reduce((s, l) => s + l.subtotal, 0);
  const dep = paidInFull ? total : num(deposit) ?? 0;

  async function interpret(text = raw) {
    if (text.trim().length < 3) return;
    setParsing(true);
    setError(null);
    try {
      const r = await api<Parsed>("/api/assistant/parse", { method: "POST", json: { text } });
      if (r.existingClient) setClient({ id: r.existingClient.id, name: r.existingClient.name, phone: r.existingClient.phone ?? "" });
      else setClient({ id: null, name: r.clientName ?? "", phone: r.phone ?? "" });
      if (r.items.length)
        setLines(
          r.items.map((i) => ({
            key: keySeq++,
            priceItemId: i.priceItemId,
            quantity: String(i.quantity),
            unitPrice: i.unitPrice != null ? String(i.unitPrice) : "",
            description: i.description ?? "",
          })),
        );
      setDeposit(r.deposit ? String(r.deposit) : "");
      setPaidInFull(r.paidInFull);
      setNotes(r.notes ?? "");
      setParseInfo(
        `${r.engine === "ia" ? "Interpretado con IA" : "Interpretado sin IA (reglas)"}${r.existingClient ? " · cliente existente encontrado" : ""}. Revisá los datos antes de guardar.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setParsing(false);
    }
  }

  const updateLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function save() {
    setError(null);
    if (!client.id && client.name.trim().length < 2) return setError("Falta el nombre del cliente");
    const items = lines
      .filter((l) => l.priceItemId || l.description.trim())
      .map((l) => ({ priceItemId: l.priceItemId, quantity: num(l.quantity) ?? 1, unitPrice: num(l.unitPrice), description: l.description || null }));
    if (!items.length) return setError("Agregá al menos una prenda");
    const problem = depositProblem(total, dep);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const { id } = await api<{ id: number }>("/api/orders", {
        method: "POST",
        json: { clientId: client.id, clientName: client.name, phone: client.phone || null, items, deposit: dep, paidInFull, notes: notes || null, rawMessage: raw || null },
      });
      router.push(`/ordenes/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  }

  const categories = [...new Set(active.map((p) => p.category))];

  return (
    <>
      <PageHeader title="Nueva orden" subtitle="Reemplaza al talón de papel" back="/ordenes" />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="border-brand/25 bg-gradient-to-br from-brand-soft/70 to-card p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-brand-strong">
              <IconSparkle /> Carga rápida
            </div>
            <p className="mb-3 text-sm text-ink-soft">Escribí o grabá los datos como los dirías por WhatsApp y el sistema completa la orden.</p>
            <textarea
              className={`${inputCls} min-h-24 py-2.5`}
              placeholder="Ej: Ana Pérez, 3471 555123, un acolchado de 1 plaza negro y gris y 4 kilos de ropa, deja 10 mil de seña"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => interpret()} loading={parsing} disabled={raw.trim().length < 3}>
                <IconSparkle /> Completar orden
              </Button>
              <VoiceButton
                onText={(t) => {
                  setRaw(t);
                  interpret(t);
                }}
                onError={setError}
              />
            </div>
            {parseInfo && <p className="mt-3 text-xs text-brand-strong">{parseInfo}</p>}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Cliente</h2>
            {client.id ? (
              <div className="flex items-center justify-between rounded-xl bg-brand-soft/60 px-3 py-2.5">
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted">{client.phone || "sin teléfono"} · cliente existente</p>
                </div>
                <button className="text-sm text-brand" onClick={() => setClient({ id: null, name: "", phone: "" })}>
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre y apellido">
                    <input className={inputCls} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="off" />
                  </Field>
                  <Field label="Teléfono">
                    <input className={inputCls} type="tel" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="3471 123456" />
                  </Field>
                </div>
                {search.length >= 2 && hits.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-muted">¿Es alguno de estos clientes?</p>
                    <div className="flex flex-wrap gap-2">
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setClient({ id: h.id, name: h.name, phone: h.phone ?? "" })}
                          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand"
                        >
                          {h.name} <span className="text-muted">· {h.phone ?? "s/tel"} · {h.orders} órd.</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Prendas</h2>
            <div className="space-y-3">
              {lines.map((l, idx) => {
                const item = active.find((p) => p.id === l.priceItemId);
                const isKg = item?.unit === "kg";
                return (
                  <div key={l.key} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        className={`${inputCls} min-w-0 basis-full`}
                        value={l.priceItemId ?? ""}
                        onChange={(e) => updateLine(l.key, { priceItemId: e.target.value ? Number(e.target.value) : null, unitPrice: "" })}
                      >
                        <option value="">Otra prenda (precio manual)</option>
                        {categories.map((c) => (
                          <optgroup key={c} label={c}>
                            {active
                              .filter((p) => p.category === c)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      <div className="relative w-24 shrink-0">
                        <input
                          className={`${inputCls} pr-9`}
                          inputMode="decimal"
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          aria-label={isKg ? "Kilos" : "Cantidad"}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{isKg ? "kg" : "u."}</span>
                      </div>
                      <div className="relative min-w-28 flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                        <input
                          className={`${inputCls} pl-7`}
                          inputMode="numeric"
                          placeholder={item ? String(item.priceMin) : "Precio"}
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                          aria-label="Precio unitario"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [emptyLine()]))}
                        className="flex w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-bad-soft hover:text-bad sm:hidden"
                        aria-label="Quitar"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className={`${inputCls} min-h-9 text-sm`}
                        placeholder={item ? "Detalle: colores, marca, manchas…" : "¿Qué prenda es? (ej: frazada 2 plazas)"}
                        value={l.description}
                        onChange={(e) => updateLine(l.key, { description: e.target.value })}
                      />
                      <span className="w-24 shrink-0 text-right font-medium tabular-nums">{money(computed[idx].subtotal)}</span>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [emptyLine()]))}
                        className="hidden rounded-lg p-2 text-muted hover:bg-bad-soft hover:text-bad sm:block"
                        aria-label="Quitar"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    {item && <p className="mt-1.5 text-xs text-muted">{priceLabel(item)}</p>}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="mt-3 text-sm font-medium text-brand hover:underline">
              + Agregar prenda
            </button>
          </Card>
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <Card className="space-y-4 p-4">
            <Field label="Seña / entrega" hint="Obligatoria: deja seña o paga todo al traer la ropa">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  className={`${inputCls} pl-7 disabled:opacity-60`}
                  inputMode="numeric"
                  value={paidInFull ? String(total) : deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  disabled={paidInFull}
                  placeholder="0"
                />
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={paidInFull} onChange={(e) => setPaidInFull(e.target.checked)} />
              Pagó todo
            </label>
            <Field label="Observaciones">
              <textarea className={`${inputCls} min-h-16 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Manchas, urgencia, etc." />
            </Field>
            <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Importe</dt>
                <dd className="text-lg font-semibold tabular-nums">{money(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Seña</dt>
                <dd className="tabular-nums">− {money(dep)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Saldo al retirar</dt>
                <dd className="tabular-nums text-brand-strong">{money(total - dep)}</dd>
              </div>
            </dl>
            <ErrorBox>{error}</ErrorBox>
            <Button onClick={save} loading={saving} className="w-full">
              Guardar orden
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

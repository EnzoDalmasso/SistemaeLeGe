"use client";

import { useState } from "react";
import { useUser } from "@/components/shell";
import { Button, Card, ErrorBox, Field, inputCls, Loading, Modal, PageHeader } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { PriceItem } from "@/lib/db/schema";
import { priceLabel } from "@/lib/pricing";

type Form = { id?: number; category: string; name: string; unit: "unidad" | "kg"; priceMin: string; priceMax: string; minCharge: string; minChargeUpToKg: string; keywords: string; active: boolean };

const blank: Form = { category: "Ropa", name: "", unit: "unidad", priceMin: "", priceMax: "", minCharge: "", minChargeUpToKg: "", keywords: "", active: true };
const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));

export default function PricesPage() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const { data, error, reload } = useApi<PriceItem[]>("/api/prices");
  const [form, setForm] = useState<Form | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Loading />;
  const categories = [...new Set(data.map((p) => p.category))];

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        category: form.category,
        name: form.name,
        unit: form.unit,
        priceMin: n(form.priceMin) ?? 0,
        priceMax: n(form.priceMax),
        minCharge: form.unit === "kg" ? n(form.minCharge) : null,
        minChargeUpToKg: form.unit === "kg" ? n(form.minChargeUpToKg) : null,
        keywords: form.keywords || null,
        active: form.active,
      };
      await api(form.id ? `/api/prices/${form.id}` : "/api/prices", { method: form.id ? "PATCH" : "POST", json: body });
      setForm(null);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Precios"
        subtitle={isAdmin ? "Tocá un precio para cambiarlo" : "Lista de precios vigente"}
        actions={isAdmin && <Button onClick={() => setForm(blank)}>+ Agregar</Button>}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {categories.map((cat) => (
          <Card key={cat}>
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold uppercase tracking-wide text-brand-strong">{cat}</h2>
            <ul className="divide-y divide-line">
              {data
                .filter((p) => p.category === cat)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      disabled={!isAdmin}
                      onClick={() =>
                        setForm({
                          id: p.id,
                          category: p.category,
                          name: p.name,
                          unit: p.unit,
                          priceMin: String(p.priceMin),
                          priceMax: p.priceMax ? String(p.priceMax) : "",
                          minCharge: p.minCharge ? String(p.minCharge) : "",
                          minChargeUpToKg: p.minChargeUpToKg ? String(p.minChargeUpToKg) : "",
                          keywords: p.keywords ?? "",
                          active: p.active,
                        })
                      }
                      className={`flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left ${isAdmin ? "hover:bg-paper" : ""} ${p.active ? "" : "opacity-45"}`}
                    >
                      <span className="font-medium">
                        {p.name}
                        {!p.active && <span className="ml-2 text-xs text-muted">(oculto)</span>}
                      </span>
                      <span className="text-right text-sm tabular-nums text-ink-soft">{priceLabel(p)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Editar precio" : "Nuevo precio"}>
        {form && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría">
                <input className={inputCls} list="cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <datalist id="cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Se cobra por">
                <select className={inputCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Form["unit"] })}>
                  <option value="unidad">Unidad</option>
                  <option value="kg">Kilo</option>
                </select>
              </Field>
            </div>
            <Field label="Nombre">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={form.unit === "kg" ? "Precio por kg" : "Precio"}>
                <input className={inputCls} inputMode="numeric" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })} />
              </Field>
              <Field label="Hasta (opcional)" hint="Para rangos, ej. 15.000 – 17.000">
                <input className={inputCls} inputMode="numeric" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })} />
              </Field>
            </div>
            {form.unit === "kg" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mínimo $">
                  <input className={inputCls} inputMode="numeric" value={form.minCharge} onChange={(e) => setForm({ ...form, minCharge: e.target.value })} />
                </Field>
                <Field label="Mínimo hasta (kg)">
                  <input className={inputCls} inputMode="decimal" value={form.minChargeUpToKg} onChange={(e) => setForm({ ...form, minChargeUpToKg: e.target.value })} />
                </Field>
              </div>
            )}
            <Field label="Otras formas de decirlo" hint="Ayuda a la IA a reconocerlo en audios. Separado por comas.">
              <input className={inputCls} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Visible en la lista
            </label>
            <ErrorBox>{saveError}</ErrorBox>
            <Button className="w-full" loading={saving} onClick={save}>
              Guardar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

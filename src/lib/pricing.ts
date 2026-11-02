import type { PriceItem } from "./db/schema";

export type LineInput = {
  priceItemId?: number | null;
  description?: string | null;
  /** Cantidad de unidades, o kilos si el ítem se cobra por kg. */
  quantity: number;
  /** Precio unitario elegido (para ítems con rango, ej. acolchados $15.000–17.000). */
  unitPrice?: number | null;
};

export type ComputedLine = {
  priceItemId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export function computeLine(item: PriceItem | null | undefined, input: LineInput): ComputedLine {
  const quantity = input.quantity > 0 ? input.quantity : 1;
  if (!item) {
    const unitPrice = Math.round(input.unitPrice ?? 0);
    return {
      priceItemId: null,
      description: input.description?.trim() || "Otro",
      quantity,
      unitPrice,
      subtotal: Math.round(unitPrice * quantity),
    };
  }

  const unitPrice = Math.round(input.unitPrice ?? item.priceMin);
  const extra = input.description?.trim();

  if (item.unit === "kg") {
    // "Mínimo hasta 3 kg $12.000, por kg $3.500": se cobra lo que sea mayor.
    const byWeight = Math.round(quantity * unitPrice);
    const subtotal = Math.max(item.minCharge ?? 0, byWeight);
    return {
      priceItemId: item.id,
      description: `${item.name} ${quantity} kg${extra ? ` – ${extra}` : ""}`,
      quantity,
      unitPrice,
      subtotal,
    };
  }

  return {
    priceItemId: item.id,
    description: `${item.name}${extra ? ` – ${extra}` : ""}`,
    quantity,
    unitPrice,
    subtotal: Math.round(unitPrice * quantity),
  };
}

export function priceLabel(item: Pick<PriceItem, "unit" | "priceMin" | "priceMax" | "minCharge" | "minChargeUpToKg">) {
  const fmt = (n: number) => "$" + n.toLocaleString("es-AR");
  const base = item.priceMax && item.priceMax !== item.priceMin ? `${fmt(item.priceMin)} – ${fmt(item.priceMax)}` : fmt(item.priceMin);
  if (item.unit === "kg") {
    const min = item.minCharge ? ` (mínimo ${fmt(item.minCharge)}${item.minChargeUpToKg ? ` hasta ${item.minChargeUpToKg} kg` : ""})` : "";
    return `${base} por kg${min}`;
  }
  return base;
}

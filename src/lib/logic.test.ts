import { describe, expect, it } from "vitest";
import type { PriceItem } from "./db/schema";
import { balance, itemLabel, normalizePhone, whatsappLink } from "./format";
import { parseByRules } from "./parser";
import { computeLine } from "./pricing";

const p = (o: Partial<PriceItem>): PriceItem => ({
  id: 0, category: "", name: "", unit: "unidad", priceMin: 0, priceMax: null, minCharge: null,
  minChargeUpToKg: null, keywords: null, active: true, sortOrder: 0, ...o,
});

const PRICES = [
  p({ id: 1, name: "Acolchado 1 plaza", priceMin: 15000, priceMax: 17000 }),
  p({ id: 2, name: "Acolchado 2 plazas", priceMin: 18000, priceMax: 20000 }),
  p({ id: 3, name: "Acolchado plumón", priceMin: 23000 }),
  p({ id: 4, name: "Ropa por kg", unit: "kg", priceMin: 3500, minCharge: 12000, minChargeUpToKg: 3 }),
  p({ id: 5, name: "Campera", priceMin: 12000 }),
  p({ id: 6, name: "Almohada", priceMin: 12000 }),
];

describe("precios", () => {
  it("ropa por kg cobra el mínimo hasta 3 kg", () => {
    expect(computeLine(PRICES[3], { quantity: 2 }).subtotal).toBe(12000);
    expect(computeLine(PRICES[3], { quantity: 3 }).subtotal).toBe(12000);
  });
  it("ropa por kg cobra por peso arriba del mínimo", () => {
    expect(computeLine(PRICES[3], { quantity: 5 }).subtotal).toBe(17500);
  });
  it("acolchado usa el precio mínimo del rango salvo que se indique otro", () => {
    expect(computeLine(PRICES[0], { quantity: 2 }).subtotal).toBe(30000);
    expect(computeLine(PRICES[0], { quantity: 1, unitPrice: 17000 }).subtotal).toBe(17000);
  });
  it("prenda fuera de lista usa el precio indicado", () => {
    expect(computeLine(null, { quantity: 2, unitPrice: 9000, description: "Frazada" })).toMatchObject({ subtotal: 18000, description: "Frazada" });
  });
  it("saldo = importe − seña − abonado", () => {
    expect(balance({ total: 40000, deposit: 20000, paidOnPickup: 5000 })).toBe(15000);
  });
});

describe("teléfonos", () => {
  it.each([
    ["3471-687792", "3471687792"],
    ["03471 15 687792", "3471687792"],
    ["+54 9 3471 687792", "3471687792"],
    ["011 15 2345 6789", "1123456789"],
  ])("%s → %s", (raw, out) => expect(normalizePhone(raw)).toBe(out));
  it("no repite la cantidad en prendas por kilo", () => {
    expect(itemLabel({ quantity: 8, description: "Ropa por kg 8 kg" })).toBe("Ropa por kg 8 kg");
    expect(itemLabel({ quantity: 2, description: "Campera" })).toBe("2 × Campera");
  });
  it("arma link de WhatsApp con 549", () => {
    expect(whatsappLink("3471687792", "hola")).toBe("https://wa.me/5493471687792?text=hola");
  });
});

describe("parser por reglas", () => {
  it("entiende una orden típica", () => {
    const r = parseByRules("Ana Pérez, 3471 555123, 1 acolchado 1 plaza negro y gris, seña 10000", PRICES);
    expect(r.intent).toBe("nueva_orden");
    expect(r.clientName).toBe("Ana Pérez");
    expect(r.phone).toBe("3471555123");
    expect(r.deposit).toBe(10000);
    expect(r.items[0]).toMatchObject({ priceItemId: 1, quantity: 1 });
  });
  it("detecta 2 plazas, kilos y camperas", () => {
    const r = parseByRules("Marisa Mengarelli 3471-112233\n2 acolchados 2 plazas\n5 kg de ropa\n2 camperas", PRICES);
    expect(r.items).toEqual([
      expect.objectContaining({ priceItemId: 2, quantity: 2 }),
      expect.objectContaining({ priceItemId: 4, quantity: 5 }),
      expect.objectContaining({ priceItemId: 5, quantity: 2 }),
    ]);
  });
  it("seña dicha de distintas formas", () => {
    expect(parseByRules("Ana Pérez 3471 401122, un acolchado de 2 plazas y 4 kilos de ropa, deja 10.000 de seña", PRICES)).toMatchObject({
      clientName: "Ana Pérez",
      deposit: 10000,
      items: [expect.objectContaining({ priceItemId: 2 }), expect.objectContaining({ priceItemId: 4, quantity: 4 })],
    });
    expect(parseByRules("Juan Paz, 2 camperas, deja 15 mil", PRICES).deposit).toBe(15000);
  });
  it("abreviaturas del cuaderno", () => {
    const r = parseByRules("Mercedes Lazo, 1 ac 2p azul, 1 ac 1p verde", PRICES);
    expect(r.items.map((i) => i.priceItemId)).toEqual([2, 1]);
  });
  it("marca una orden como lista", () => {
    expect(parseByRules("La orden 12 ya está lista", PRICES)).toMatchObject({ intent: "marcar_listo", orderId: 12 });
  });
  it("marca entregada con pago", () => {
    expect(parseByRules("orden 7 entregada, pagó 15.000", PRICES)).toMatchObject({ intent: "marcar_entregado", orderId: 7, paidAmount: 15000 });
  });
});

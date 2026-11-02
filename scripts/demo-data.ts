// Datos de ejemplo para presentar la demo (clientes inventados). Uso: npm run db:demo
// No correr en producción: agrega órdenes ficticias.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const DAY = 86400_000;

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { orders, priceItems } = await import("../src/lib/db/schema");
  const { createOrder } = await import("../src/lib/orders");

  const prices = await db.select().from(priceItems);
  const id = (name: string) => prices.find((p) => p.name === name)!.id;

  type Demo = {
    name: string;
    phone: string;
    items: { item: string; quantity: number; description?: string; unitPrice?: number }[];
    deposit: number;
    daysAgo: number;
    status: "recibido" | "lavando" | "listo" | "entregado";
    paid?: number;
  };

  const demo: Demo[] = [
    { name: "Ana Giménez", phone: "3471 401122", items: [{ item: "Acolchado 2 plazas", quantity: 1, description: "azul" }, { item: "Acolchado 1 plaza", quantity: 1, description: "verde" }], deposit: 20000, daysAgo: 12, status: "entregado", paid: 13000 },
    { name: "Carlos Ruiz", phone: "3471 402233", items: [{ item: "Ropa por kg", quantity: 6 }], deposit: 0, daysAgo: 10, status: "entregado", paid: 21000 },
    { name: "Mabel Ferreyra", phone: "3471 403344", items: [{ item: "Acolchado plumón", quantity: 1, description: "blanco" }], deposit: 10000, daysAgo: 9, status: "entregado", paid: 13000 },
    { name: "Julián Sosa", phone: "3471 404455", items: [{ item: "Campera", quantity: 2, description: "negra y gris" }], deposit: 12000, daysAgo: 7, status: "entregado", paid: 12000 },
    { name: "Ana Giménez", phone: "3471 401122", items: [{ item: "Almohada", quantity: 2 }], deposit: 0, daysAgo: 6, status: "entregado", paid: 24000 },
    { name: "Rosa Benítez", phone: "3471 405566", items: [{ item: "Ropa por kg", quantity: 3 }, { item: "Campera", quantity: 1 }], deposit: 10000, daysAgo: 5, status: "listo" },
    { name: "Marta Quiroga", phone: "3471 406677", items: [{ item: "Acolchado 2 plazas", quantity: 1, description: "floreado", unitPrice: 20000 }], deposit: 0, daysAgo: 4, status: "listo" },
    { name: "Diego Paz", phone: "3471 407788", items: [{ item: "Ropa por kg", quantity: 8 }], deposit: 15000, daysAgo: 2, status: "lavando" },
    { name: "Laura Medina", phone: "3471 408899", items: [{ item: "Acolchado 1 plaza", quantity: 2, description: "rosa" }], deposit: 15000, daysAgo: 1, status: "lavando" },
    { name: "Sergio Luna", phone: "3471 409900", items: [{ item: "Acolchado plumón", quantity: 1 }, { item: "Almohada", quantity: 1 }], deposit: 20000, daysAgo: 0, status: "recibido" },
  ];

  for (const d of demo) {
    const order = await createOrder({
      client: { name: d.name, phone: d.phone },
      items: d.items.map((i) => ({ priceItemId: id(i.item), quantity: i.quantity, description: i.description, unitPrice: i.unitPrice })),
      deposit: d.deposit,
      source: "panel",
    });
    const received = new Date(Date.now() - d.daysAgo * DAY - 2 * 3600_000);
    const ready = new Date(received.getTime() + 2 * DAY);
    const delivered = new Date(Math.min(ready.getTime() + DAY, Date.now()));
    await db
      .update(orders)
      .set({
        status: d.status,
        receivedAt: received,
        readyAt: d.status === "listo" || d.status === "entregado" ? ready : null,
        notifiedAt: d.status === "entregado" ? ready : null,
        deliveredAt: d.status === "entregado" ? delivered : null,
        paidOnPickup: d.paid ?? 0,
      })
      .where(eq(orders.id, order.id));
  }
  console.log(`✓ ${demo.length} órdenes de ejemplo cargadas`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

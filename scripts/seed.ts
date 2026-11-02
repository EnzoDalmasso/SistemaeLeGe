// Carga inicial: lista de precios (de la foto del cartel) y los 4 usuarios.
// Uso: npm run db:seed   (no pisa datos existentes)
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const { db } = await import("../src/lib/db");
  const { priceItems, users } = await import("../src/lib/db/schema");

  const existingPrices = await db.select().from(priceItems).limit(1);
  if (!existingPrices.length) {
    await db.insert(priceItems).values([
      { category: "Acolchados", name: "Acolchado 1 plaza", priceMin: 15000, priceMax: 17000, keywords: "acolchado 1p, 1 plaza, una plaza, 1 1/2", sortOrder: 1 },
      { category: "Acolchados", name: "Acolchado 2 plazas", priceMin: 18000, priceMax: 20000, keywords: "acolchado 2p, 2 plazas, dos plazas, matrimonial", sortOrder: 2 },
      { category: "Acolchados", name: "Acolchado plumón", priceMin: 23000, keywords: "plumon, plumón, pluma", sortOrder: 3 },
      { category: "Ropa", name: "Ropa por kg", unit: "kg", priceMin: 3500, minCharge: 12000, minChargeUpToKg: 3, keywords: "ropa, kilo, kg, bolsa", sortOrder: 4 },
      { category: "Ropa", name: "Campera", priceMin: 12000, keywords: "campera, camperon, abrigo", sortOrder: 5 },
      { category: "Ropa", name: "Almohada", priceMin: 12000, keywords: "almohada", sortOrder: 6 },
    ]);
    console.log("✓ Lista de precios cargada");
  }

  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8) throw new Error("Definí SEED_PASSWORD (mínimo 8 caracteres)");
  const hash = await bcrypt.hash(password, 10);
  const seedUsers = [
    { username: "admin", name: "Administración", role: "admin" as const },
    { username: "empleado1", name: "Empleado 1", role: "empleado" as const },
    { username: "empleado2", name: "Empleado 2", role: "empleado" as const },
    { username: "empleado3", name: "Empleado 3", role: "empleado" as const },
  ];
  const inserted = await db
    .insert(users)
    .values(seedUsers.map((u) => ({ ...u, passwordHash: hash })))
    .onConflictDoNothing({ target: users.username })
    .returning({ username: users.username });
  if (inserted.length) console.log(`✓ Usuarios creados: ${inserted.map((u) => u.username).join(", ")} (contraseña = SEED_PASSWORD)`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

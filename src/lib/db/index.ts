import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable DATABASE_URL");
  // prepare: false es necesario detrás del pooler de Neon (modo transacción).
  return drizzle(postgres(url, { max: 5, prepare: false }), { schema });
}

type Db = ReturnType<typeof createDb>;
const globalForDb = globalThis as unknown as { db?: Db };

// La conexión se crea recién en la primera consulta: así `next build` no necesita la base.
export const db = new Proxy({} as Db, {
  get(_, prop) {
    globalForDb.db ??= createDb();
    const value = Reflect.get(globalForDb.db, prop, globalForDb.db);
    return typeof value === "function" ? value.bind(globalForDb.db) : value;
  },
});

export { schema };

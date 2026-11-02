import { inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./db/schema";

export const DEFAULT_SETTINGS = {
  business_name: "Lavadero eLeGe",
  business_phone: "3471-687792",
  ready_template:
    "¡Hola {nombre}! 👋 Tu pedido {ticket} en {negocio} ya está listo para retirar.\n{saldo}\nRecordá: pasados 30 días del primer aviso se pierde todo derecho a reclamo.",
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings(keys: SettingKey[] = Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const result = { ...DEFAULT_SETTINGS };
  for (const r of rows) result[r.key as SettingKey] = r.value;
  return result;
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>) {
  const entries = Object.entries(values).filter(([k]) => k in DEFAULT_SETTINGS);
  if (!entries.length) return;
  await db
    .insert(settings)
    .values(entries.map(([key, value]) => ({ key, value: value ?? "" })))
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value` } });
}

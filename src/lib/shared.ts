import { z } from "zod";
import { users } from "./db/schema";

export const priceSchema = z.object({
  category: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  unit: z.enum(["unidad", "kg"]),
  priceMin: z.number().int().nonnegative(),
  priceMax: z.number().int().nonnegative().nullable().optional(),
  minCharge: z.number().int().nonnegative().nullable().optional(),
  minChargeUpToKg: z.number().nonnegative().nullable().optional(),
  keywords: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Columnas de usuario que se pueden mandar al panel (nunca el hash). */
export const publicUser = {
  id: users.id,
  username: users.username,
  name: users.name,
  role: users.role,
  active: users.active,
  linkCode: users.linkCode,
  telegramChatId: users.telegramChatId,
};

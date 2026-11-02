import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { HttpError, idParam, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { publicUser } from "@/lib/shared";

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  role: z.enum(["admin", "empleado"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "mínimo 8 caracteres").max(100).optional(),
  newLinkCode: z.literal(true).optional(),
  unlinkTelegram: z.literal(true).optional(),
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(
  async (req, { params }, me) => {
    const id = idParam((await params).id);
    const body = await parseBody(req, schema);
    if (id === me.id && (body.active === false || body.role === "empleado")) {
      throw new HttpError(400, "No podés quitarte el acceso de administrador a vos mismo");
    }
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.name) set.name = body.name;
    if (body.role) set.role = body.role;
    if (body.active !== undefined) set.active = body.active;
    if (body.password) set.passwordHash = await bcrypt.hash(body.password, 10);
    if (body.newLinkCode) set.linkCode = String(randomInt(100000, 1000000));
    if (body.unlinkTelegram) set.telegramChatId = null;
    const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning(publicUser);
    if (!updated) throw new HttpError(404, "Usuario no encontrado");
    return updated;
  },
  { admin: true },
);

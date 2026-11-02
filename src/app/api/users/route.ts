import bcrypt from "bcryptjs";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { publicUser } from "@/lib/shared";

export const GET = route(async () => db.select(publicUser).from(users).orderBy(asc(users.id)), { admin: true });

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "solo letras, números y . _ -"),
  name: z.string().trim().min(2).max(60),
  role: z.enum(["admin", "empleado"]),
  password: z.string().min(8, "mínimo 8 caracteres").max(100),
});

export const POST = route(
  async (req) => {
    const { password, ...body } = await parseBody(req, schema);
    const [created] = await db
      .insert(users)
      .values({ ...body, passwordHash: await bcrypt.hash(password, 10) })
      .returning(publicUser);
    return created;
  },
  { admin: true },
);

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, HttpError, parseBody } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const schema = z.object({ username: z.string().trim().toLowerCase().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { username, password } = await parseBody(req, schema);
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    const ok = user?.active && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
      await new Promise((r) => setTimeout(r, 600)); // frena intentos de fuerza bruta
      throw new HttpError(401, "Usuario o contraseña incorrectos");
    }
    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  } catch (e) {
    return errorResponse(e);
  }
}

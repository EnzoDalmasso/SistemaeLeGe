import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

export const SESSION_COOKIE = "elege_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = { id: number; name: string; username: string; role: "admin" | "empleado" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET falta o es muy corta");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Lee la sesión y vuelve a consultar el usuario, así un usuario desactivado pierde acceso al instante. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const user = await db.query.users.findFirst({ where: eq(users.id, Number(payload.sub)) });
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, username: user.username, role: user.role };
  } catch {
    return null;
  }
}

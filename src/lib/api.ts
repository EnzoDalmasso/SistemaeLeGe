import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, type SessionUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C, user: SessionUser) => Promise<Response | unknown>;

/** Envuelve un route handler: exige sesión (y rol admin si se pide) y traduce errores a JSON. */
export function route<C = unknown>(handler: Handler<C>, opts: { admin?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    // Fuera del try: en el build, Next corta acá el prerender y la ruta queda dinámica.
    await connection();
    try {
      const user = await getSessionUser();
      if (!user) throw new HttpError(401, "No autenticado");
      if (opts.admin && user.role !== "admin") throw new HttpError(403, "Solo el administrador puede hacer esto");
      const result = await handler(req, ctx, user);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    return NextResponse.json({ error: `Dato inválido: ${first.path.join(".")} ${first.message}` }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
  return schema.parse(json);
}

export function idParam(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Id inválido");
  return id;
}

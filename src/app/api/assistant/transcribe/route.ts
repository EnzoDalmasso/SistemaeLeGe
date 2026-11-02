import { eq } from "drizzle-orm";
import { transcribe } from "@/lib/ai";
import { HttpError, route } from "@/lib/api";
import { db } from "@/lib/db";
import { priceItems } from "@/lib/db/schema";

export const maxDuration = 60;

/** Transcribe un audio grabado desde el panel (celular o PC). */
export const POST = route(async (req) => {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "No llegó el audio");
  if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "El audio es demasiado largo");
  const prices = await db.select({ name: priceItems.name }).from(priceItems).where(eq(priceItems.active, true));
  try {
    return { text: await transcribe(await file.arrayBuffer(), file.name || "audio.webm", prices.map((p) => p.name).join(", ")) };
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "No se pudo transcribir");
  }
});

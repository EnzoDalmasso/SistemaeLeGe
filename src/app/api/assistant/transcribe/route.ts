import { transcribe } from "@/lib/ai";
import { HttpError, route } from "@/lib/api";

export const maxDuration = 60;

/** Transcribe un audio grabado desde el panel (celular o PC). */
export const POST = route(async (req) => {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "No llegó el audio");
  if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "El audio es demasiado largo");
  try {
    return { text: await transcribe(await file.arrayBuffer(), file.name || "audio.webm") };
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "No se pudo transcribir");
  }
});

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleUpdate, type TgUpdate } from "@/lib/bot";

export const maxDuration = 60;

function validSecret(header: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!validSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await handleUpdate((await req.json()) as TgUpdate);
  } catch (e) {
    // Respondemos 200 igual: si no, Telegram reintenta el mismo mensaje en loop.
    console.error("Error procesando update de Telegram", e);
  }
  return NextResponse.json({ ok: true });
}

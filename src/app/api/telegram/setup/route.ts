import { HttpError, route } from "@/lib/api";
import { telegramEnabled, tg } from "@/lib/telegram";

const COMMANDS = [
  { command: "pendientes", description: "Órdenes listas sin retirar" },
  { command: "buscar", description: "Buscar órdenes de un cliente" },
  { command: "listo", description: "Marcar orden lista y avisar (ej: /listo 12)" },
  { command: "entregado", description: "Marcar orden retirada (ej: /entregado 12)" },
  { command: "ayuda", description: "Cómo usar el bot" },
];

export const GET = route(async () => {
  if (!telegramEnabled()) return { enabled: false };
  return { enabled: true, webhook: await tg("getWebhookInfo") };
}, { admin: true });

/** Registra el webhook apuntando a este mismo deploy (se usa una vez después de publicar en Vercel). */
export const POST = route(async (req) => {
  if (!telegramEnabled()) throw new HttpError(400, "Falta configurar TELEGRAM_BOT_TOKEN");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(400, "Falta configurar TELEGRAM_WEBHOOK_SECRET");
  const origin = new URL(req.url).origin;
  if (!origin.startsWith("https://")) throw new HttpError(400, "Telegram exige HTTPS: en local usá npm run bot:poll");
  const url = `${origin}/api/telegram/webhook`;
  await tg("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  await tg("setMyCommands", { commands: COMMANDS });
  return { ok: true, url };
}, { admin: true });

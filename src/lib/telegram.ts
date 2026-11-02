// Cliente mínimo de la Bot API de Telegram (sin dependencias).

const API = "https://api.telegram.org";

export function telegramEnabled() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return t;
}

export async function tg<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  return data.result;
}

export type InlineButton = { text: string; callback_data?: string; url?: string };

export function sendMessage(chatId: number, text: string, buttons?: InlineButton[][]) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function downloadFile(fileId: string): Promise<{ data: ArrayBuffer; path: string }> {
  const file = await tg<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
  if (!res.ok) throw new Error(`No se pudo descargar el archivo de Telegram (${res.status})`);
  return { data: await res.arrayBuffer(), path: file.file_path };
}

let cachedUsername: string | null = null;
export async function botUsername() {
  if (!cachedUsername) cachedUsername = (await tg<{ username: string }>("getMe")).username;
  return cachedUsername;
}

/** Link que el cliente abre para vincular su chat y recibir el aviso de "listo". */
export async function clientLink(linkToken: string) {
  return `https://t.me/${await botUsername()}?start=c_${linkToken}`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

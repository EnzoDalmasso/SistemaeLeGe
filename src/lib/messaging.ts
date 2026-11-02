import { db } from "./db";
import { notifications, type Client } from "./db/schema";
import { sendMessage, telegramEnabled } from "./telegram";

/**
 * Canal por el que se avisa al cliente. Para la demo solo existe Telegram;
 * al aprobar el presupuesto se agrega WhatsAppCloudChannel (API oficial de Meta)
 * implementando esta misma interfaz, sin tocar el resto del sistema.
 */
interface Channel {
  name: string;
  canSend(client: Client): boolean;
  send(client: Client, text: string): Promise<string>; // devuelve el destinatario
}

const telegramChannel: Channel = {
  name: "telegram",
  canSend: (c) => telegramEnabled() && Boolean(c.telegramChatId),
  async send(c, text) {
    await sendMessage(c.telegramChatId!, text);
    return String(c.telegramChatId);
  },
};

const channels: Channel[] = [telegramChannel];

export type SendResult = { status: "enviado" | "pendiente" | "error"; channel: string; error?: string };

export async function sendToClient(client: Client, text: string, orderId?: number): Promise<SendResult> {
  const channel = channels.find((c) => c.canSend(client));
  let result: SendResult;
  let recipient: string | null = client.phone;

  if (!channel) {
    // Sin canal automático: queda pendiente y el panel ofrece enviarlo por WhatsApp con un toque.
    result = { status: "pendiente", channel: "whatsapp-manual", error: "Cliente sin canal automático vinculado" };
  } else {
    try {
      recipient = await channel.send(client, text);
      result = { status: "enviado", channel: channel.name };
    } catch (e) {
      result = { status: "error", channel: channel.name, error: e instanceof Error ? e.message : String(e) };
    }
  }

  await db.insert(notifications).values({
    orderId,
    clientId: client.id,
    channel: result.channel,
    recipient,
    body: text,
    status: result.status,
    error: result.error,
  });
  return result;
}

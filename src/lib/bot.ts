import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { interpret, transcribe } from "./ai";
import { db } from "./db";
import { botDrafts, clients, orders, priceItems, telegramUpdates, users, type User } from "./db/schema";
import { balance, itemLabel, money, normalizePhone, STATUS_LABELS, ticket } from "./format";
import { audioHint, changeStatus, computeLines, createOrder, getOrder, matchClient } from "./orders";
import type { ParsedMessage } from "./parser";
import { depositProblem } from "./pricing";
import { clientLink, downloadFile, escapeHtml as h, sendMessage, tg } from "./telegram";

type TgChat = { id: number; type: string; first_name?: string };
type TgMessage = {
  message_id: number;
  chat: TgChat;
  text?: string;
  caption?: string;
  voice?: { file_id: string; duration: number };
  audio?: { file_id: string; file_name?: string };
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; data?: string; message?: TgMessage; from: { id: number } };
};

type DraftPayload = {
  clientName: string | null;
  phone: string | null;
  items: ParsedMessage["items"];
  deposit: number;
  paidInFull?: boolean;
  notes: string | null;
  rawMessage: string;
};

const HELP = `<b>Bot del Lavadero eLeGe</b>
Mandá un <b>audio o mensaje</b> con los datos de la ropa que dejan, por ejemplo:
<i>"Ana Pérez, 3471 555123, un acolchado de 1 plaza negro y gris y 4 kilos de ropa, dejó 10 mil de seña"</i>
Siempre decí la <b>seña</b> o que <b>paga todo</b>: sin eso no se crea la orden.

También podés decir <i>"la orden 12 está lista"</i> (se le avisa al cliente) o <i>"la orden 12 la retiró y pagó 15 mil"</i>.

Comandos:
/pendientes – órdenes listas sin retirar
/buscar nombre – últimas órdenes de un cliente
/listo 12 – marcar orden lista y avisar
/entregado 12 – marcar retirada (cobra el saldo)`;

/** Procesa un update de Telegram. Idempotente: Telegram reintenta si no respondemos 200. */
export async function handleUpdate(update: TgUpdate) {
  const fresh = await db.insert(telegramUpdates).values({ updateId: update.update_id }).onConflictDoNothing().returning();
  if (!fresh.length) return;

  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? msg.caption ?? "").trim();

  if (text.startsWith("/start c_")) return linkClient(chatId, text.slice("/start c_".length).trim());
  if (text.startsWith("/vincular")) return linkStaff(chatId, text.split(/\s+/)[1] ?? "");

  const staff = await db.query.users.findFirst({ where: and(eq(users.telegramChatId, chatId), eq(users.active, true)) });
  if (!staff) {
    const linked = await db.query.clients.findFirst({ where: eq(clients.telegramChatId, chatId) });
    return sendMessage(
      chatId,
      linked
        ? `Hola ${h(linked.name.split(" ")[0])} 👋 Por acá te vamos a avisar cuando tu ropa esté lista. Para consultas llamá al 3471-687792.`
        : "Hola 👋 Este es el canal de avisos del Lavadero eLeGe. Si sos parte del equipo, vinculá tu cuenta con <code>/vincular CÓDIGO</code> (el código está en el panel → Configuración).",
    );
  }

  try {
    await handleStaffMessage(staff, msg, text);
  } catch (e) {
    console.error(e);
    await sendMessage(chatId, `❌ ${h(e instanceof Error ? e.message : "Error inesperado")}`);
  }
}

async function handleStaffMessage(staff: User, msg: TgMessage, text: string) {
  const chatId = msg.chat.id;
  if (text === "/start" || text === "/ayuda" || text === "/help") return sendMessage(chatId, HELP);
  if (text === "/pendientes") return sendPending(chatId);
  if (text.startsWith("/buscar")) return sendSearch(chatId, text.replace("/buscar", "").trim());

  const cmd = text.match(/^\/(listo|entregado)\s+#?(\d+)(?:\s+([\d.]+))?/);
  if (cmd) {
    const id = Number(cmd[2]);
    if (cmd[1] === "listo") return markReady(chatId, id);
    return markDelivered(chatId, id, cmd[3] ? Number(cmd[3].replace(/\./g, "")) : null);
  }

  const prices = await db.select().from(priceItems).where(eq(priceItems.active, true));
  let content = text;
  const voice = msg.voice ?? msg.audio;
  if (voice) {
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    const file = await downloadFile(voice.file_id);
    content = await transcribe(file.data, file.path.split("/").pop() || "audio.ogg", await audioHint());
    await sendMessage(chatId, `🎙️ <i>${h(content)}</i>`);
  }
  if (!content) return sendMessage(chatId, HELP);

  const parsed = await interpret(content, prices);

  if (parsed.intent === "marcar_listo" && parsed.orderId) return markReady(chatId, parsed.orderId);
  if (parsed.intent === "marcar_entregado" && parsed.orderId) return markDelivered(chatId, parsed.orderId, parsed.paidAmount);
  if (parsed.intent !== "nueva_orden" || (!parsed.items.length && !parsed.clientName)) {
    return sendMessage(chatId, `No entendí qué hacer con ese mensaje 🤔\n\n${HELP}`);
  }

  const payload: DraftPayload = {
    clientName: parsed.clientName,
    phone: parsed.phone,
    items: parsed.items,
    deposit: parsed.deposit,
    paidInFull: parsed.paidInFull,
    notes: parsed.notes,
    rawMessage: content,
  };
  const [draft] = await db.insert(botDrafts).values({ chatId, userId: staff.id, payload }).returning();
  const { text: summary, problem } = await draftSummary(payload);
  const missing = !payload.clientName || !payload.items.length ? "Falta el nombre del cliente o las prendas" : problem;
  const canConfirm = !missing;
  await sendMessage(
    chatId,
    summary + (missing ? `\n\n⚠️ ${h(missing)}. Mandá el mensaje de nuevo completo (ej: <i>"…, seña 10 mil"</i> o <i>"…, paga todo"</i>).` : ""),
    canConfirm
      ? [[{ text: "✅ Confirmar", callback_data: `ok:${draft.id}` }, { text: "❌ Cancelar", callback_data: `no:${draft.id}` }]]
      : undefined,
  );
}

async function draftSummary(p: DraftPayload) {
  const lines = await computeLines(p.items.map((i) => ({ ...i })));
  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const deposit = p.paidInFull ? total : p.deposit;
  const phone = normalizePhone(p.phone);
  // Se muestra como está cargado ("Dalmasso" aunque el audio diga "Dalmazo"): es el cliente al que va la orden.
  const existing = await matchClient(p.clientName, phone);
  const out = [
    "<b>📝 Nueva orden</b>",
    `👤 ${h(existing?.name ?? p.clientName ?? "¿Nombre?")}${existing ? " <i>(cliente existente)</i>" : ""}`,
    `📞 ${h(phone ?? existing?.phone ?? "sin teléfono")}`,
    "",
    ...lines.map((l) => `• ${h(itemLabel(l))} — ${money(l.subtotal)}${l.unitPrice === 0 ? " ⚠️ sin precio" : ""}`),
    "",
    `<b>Importe: ${money(total)}</b>`,
    p.paidInFull ? "✅ Pagó todo" : `Seña: ${money(deposit)} · Saldo: ${money(total - deposit)}`,
  ];
  if (p.notes) out.push(`📌 ${h(p.notes)}`);
  return { text: out.join("\n"), problem: depositProblem(total, deposit) };
}

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>) {
  const [action, rawId] = (cb.data ?? "").split(":");
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const staff = await db.query.users.findFirst({ where: and(eq(users.telegramChatId, chatId), eq(users.active, true)) });
  const draft = await db.query.botDrafts.findFirst({ where: and(eq(botDrafts.id, Number(rawId)), eq(botDrafts.chatId, chatId)) });

  if (!staff || !draft || draft.status !== "pendiente") {
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Este borrador ya no está disponible" });
    return;
  }
  const clearButtons = () =>
    cb.message && tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });

  if (action === "no") {
    await db.update(botDrafts).set({ status: "cancelado" }).where(eq(botDrafts.id, draft.id));
    await Promise.all([tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Cancelado" }), clearButtons()]);
    return;
  }

  const p = draft.payload as DraftPayload;
  const order = await createOrder({
    client: { name: p.clientName, phone: p.phone },
    items: p.items,
    deposit: p.deposit,
    paidInFull: p.paidInFull,
    notes: p.notes,
    source: "telegram",
    rawMessage: p.rawMessage,
    createdById: staff.id,
  });
  await db.update(botDrafts).set({ status: "confirmado" }).where(eq(botDrafts.id, draft.id));
  await Promise.all([tg("answerCallbackQuery", { callback_query_id: cb.id, text: `Orden ${ticket(order.id)} creada` }), clearButtons()]);

  const link = await clientLink(order.client.linkToken);
  await sendMessage(
    chatId,
    `✅ Orden <b>${ticket(order.id)}</b> creada para ${h(order.client.name)} — ${money(order.total)}.\n\n` +
      `Reenviale este mensaje al cliente para que reciba el aviso cuando esté lista 👇`,
  );
  await sendMessage(
    chatId,
    `Hola ${h(order.client.name.split(" ")[0])}! Dejaste tu ropa en Lavadero eLeGe (orden ${ticket(order.id)}). ` +
      `Tocá este link y apretá «Iniciar» para que te avisemos cuando esté lista: ${link}`,
  );
}

async function markReady(chatId: number, id: number) {
  const { order, notification } = await changeStatus(id, { status: "listo" });
  const sent = notification?.status === "enviado";
  return sendMessage(
    chatId,
    `🧺 Orden <b>${ticket(order.id)}</b> (${h(order.client.name)}) marcada como <b>lista</b>.\n` +
      (sent ? "📲 Se le avisó al cliente." : notification ? "⚠️ El cliente no tiene el aviso vinculado: mandale el WhatsApp desde el panel." : ""),
  );
}

async function markDelivered(chatId: number, id: number, paid: number | null) {
  const current = await getOrder(id);
  const due = balance(current);
  const { order } = await changeStatus(id, { status: "entregado", paidOnPickup: paid ?? due });
  return sendMessage(
    chatId,
    `📦 Orden <b>${ticket(order.id)}</b> entregada a ${h(order.client.name)}. ` +
      (order.paidOnPickup > 0 ? `Abonó ${money(order.paidOnPickup)}.` : "Ya estaba todo pagado.") +
      (balance(order) > 0 ? `\n⚠️ Queda debiendo ${money(balance(order))}.` : ""),
  );
}

async function sendPending(chatId: number) {
  const rows = await db.query.orders.findMany({
    where: eq(orders.status, "listo"),
    with: { client: true },
    orderBy: (o, { asc }) => asc(o.readyAt),
    limit: 30,
  });
  if (!rows.length) return sendMessage(chatId, "No hay órdenes listas esperando retiro 🎉");
  return sendMessage(
    chatId,
    "<b>Listas para retirar</b>\n" + rows.map((o) => `${ticket(o.id)} · ${h(o.client.name)} · saldo ${money(balance(o))}`).join("\n"),
  );
}

async function sendSearch(chatId: number, q: string) {
  if (!q) return sendMessage(chatId, "Usá: /buscar nombre o teléfono");
  const phone = normalizePhone(q);
  const found = await db
    .select({ id: clients.id })
    .from(clients)
    .where(phone ? eq(clients.phone, phone) : ilike(clients.name, `%${q}%`))
    .limit(10);
  if (!found.length) return sendMessage(chatId, "No encontré clientes con ese dato.");
  const rows = await db.query.orders.findMany({
    where: inArray(orders.clientId, found.map((c) => c.id)),
    with: { client: true },
    orderBy: desc(orders.receivedAt),
    limit: 10,
  });
  return sendMessage(
    chatId,
    rows.length
      ? rows.map((o) => `${ticket(o.id)} · ${h(o.client.name)} · ${STATUS_LABELS[o.status]} · ${money(o.total)}`).join("\n")
      : "El cliente no tiene órdenes.",
  );
}

async function linkClient(chatId: number, token: string) {
  const [client] = await db.update(clients).set({ telegramChatId: chatId }).where(eq(clients.linkToken, token)).returning();
  if (!client) return sendMessage(chatId, "El link no es válido. Pedile uno nuevo al lavadero.");
  return sendMessage(chatId, `¡Listo, ${h(client.name.split(" ")[0])}! ✅ Te vamos a avisar por acá cuando tu ropa esté lista para retirar.`);
}

async function linkStaff(chatId: number, code: string) {
  if (!/^\d{6}$/.test(code)) return sendMessage(chatId, "Usá: /vincular 123456 (el código está en el panel → Configuración)");
  const valid = await db.query.users.findFirst({ where: and(eq(users.linkCode, code), eq(users.active, true)) });
  if (!valid) return sendMessage(chatId, "Código inválido o ya usado.");
  await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, chatId));
  const [user] = await db
    .update(users)
    .set({ telegramChatId: chatId, linkCode: null })
    .where(and(eq(users.linkCode, code), eq(users.active, true)))
    .returning();
  if (!user) return sendMessage(chatId, "Código inválido o ya usado.");
  return sendMessage(chatId, `✅ Hola ${h(user.name)}, tu Telegram quedó vinculado.\n\n${HELP}`);
}

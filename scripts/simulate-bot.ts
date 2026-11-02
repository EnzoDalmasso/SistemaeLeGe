// Simula conversaciones con el bot sin Telegram real: intercepta fetch y muestra lo que respondería.
// Uso: npm run bot:simulate   (solo contra la base LOCAL: crea una orden y vincula chats ficticios)
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.TELEGRAM_BOT_TOKEN = "SIMULADO";

const sent: { method: string; body: Record<string, unknown> }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.telegram.org/")) return realFetch(input, init);
  const method = url.split("/").pop()!;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  sent.push({ method, body });
  const result = method === "getMe" ? { username: "elege_demo_bot" } : method === "sendMessage" ? { message_id: 99 } : true;
  return new Response(JSON.stringify({ ok: true, result }));
}) as typeof fetch;

async function main() {
  const { handleUpdate } = await import("../src/lib/bot");
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(users).set({ linkCode: "123456", telegramChatId: null }).where(eq(users.username, "empleado1"));
  let updateId = Date.now();
  const STAFF = 9001;
  const CLIENT = 9002;
  const msg = (chatId: number, text: string) => ({ update_id: updateId++, message: { message_id: 1, chat: { id: chatId, type: "private" }, text } });
  const show = (label: string) => {
    console.log(`\n=== ${label}`);
    for (const s of sent.splice(0)) {
      if (s.method === "sendMessage") {
        console.log(`→ [${s.body.chat_id}] ${String(s.body.text).replace(/<[^>]+>/g, "")}`);
        const kb = (s.body.reply_markup as { inline_keyboard?: { text: string; callback_data?: string }[][] })?.inline_keyboard;
        if (kb?.length) console.log("   botones:", kb.flat().map((b) => `${b.text} (${b.callback_data})`).join(" | "));
      } else console.log(`→ ${s.method}`);
    }
  };

  await handleUpdate(msg(STAFF, "hola"));
  show("Desconocido escribe");
  await handleUpdate(msg(STAFF, "/vincular 123456"));
  show("Empleado se vincula");
  await handleUpdate(msg(STAFF, "Pedro Álvarez 3471 556677, 2 acolchados de 2 plazas y 5 kilos de ropa, deja 10 mil de seña"));
  show("Empleado manda una orden");

  const draft = await db.query.botDrafts.findFirst({ orderBy: (d, { desc }) => desc(d.id) });
  await handleUpdate({ update_id: updateId++, callback_query: { id: "cb1", data: `ok:${draft!.id}`, from: { id: STAFF }, message: { message_id: 5, chat: { id: STAFF, type: "private" } } } });
  show("Empleado confirma");

  const order = await db.query.orders.findFirst({ orderBy: (o, { desc }) => desc(o.id), with: { client: true } });
  await handleUpdate(msg(CLIENT, `/start c_${order!.client.linkToken}`));
  show("Cliente abre el link");
  await handleUpdate(msg(STAFF, `La orden ${order!.id} ya está lista`));
  show("Empleado avisa que está lista (debe llegarle al cliente)");
  await handleUpdate(msg(STAFF, "/pendientes"));
  show("Pendientes");
  await handleUpdate(msg(STAFF, `/entregado ${order!.id}`));
  show("Entregada");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

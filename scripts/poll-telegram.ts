// Bot de Telegram en modo local (sin webhook, sin HTTPS). Uso: npm run bot:poll
// En Vercel no se usa: allá Telegram llama a /api/telegram/webhook.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { tg } = await import("../src/lib/telegram");
  const { handleUpdate } = await import("../src/lib/bot");
  type Update = Parameters<typeof handleUpdate>[0];

  await tg("deleteWebhook", { drop_pending_updates: false });
  const me = await tg<{ username: string }>("getMe");
  console.log(`🤖 Bot @${me.username} escuchando (Ctrl+C para salir)`);

  let offset = 0;
  for (;;) {
    try {
      const updates = await tg<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        console.log("←", u.message?.text ?? (u.message?.voice ? "[audio]" : u.callback_query?.data ?? "[otro]"));
        await handleUpdate(u).catch((e) => console.error("Error:", e));
      }
    } catch (e) {
      console.error(e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();

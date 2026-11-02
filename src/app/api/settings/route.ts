import { z } from "zod";
import { aiEnabled } from "@/lib/ai";
import { parseBody, route } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";
import { botUsername, telegramEnabled } from "@/lib/telegram";

export const GET = route(async () => ({
  settings: await getSettings(),
  integrations: {
    telegram: telegramEnabled(),
    botUsername: telegramEnabled() ? await botUsername().catch(() => null) : null,
    ai: aiEnabled(),
    aiProvider: process.env.AI_BASE_URL?.includes("groq") ? "Groq (gratis)" : process.env.AI_BASE_URL ? "OpenAI" : null,
  },
}));

const schema = z.object({
  business_name: z.string().trim().min(1).max(80).optional(),
  business_phone: z.string().trim().max(40).optional(),
  ready_template: z.string().trim().min(10).max(1000).optional(),
});

export const PUT = route(
  async (req) => {
    await saveSettings(await parseBody(req, schema));
    return { settings: await getSettings() };
  },
  { admin: true },
);

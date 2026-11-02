import { asc } from "drizzle-orm";
import { parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { priceItems } from "@/lib/db/schema";
import { priceSchema } from "@/lib/shared";

export const GET = route(async () => db.select().from(priceItems).orderBy(asc(priceItems.sortOrder), asc(priceItems.id)));

export const POST = route(
  async (req) => {
    const body = await parseBody(req, priceSchema);
    const [created] = await db.insert(priceItems).values(body).returning();
    return created;
  },
  { admin: true },
);

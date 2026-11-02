import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "empleado"] }).notNull().default("empleado"),
  telegramChatId: bigint("telegram_chat_id", { mode: "number" }).unique(),
  linkCode: text("link_code"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }),
    linkToken: text("link_token").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("clients_phone_idx").on(t.phone), index("clients_name_idx").on(t.name)],
);

export const priceItems = pgTable("price_items", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  unit: text("unit", { enum: ["unidad", "kg"] }).notNull().default("unidad"),
  priceMin: integer("price_min").notNull(),
  priceMax: integer("price_max"),
  minCharge: integer("min_charge"),
  minChargeUpToKg: numeric("min_charge_up_to_kg", { mode: "number" }),
  keywords: text("keywords"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const ORDER_STATUSES = ["recibido", "lavando", "listo", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("recibido"),
    total: integer("total").notNull().default(0),
    deposit: integer("deposit").notNull().default(0),
    paidOnPickup: integer("paid_on_pickup").notNull().default(0),
    notes: text("notes"),
    source: text("source", { enum: ["panel", "telegram", "whatsapp"] }).notNull().default("panel"),
    rawMessage: text("raw_message"),
    createdById: integer("created_by_id").references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_client_idx").on(t.clientId),
    index("orders_status_idx").on(t.status),
    index("orders_received_idx").on(t.receivedAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    priceItemId: integer("price_item_id").references(() => priceItems.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { mode: "number" }).notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  channel: text("channel").notNull(),
  recipient: text("recipient"),
  body: text("body").notNull(),
  status: text("status", { enum: ["enviado", "pendiente", "error"] }).notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const botDrafts = pgTable("bot_drafts", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["pendiente", "confirmado", "cancelado"] }).notNull().default("pendiente"),
  createdAt: createdAt(),
});

export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const clientsRelations = relations(clients, ({ many }) => ({ orders: many(orders) }));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  createdBy: one(users, { fields: [orders.createdById], references: [users.id] }),
  items: many(orderItems),
  notifications: many(notifications),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  order: one(orders, { fields: [notifications.orderId], references: [orders.id] }),
}));

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type PriceItem = typeof priceItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

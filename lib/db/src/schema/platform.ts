import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const platformSettings = pgTable("platform_settings", {
  ownerUserId: varchar("owner_user_id", { length: 128 }).primaryKey(),
  executionMode: varchar("execution_mode", { length: 16 }).notNull().default("paper"),
  testnetEnabled: boolean("testnet_enabled").notNull().default(false),
  riskPerTradePct: numeric("risk_per_trade_pct", { precision: 8, scale: 4 }).notNull().default("0.5"),
  maxExposurePct: numeric("max_exposure_pct", { precision: 8, scale: 4 }).notNull().default("20"),
  maxOpenPositions: integer("max_open_positions").notNull().default(2),
  maxDailyTrades: integer("max_daily_trades").notNull().default(3),
  maxDailyLossPct: numeric("max_daily_loss_pct", { precision: 8, scale: 4 }).notNull().default("2"),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(1440),
  minRewardRisk: numeric("min_reward_risk", { precision: 8, scale: 4 }).notNull().default("1.5"),
  paperStartingBalance: numeric("paper_starting_balance", { precision: 20, scale: 8 }).notNull().default("10000"),
  killSwitchActive: boolean("kill_switch_active").notNull().default(false),
  killSwitchReason: text("kill_switch_reason"),
  telegramChatId: varchar("telegram_chat_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeRecords = pgTable(
  "trade_records",
  {
    id: serial("id").primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
    signalId: integer("signal_id"),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    side: varchar("side", { length: 8 }).notNull().default("LONG"),
    status: varchar("status", { length: 16 }).notNull().default("OPEN"),
    quantity: numeric("quantity", { precision: 28, scale: 12 }).notNull(),
    entryPrice: numeric("entry_price", { precision: 28, scale: 12 }).notNull(),
    stopLoss: numeric("stop_loss", { precision: 28, scale: 12 }).notNull(),
    takeProfit: numeric("take_profit", { precision: 28, scale: 12 }).notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 28, scale: 12 }).notNull().default("0"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("trade_records_owner_status_idx").on(table.ownerUserId, table.status),
    index("trade_records_owner_symbol_idx").on(table.ownerUserId, table.symbol),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
    tradeId: integer("trade_id"),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    side: varchar("side", { length: 8 }).notNull(),
    orderType: varchar("order_type", { length: 32 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("CREATED"),
    clientOrderId: varchar("client_order_id", { length: 64 }).notNull(),
    exchangeOrderId: varchar("exchange_order_id", { length: 64 }),
    quantity: numeric("quantity", { precision: 28, scale: 12 }).notNull(),
    price: numeric("price", { precision: 28, scale: 12 }),
    protectionOrder: boolean("protection_order").notNull().default(false),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("orders_owner_client_order_id_idx").on(table.ownerUserId, table.clientOrderId)],
);

export const fills = pgTable("fills", {
  id: serial("id").primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
  orderId: integer("order_id").notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  quantity: numeric("quantity", { precision: 28, scale: 12 }).notNull(),
  price: numeric("price", { precision: 28, scale: 12 }).notNull(),
  fee: numeric("fee", { precision: 28, scale: 12 }).notNull().default("0"),
  feeAsset: varchar("fee_asset", { length: 16 }).notNull(),
  filledAt: timestamp("filled_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riskEvents = pgTable("risk_events", {
  id: serial("id").primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 32 }),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 32 }),
  detail: text("detail").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings);
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;
export type TradeRecord = typeof tradeRecords.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Fill = typeof fills.$inferSelect;
export type RiskEvent = typeof riskEvents.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
import {
  pgTable, serial, varchar, integer, decimal, boolean, timestamp
} from "drizzle-orm/pg-core";

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  asset: varchar("asset", { length: 20 }).notNull(),
  timeframe: varchar("timeframe", { length: 10 }).notNull().default("1h"),
  direction: varchar("direction", { length: 10 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  tp: decimal("tp", { precision: 20, scale: 8 }),
  sl: decimal("sl", { precision: 20, scale: 8 }),
  score: integer("score").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  estimatedProbability: integer("estimated_probability").notNull().default(0),
  rsi: decimal("rsi", { precision: 8, scale: 4 }),
  macdHistogram: decimal("macd_histogram", { precision: 16, scale: 8 }),
  ema50: decimal("ema50", { precision: 20, scale: 8 }),
  ema100: decimal("ema100", { precision: 20, scale: 8 }),
  ema200: decimal("ema200", { precision: 20, scale: 8 }),
  atr: decimal("atr", { precision: 20, scale: 8 }),
  volumeRatio: decimal("volume_ratio", { precision: 8, scale: 4 }),
  trend: varchar("trend", { length: 50 }),
  momentum: varchar("momentum", { length: 50 }),
  volatility: varchar("volatility", { length: 50 }),
  confluence: integer("confluence").notNull().default(0),
  marketRegime: varchar("market_regime", { length: 50 }),
  verdict: varchar("verdict", { length: 20 }),
  falseSignalRisk: varchar("false_signal_risk", { length: 20 }),
  status: varchar("status", { length: 10 }).notNull().default("PENDING"),
  qualified: boolean("qualified").notNull().default(false),
  qualityTier: varchar("quality_tier", { length: 10 }),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
  profitPct: decimal("profit_pct", { precision: 10, scale: 4 }),
  maxProfitPct: decimal("max_profit_pct", { precision: 10, scale: 4 }),
  maxDrawdownPct: decimal("max_drawdown_pct", { precision: 10, scale: 4 }),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const qualityFilterSettings = pgTable("quality_filter_settings", {
  id: integer("id").primaryKey().default(1),
  minScore: integer("min_score").notNull().default(70),
  minConfidence: integer("min_confidence").notNull().default(60),
  minConfluence: integer("min_confluence").notNull().default(4),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;
export type QualityFilter = typeof qualityFilterSettings.$inferSelect;

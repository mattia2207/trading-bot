import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { evaluateLongRisk } from "./risk-engine.js";
import { createBroker } from "./broker.js";

export type ExecutionMode = "paper" | "testnet";

export interface PlatformSettings {
  riskPerTradePct: number;
  maxExposurePct: number;
  maxOpenPositions: number;
  maxDailyTrades: number;
  maxDailyLossPct: number;
  cooldownMinutes: number;
  minRewardRisk: number;
  paperStartingBalance: number;
  killSwitchActive: boolean;
  killSwitchReason: string | null;
  telegramChatId: string | null;
  executionMode: ExecutionMode;
  testnetEnabled: boolean;
  updatedAt: string;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function mapSettings(row: Record<string, unknown>): PlatformSettings {
  const executionMode: ExecutionMode = process.env.EXECUTION_MODE === "testnet"
    ? "testnet"
    : "paper";
  return {
    riskPerTradePct: numberValue(row.risk_per_trade_pct),
    maxExposurePct: numberValue(row.max_exposure_pct),
    maxOpenPositions: numberValue(row.max_open_positions),
    maxDailyTrades: numberValue(row.max_daily_trades),
    maxDailyLossPct: numberValue(row.max_daily_loss_pct),
    cooldownMinutes: numberValue(row.cooldown_minutes),
    minRewardRisk: numberValue(row.min_reward_risk),
    paperStartingBalance: numberValue(row.paper_starting_balance),
    killSwitchActive: Boolean(row.kill_switch_active),
    killSwitchReason: (row.kill_switch_reason as string | null) ?? null,
    telegramChatId: (row.telegram_chat_id as string | null) ?? null,
    executionMode,
    testnetEnabled: process.env.TESTNET_ENABLED === "true",
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function getSettings(ownerUserId: string): Promise<PlatformSettings> {
  await pool.query(
    `INSERT INTO platform_settings (owner_user_id)
     VALUES ($1)
     ON CONFLICT (owner_user_id) DO NOTHING`,
    [ownerUserId],
  );
  const result = await pool.query(
    "SELECT * FROM platform_settings WHERE owner_user_id = $1",
    [ownerUserId],
  );
  return mapSettings(result.rows[0]);
}

export async function updateSettings(
  ownerUserId: string,
  values: Partial<Pick<
    PlatformSettings,
    | "riskPerTradePct" | "maxExposurePct" | "maxOpenPositions"
    | "maxDailyTrades" | "maxDailyLossPct" | "cooldownMinutes"
    | "minRewardRisk" | "paperStartingBalance" | "telegramChatId"
  >>,
): Promise<PlatformSettings> {
  const current = await getSettings(ownerUserId);
  const next = { ...current, ...values };
  await pool.query(
    `UPDATE platform_settings SET
      risk_per_trade_pct = $1, max_exposure_pct = $2,
      max_open_positions = $3, max_daily_trades = $4,
      max_daily_loss_pct = $5, cooldown_minutes = $6,
      min_reward_risk = $7, paper_starting_balance = $8,
      telegram_chat_id = $9, updated_at = NOW()
     WHERE owner_user_id = $10`,
    [
      next.riskPerTradePct, next.maxExposurePct, next.maxOpenPositions,
      next.maxDailyTrades, next.maxDailyLossPct, next.cooldownMinutes,
      next.minRewardRisk, next.paperStartingBalance, next.telegramChatId,
      ownerUserId,
    ],
  );
  return getSettings(ownerUserId);
}

export async function updateKillSwitch(
  ownerUserId: string,
  active: boolean,
  reason: string | null,
): Promise<PlatformSettings> {
  await pool.query(
    `UPDATE platform_settings
     SET kill_switch_active = $1, kill_switch_reason = $2, updated_at = NOW()
     WHERE owner_user_id = $3`,
    [active, active ? reason?.trim() || "Attivato manualmente" : null, ownerUserId],
  );
  await recordAudit(ownerUserId, active ? "KILL_SWITCH_ON" : "KILL_SWITCH_OFF", null,
    active ? reason?.trim() || "Attivato manualmente" : "Disattivato");
  return getSettings(ownerUserId);
}

export function testnetConfigured(): boolean {
  return Boolean(process.env.BINANCE_TESTNET_API_KEY && process.env.BINANCE_TESTNET_API_SECRET);
}

export async function recordAudit(
  ownerUserId: string,
  eventType: string,
  symbol: string | null,
  detail: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_events (owner_user_id, event_type, symbol, detail, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [ownerUserId, eventType, symbol, detail, metadata ? JSON.stringify(metadata) : null],
  );
}

export async function listPositions(ownerUserId: string) {
  const result = await pool.query(
    `SELECT id, symbol, side, quantity::float8 AS quantity,
            entry_price::float8 AS entry_price, stop_loss::float8 AS stop_loss,
            take_profit::float8 AS take_profit, status,
            realized_pnl::float8 AS realized_pnl, opened_at
     FROM trade_records WHERE owner_user_id = $1 AND status = 'OPEN'
     ORDER BY opened_at DESC`,
    [ownerUserId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    side: "LONG" as const,
    quantity: row.quantity,
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    status: "OPEN" as const,
    unrealizedPnl: 0,
    openedAt: new Date(row.opened_at).toISOString(),
  }));
}

export async function listLegacyPortfolio(ownerUserId: string) {
  const settings = await getSettings(ownerUserId);
  const open = await pool.query(
    `SELECT symbol, entry_price::float8 AS entry, stop_loss::float8 AS sl,
            take_profit::float8 AS tp, quantity::float8 AS quantity,
            opened_at, status
     FROM trade_records WHERE owner_user_id = $1 AND status = 'OPEN'
     ORDER BY opened_at DESC`,
    [ownerUserId],
  );
  const closed = await pool.query(
    `SELECT symbol, entry_price::float8 AS entry, stop_loss::float8 AS sl,
            take_profit::float8 AS tp, quantity::float8 AS quantity,
            realized_pnl::float8 AS pnl, opened_at, closed_at
     FROM trade_records WHERE owner_user_id = $1 AND status = 'CLOSED'
     ORDER BY closed_at DESC LIMIT 200`,
    [ownerUserId],
  );
  return {
    balance: settings.paperStartingBalance,
    telegramChatId: settings.telegramChatId,
    trades: open.rows.map((row) => ({
      ticker: row.symbol, entry: row.entry, tp: row.tp, sl: row.sl,
      atr: Math.abs(row.entry - row.sl), direction: "LONG" as const,
      reason: "Approvato manualmente dal terminale.", investAmount: row.entry * row.quantity,
      addedAt: new Date(row.opened_at).toISOString(), status: "active" as const,
    })),
    closedTrades: closed.rows.map((row) => ({
      ticker: row.symbol, entry: row.entry, tp: row.tp, sl: row.sl,
      atr: Math.abs(row.entry - row.sl), direction: "LONG" as const,
      reason: "Trade persistito su PostgreSQL.", investAmount: row.entry * row.quantity,
      addedAt: new Date(row.opened_at).toISOString(),
      closedAt: new Date(row.closed_at).toISOString(), closeReason: "MANUAL" as const,
      exitPrice: row.entry + (row.pnl / Math.max(row.quantity, 0.000000000001)),
      pnl: row.pnl,
    })),
  };
}

export async function closePosition(ownerUserId: string, symbol: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE trade_records
     SET status = 'CLOSED', closed_at = NOW()
     WHERE owner_user_id = $1 AND symbol = $2 AND status = 'OPEN'`,
    [ownerUserId, symbol],
  );
  if (result.rowCount) {
    await recordAudit(ownerUserId, "POSITION_CLOSED", symbol, "Posizione chiusa manualmente.");
  }
  return Boolean(result.rowCount);
}

export async function listOrders(ownerUserId: string) {
  const result = await pool.query(
    `SELECT id, symbol, side, order_type, status, client_order_id,
            quantity::float8 AS quantity, price::float8 AS price, created_at
     FROM orders WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [ownerUserId],
  );
  return result.rows.map((row) => ({
    id: row.id, symbol: row.symbol, side: row.side, orderType: row.order_type,
    status: row.status, clientOrderId: row.client_order_id, quantity: row.quantity,
    price: row.price, createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function listFills(ownerUserId: string) {
  const result = await pool.query(
    `SELECT id, order_id, symbol, quantity::float8 AS quantity,
            price::float8 AS price, fee::float8 AS fee, fee_asset, filled_at
     FROM fills WHERE owner_user_id = $1 ORDER BY filled_at DESC LIMIT 200`,
    [ownerUserId],
  );
  return result.rows.map((row) => ({
    id: row.id, orderId: row.order_id, symbol: row.symbol, quantity: row.quantity,
    price: row.price, fee: row.fee, feeAsset: row.fee_asset,
    filledAt: new Date(row.filled_at).toISOString(),
  }));
}

export async function listAuditEvents(ownerUserId: string) {
  const result = await pool.query(
    `SELECT id, event_type, symbol, detail, created_at
     FROM audit_events WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [ownerUserId],
  );
  return result.rows.map((row) => ({
    id: row.id, eventType: row.event_type, symbol: row.symbol,
    detail: row.detail, createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function approveLongSignal(ownerUserId: string, signalId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const settings = await getSettings(ownerUserId);
    if (settings.killSwitchActive) throw new Error(`Kill switch attivo: ${settings.killSwitchReason}`);
    if (settings.executionMode === "testnet" &&
      (!settings.testnetEnabled || !testnetConfigured())) {
      throw new Error("Testnet non abilitato o credenziali Binance Testnet mancanti.");
    }

    const signal = await client.query(
      `SELECT id, asset, direction, entry_price::float8 AS entry_price,
              tp::float8 AS tp, sl::float8 AS sl, qualified, status
       FROM signals WHERE id = $1 FOR UPDATE`,
      [signalId],
    );
    const row = signal.rows[0];
    if (!row) throw new Error("Segnale non trovato");
    if (row.direction !== "LONG" || !row.qualified || row.status !== "PENDING") {
      throw new Error("Solo segnali LONG qualificati e pendenti possono essere approvati.");
    }
    const open = await client.query(
      `SELECT COUNT(*)::int AS count FROM trade_records
       WHERE owner_user_id = $1 AND status = 'OPEN'`,
      [ownerUserId],
    );
    const daily = await client.query(
      `SELECT COUNT(*) FILTER (WHERE opened_at >= CURRENT_DATE)::int AS trades,
              COALESCE(SUM(CASE WHEN closed_at >= CURRENT_DATE THEN realized_pnl ELSE 0 END), 0)::float8 AS loss,
              MAX(opened_at) AS last_trade_at
       FROM trade_records WHERE owner_user_id = $1`,
      [ownerUserId],
    );
    const risk = evaluateLongRisk({
      settings,
      entryPrice: row.entry_price,
      stopLoss: row.sl,
      takeProfit: row.tp,
      openPositions: open.rows[0].count,
      dailyTrades: daily.rows[0].trades,
      dailyLoss: Math.max(0, -Number(daily.rows[0].loss)),
      lastTradeAt: daily.rows[0].last_trade_at ? new Date(daily.rows[0].last_trade_at) : null,
    });
    const brokerOrder = await createBroker(settings.executionMode)
      .placeLongMarket(row.asset, risk.quantity);

    const trade = await client.query(
      `INSERT INTO trade_records
       (owner_user_id, signal_id, symbol, side, status, quantity, entry_price, stop_loss, take_profit)
       VALUES ($1,$2,$3,'LONG','OPEN',$4,$5,$6,$7) RETURNING id`,
      [ownerUserId, signalId, row.asset, risk.quantity, row.entry_price, row.sl, row.tp],
    );
    const clientOrderId = `paper_${randomUUID().replaceAll("-", "")}`;
    const order = await client.query(
      `INSERT INTO orders
       (owner_user_id, trade_id, symbol, side, order_type, status, client_order_id, quantity, price, raw_response)
       VALUES ($1,$2,$3,'BUY','MARKET','FILLED',$4,$5,$6,$7::jsonb) RETURNING *`,
      [ownerUserId, trade.rows[0].id, row.asset, clientOrderId, risk.quantity, row.entry_price,
        JSON.stringify({
          broker: settings.executionMode, manualApproval: true,
          exchangeOrderId: brokerOrder.exchangeOrderId,
          response: brokerOrder.rawResponse,
        })],
    );
    await client.query(
      `INSERT INTO fills (owner_user_id, order_id, symbol, quantity, price, fee, fee_asset)
       VALUES ($1,$2,$3,$4,$5,0,'QUOTE')`,
      [ownerUserId, order.rows[0].id, row.asset, risk.quantity, row.entry_price],
    );
    await client.query(
      `INSERT INTO audit_events (owner_user_id,event_type,symbol,detail,metadata)
       VALUES ($1,'ORDER_FILLED',$2,$3,$4::jsonb)`,
      [ownerUserId, row.asset, `Ordine LONG approvato in modalità ${settings.executionMode}.`,
        JSON.stringify({ signalId, tradeId: trade.rows[0].id, orderId: order.rows[0].id })],
    );
    await client.query("COMMIT");
    return {
      success: true,
      message: `Posizione LONG ${row.asset} aperta in modalità ${settings.executionMode}.`,
      order: order.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
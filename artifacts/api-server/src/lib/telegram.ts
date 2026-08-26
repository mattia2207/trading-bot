import axios from "axios";
import { loadPortfolio, savePortfolio, type ClosedTrade } from "./portfolio.js";
import { getPendingSignalsByAsset, updateSignalStatus, getGlobalStats, expireOldSignals } from "./signals.js";
import { getBatchPrices } from "./price.js";
import { logger } from "./logger.js";

const TOKEN = process.env.TELEGRAM_TOKEN ?? "";

// ─── Core Telegram send ───────────────────────────────────────────────────────

async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!TOKEN || !chatId) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 8_000 }
    );
  } catch (err) {
    logger.warn({ chatId, err }, "[telegram] sendMessage failed");
  }
}

// ─── P&L helpers ─────────────────────────────────────────────────────────────

function calcPnl(
  direction: "LONG" | "SHORT", entry: number, exit: number, investAmount: number
): number {
  const pct = direction === "LONG"
    ? (exit - entry) / entry
    : (entry - exit) / entry;
  return Math.round(pct * investAmount * 100) / 100;
}

function calcProfitPct(direction: "LONG" | "SHORT", entry: number, exit: number): number {
  return Math.round(
    (direction === "LONG"
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100) * 100
  ) / 100;
}

// ─── Combined monitor ─────────────────────────────────────────────────────────
// Single portfolio load + single batch price fetch per cycle.

async function runMonitor(): Promise<void> {
  const portfolio = loadPortfolio();
  const chatId = portfolio.telegramChatId ?? "";
  if (portfolio.trades.length === 0) return;

  const tickers = [...new Set(portfolio.trades.map(t => t.ticker))];
  const prices = await getBatchPrices(tickers);

  let portfolioChanged = false;
  const remaining = [];

  for (const trade of portfolio.trades) {
    if (trade.status === "paused") { remaining.push(trade); continue; }

    const price = prices.get(trade.ticker) ?? null;
    if (price === null) { remaining.push(trade); continue; }

    const hitTP = trade.direction === "LONG" ? price >= trade.tp : price <= trade.tp;
    const hitSL = trade.direction === "LONG" ? price <= trade.sl : price >= trade.sl;

    if (hitTP || hitSL) {
      const closeReason: "TP_HIT" | "SL_HIT" = hitTP ? "TP_HIT" : "SL_HIT";
      const pnl = calcPnl(trade.direction, trade.entry, price, trade.investAmount);
      const closed: ClosedTrade = {
        ...trade, closedAt: new Date().toISOString(),
        closeReason, exitPrice: price, pnl,
      };
      portfolio.closedTrades = portfolio.closedTrades || [];
      portfolio.closedTrades.push(closed);
      portfolioChanged = true;

      if (chatId) {
        const emoji = hitTP ? "✅ TAKE PROFIT RAGGIUNTO" : "❌ STOP LOSS COLPITO";
        const pnlStr = pnl >= 0 ? `+${pnl}` : `${pnl}`;
        await sendMessage(chatId,
          `<b>${emoji}</b>\n\n` +
          `Asset: <code>${trade.ticker}</code>\n` +
          `Direzione: ${trade.direction}\n` +
          `Prezzo attuale: ${price}\n` +
          `${hitTP ? `Target TP: ${trade.tp}` : `Stop Loss: ${trade.sl}`}\n` +
          `Investimento: ${trade.investAmount} EUR\n` +
          `<b>PnL: ${pnlStr} EUR</b>\n\n` +
          `Il trade è stato chiuso automaticamente.`
        );
      }
    } else {
      remaining.push(trade);
    }
  }

  // Monitor DB signals for the same tickers
  for (const ticker of tickers) {
    const price = prices.get(ticker) ?? null;
    if (price === null) continue;

    try {
      const pendingSignals = await getPendingSignalsByAsset(ticker);
      for (const sig of pendingSignals) {
        const hitTP = sig.direction === "LONG" ? price >= sig.tp : price <= sig.tp;
        const hitSL = sig.direction === "LONG" ? price <= sig.sl : price >= sig.sl;

        if (!hitTP && !hitSL) continue;

        const status: "WIN" | "LOSS" = hitTP ? "WIN" : "LOSS";
        const profitPct = calcProfitPct(sig.direction as "LONG" | "SHORT", sig.entry_price, price);
        await updateSignalStatus(sig.id, status, price, profitPct);

        if (chatId) {
          let statsLine = "";
          try {
            const gs = await getGlobalStats();
            if (gs.closedSignals >= 5) {
              statsLine = `\n📊 Win Rate Globale: ${gs.winRate}% (${gs.wins}W/${gs.losses}L)`;
            }
          } catch { /* non-critical */ }

          const emoji = hitTP ? "✅ TARGET RAGGIUNTO" : "❌ STOP LOSS COLPITO";
          await sendMessage(chatId,
            `<b>${emoji}</b>\n\n` +
            `Asset: <code>${ticker}</code>\n` +
            `Direzione: ${sig.direction}\n` +
            `Entrata: ${sig.entry_price}\n` +
            `Prezzo attuale: ${price}\n` +
            `${hitTP ? `Take Profit: ${sig.tp}` : `Stop Loss: ${sig.sl}`}\n` +
            `P&L: <b>${profitPct >= 0 ? "+" : ""}${profitPct}%</b>` +
            statsLine +
            `\n\nSegnale DB #${sig.id} chiuso automaticamente.`
          );
        }
      }
    } catch (err) {
      logger.error({ ticker, err }, "[Monitor] DB signal check failed");
    }
  }

  if (portfolioChanged) {
    portfolio.trades = remaining;
    savePortfolio(portfolio);
  }
}

// ─── SMART SIGNAL ALERT ───────────────────────────────────────────────────────

export interface SignalAlertParams {
  chatId: string; asset: string; direction: string;
  price: number; tp: number; sl: number;
  score: number; confidenceScore: number; confluence: number;
  marketRegime: string; verdict: string;
  qualityTier: string | null; qualified: boolean;
  historicalWinRate?: number; historicalCases?: number; dataLabel?: string;
  signalId: number;
}

export async function sendSignalAlert(params: SignalAlertParams): Promise<void> {
  if (!params.chatId || !TOKEN || !params.qualified) return;

  const tierEmoji: Record<string, string> = { ELITE: "🏆", FORTE: "⭐", NORMALE: "📊" };
  const tier     = params.qualityTier ?? "N/A";
  const tierIcon = tierEmoji[tier] ?? "📊";
  const dirEmoji = params.direction === "LONG" ? "🟢 LONG" : "🔴 SHORT";

  const rrTP = params.direction === "LONG"
    ? (((params.tp - params.price) / params.price) * 100).toFixed(2)
    : (((params.price - params.tp) / params.price) * 100).toFixed(2);
  const rrSL = params.direction === "LONG"
    ? (((params.price - params.sl) / params.price) * 100).toFixed(2)
    : (((params.sl - params.price) / params.price) * 100).toFixed(2);

  const histLine = params.historicalWinRate !== undefined && params.historicalCases !== undefined
    ? `\n📈 Win Rate Storico: <b>${params.historicalWinRate}%</b> (${params.historicalCases} casi — ${params.dataLabel ?? "Preliminare"})`
    : "";

  await sendMessage(params.chatId,
    `${tierIcon} <b>NUOVO SEGNALE ${tier}</b>\n\n` +
    `Asset: <code>${params.asset}</code>\n` +
    `Direzione: <b>${dirEmoji}</b>\n` +
    `Entrata: ${params.price}\n` +
    `Take Profit: ${params.tp} (+${rrTP}%)\n` +
    `Stop Loss: ${params.sl} (-${rrSL}%)\n\n` +
    `Score: <b>${params.score}/100</b>\n` +
    `Confidence: ${params.confidenceScore}%\n` +
    `Confluenza: ${params.confluence}/6\n` +
    `Regime: ${params.marketRegime}\n` +
    `Verdetto: ${params.verdict}` +
    histLine +
    `\n\nID Segnale: #${params.signalId}`
  );
}

// ─── START MONITOR ────────────────────────────────────────────────────────────

export function startTelegramMonitor(): void {
  if (!TOKEN) {
    logger.warn("[Monitor] TELEGRAM_TOKEN non configurato — monitor disabilitato.");
    return;
  }
  logger.info("[Monitor] Monitor Telegram avviato (ogni 60s).");

  const run = () => {
    runMonitor().catch(err => logger.error({ err }, "[Monitor] Cycle error"));
    expireOldSignals().catch(err => logger.warn({ err }, "[Monitor] expireOldSignals failed"));
  };

  // First run after 10 s to let the server warm up
  setTimeout(run, 10_000);
  setInterval(run, 60_000);
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_FILE = path.resolve(__dirname, "../../../../portfolio.json");

export interface Trade {
  ticker: string;
  entry: number;
  tp: number;
  sl: number;
  atr: number;
  direction: "LONG" | "SHORT";
  reason: string;
  investAmount: number;
  addedAt: string;
  status: "active" | "paused";
}

export interface ClosedTrade extends Trade {
  closedAt: string;
  closeReason: "TP_HIT" | "SL_HIT" | "MANUAL";
  exitPrice: number;
  pnl: number;
}

export interface Portfolio {
  balance: number;
  telegramChatId?: string | null;
  trades: Trade[];
  closedTrades: ClosedTrade[];
}

export interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export function loadPortfolio(): Portfolio {
  try {
    if (!fs.existsSync(PORTFOLIO_FILE)) {
      const initial: Portfolio = { balance: 1000, trades: [], closedTrades: [], telegramChatId: null };
      fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(PORTFOLIO_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Portfolio;
    parsed.trades = (parsed.trades || []).map((t) => ({
      direction: "LONG" as const,
      reason: "",
      investAmount: 100,
      status: "active" as const,
      ...t,
    }));
    parsed.closedTrades = parsed.closedTrades || [];
    return parsed;
  } catch {
    return { balance: 1000, trades: [], closedTrades: [], telegramChatId: null };
  }
}

export function savePortfolio(data: Portfolio): void {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

export function calcMetrics(closedTrades: ClosedTrade[]): PerformanceMetrics {
  if (closedTrades.length === 0) {
    return { totalPnl: 0, winRate: 0, profitFactor: 0, totalClosedTrades: 0, winningTrades: 0, losingTrades: 0 };
  }
  const winners = closedTrades.filter((t) => t.pnl > 0);
  const losers = closedTrades.filter((t) => t.pnl <= 0);
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
  return {
    totalPnl: Math.round(closedTrades.reduce((s, t) => s + t.pnl, 0) * 100) / 100,
    winRate: Math.round((winners.length / closedTrades.length) * 1000) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    totalClosedTrades: closedTrades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
  };
}

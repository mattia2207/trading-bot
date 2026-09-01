import type { PlatformSettings } from "./platform.js";

export interface RiskInput {
  settings: Pick<
    PlatformSettings,
    | "paperStartingBalance" | "riskPerTradePct" | "maxExposurePct"
    | "maxOpenPositions" | "maxDailyTrades" | "maxDailyLossPct"
    | "cooldownMinutes" | "minRewardRisk"
  >;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  openPositions: number;
  dailyTrades: number;
  dailyLoss: number;
  lastTradeAt: Date | null;
  now?: Date;
}

export interface RiskDecision {
  quantity: number;
  exposure: number;
  riskCapital: number;
  rewardRisk: number;
}

export function evaluateLongRisk(input: RiskInput): RiskDecision {
  const now = input.now ?? new Date();
  const distance = input.entryPrice - input.stopLoss;
  const reward = input.takeProfit - input.entryPrice;
  const rewardRisk = distance > 0 ? reward / distance : 0;

  if (input.openPositions >= input.settings.maxOpenPositions) {
    throw new Error("Limite posizioni aperte raggiunto.");
  }
  if (input.dailyTrades >= input.settings.maxDailyTrades) {
    throw new Error("Limite operazioni giornaliere raggiunto.");
  }
  if (input.dailyLoss >= input.settings.paperStartingBalance * input.settings.maxDailyLossPct / 100) {
    throw new Error("Limite di perdita giornaliera raggiunto.");
  }
  if (input.lastTradeAt &&
      now.getTime() - input.lastTradeAt.getTime() <
      input.settings.cooldownMinutes * 60_000) {
    throw new Error("Cooldown operativo ancora attivo.");
  }
  if (distance <= 0 || rewardRisk < input.settings.minRewardRisk) {
    throw new Error("Il rapporto rischio/rendimento non rispetta il limite configurato.");
  }

  const riskCapital = input.settings.paperStartingBalance * input.settings.riskPerTradePct / 100;
  const quantity = riskCapital / distance;
  const exposure = quantity * input.entryPrice;
  if (exposure > input.settings.paperStartingBalance * input.settings.maxExposurePct / 100) {
    throw new Error("Esposizione oltre il limite configurato.");
  }
  return { quantity, exposure, riskCapital, rewardRisk };
}
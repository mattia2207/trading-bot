import axios from "axios";
import { logger } from "./logger.js";

const TOKEN = process.env.TELEGRAM_TOKEN ?? "";

async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!TOKEN || !chatId) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 8_000 },
    );
  } catch (err) {
    logger.warn({ chatId, err }, "[telegram] sendMessage failed");
  }
}

export interface SignalAlertParams {
  chatId: string;
  asset: string;
  direction: string;
  price: number;
  tp: number;
  sl: number;
  score: number;
  confidenceScore: number;
  confluence: number;
  marketRegime: string;
  verdict: string;
  qualityTier: string | null;
  qualified: boolean;
  historicalWinRate?: number;
  historicalCases?: number;
  dataLabel?: string;
  signalId: number;
}

export async function sendSignalAlert(params: SignalAlertParams): Promise<void> {
  if (!params.chatId || !TOKEN || !params.qualified) return;

  const tierEmoji: Record<string, string> = { ELITE: "🏆", FORTE: "⭐", NORMALE: "📊" };
  const tier = params.qualityTier ?? "N/A";
  const rrTP = (((params.tp - params.price) / params.price) * 100).toFixed(2);
  const rrSL = (((params.price - params.sl) / params.price) * 100).toFixed(2);
  const histLine = params.historicalWinRate !== undefined && params.historicalCases !== undefined
    ? `\n📈 Win Rate Storico: <b>${params.historicalWinRate}%</b> (${params.historicalCases} casi — ${params.dataLabel ?? "Preliminare"})`
    : "";

  await sendMessage(params.chatId,
    `${tierEmoji[tier] ?? "📊"} <b>NUOVO SEGNALE ${tier}</b>\n\n` +
    `Asset: <code>${params.asset}</code>\n` +
    `Direzione: <b>🟢 LONG</b>\n` +
    `Entrata: ${params.price}\n` +
    `Take Profit: ${params.tp} (+${rrTP}%)\n` +
    `Stop Loss: ${params.sl} (-${rrSL}%)\n\n` +
    `Score: <b>${params.score}/100</b>\n` +
    `Confidence: ${params.confidenceScore}%\n` +
    `Confluenza: ${params.confluence}/6\n` +
    `Regime: ${params.marketRegime}\n` +
    `Verdetto: ${params.verdict}${histLine}\n\n` +
    `ID Segnale: #${params.signalId}`,
  );
}
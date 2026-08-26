/**
 * Shared price-fetching utilities.
 * Single source of truth for symbol normalization and live price retrieval.
 */
import axios from "axios";
import { logger } from "./logger.js";

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY ?? "";

/** Normalise crypto/forex ticker to a Twelve Data-compatible symbol. */
export function normalizeSymbol(ticker: string): string {
  return ticker
    .replace(/-/g, "/")
    .replace(/\/USDT$/i, "/USD")
    .replace(/\/BUSD$/i, "/USD")
    .replace(/\/USDC$/i, "/USD");
}

/** Adaptive decimal formatter — same logic used across components. */
export function formatPrice(val: number): string {
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  const decimals =
    abs >= 10_000 ? 2 :
    abs >= 1_000  ? 2 :
    abs >= 100    ? 3 :
    abs >= 1      ? 4 :
    abs >= 0.01   ? 6 : 8;
  return val.toFixed(decimals);
}

/** Fetch the current price for a single ticker. Returns null on any failure. */
export async function getCurrentPrice(ticker: string): Promise<number | null> {
  if (!TWELVE_DATA_KEY) return null;
  try {
    const symbol = normalizeSymbol(ticker);
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await axios.get<{ price?: string; status?: string }>(url, { timeout: 8_000 });
    if (res.data.status === "error") return null;
    const price = parseFloat(res.data.price ?? "");
    return isNaN(price) ? null : price;
  } catch (err) {
    logger.warn({ ticker, err }, "[price] getCurrentPrice failed");
    return null;
  }
}

/** Fetch prices for multiple tickers concurrently (max 6 in parallel to respect rate limits). */
export async function getBatchPrices(
  tickers: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  const CONCURRENCY = 6;

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    const prices = await Promise.all(chunk.map(t => getCurrentPrice(t)));
    chunk.forEach((t, idx) => result.set(t, prices[idx]));
  }
  return result;
}

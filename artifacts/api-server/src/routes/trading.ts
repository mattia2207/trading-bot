import { Router, type IRouter } from "express";
import {
  GetPortfolioResponse,
  GetTradesResponse,
  GetTradesLiveResponse,
  AddTradeBody,
  AddTradeResponse,
  DeleteTradeParams,
  DeleteTradeResponse,
  AnalyzeTickerParams,
  AnalyzeTickerResponse,
  GetPortfolioSummaryResponse,
  UpdatePortfolioBody,
  GetClosedTradesResponse,
  GetPortfolioMetricsResponse,
  SearchSymbolsQueryParams,
  SearchSymbolsResponse,
} from "@workspace/api-zod";
import { loadPortfolio, savePortfolio, calcMetrics, type Trade, type ClosedTrade } from "../lib/portfolio.js";
import { analyzeTicker as runAnalysis, searchSymbols } from "../lib/analysis.js";
import {
  insertSignal, getQualityFilter, getQualityTier,
  isQualifiedSignal, getHistoricalContext,
} from "../lib/signals.js";
import { sendSignalAlert } from "../lib/telegram.js";
import { getBatchPrices } from "../lib/price.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Type for analysis result ─────────────────────────────────────────────────

type AnalysisResult = NonNullable<Awaited<ReturnType<typeof runAnalysis>>>;

// ─── Fire-and-forget signal persistence ──────────────────────────────────────

async function persistSignal(
  ticker: string, result: AnalysisResult, chatId: string
): Promise<void> {
  try {
    const [filter] = await Promise.all([getQualityFilter()]);
    const tier      = getQualityTier(result.score, result.confidenceScore, result.confluence);
    const qualified = isQualifiedSignal(result.score, result.confidenceScore, result.confluence, filter);

    const scoreBreakdown = result.scoreBreakdown as Record<string, number>;
    const trend =
      scoreBreakdown.trend > 15 ? "Rialzista" :
      scoreBreakdown.trend > 8  ? "Neutrale"  : "Ribassista";
    const momentum =
      result.rsi > 60 ? "Forte Rialzista" :
      result.rsi > 50 ? "Moderato Rialzista" :
      result.rsi < 40 ? "Forte Ribassista" : "Neutrale";

    const id = await insertSignal({
      asset: ticker, direction: result.direction, entryPrice: result.price,
      tp: result.tp, sl: result.sl, score: result.score,
      confidenceScore: result.confidenceScore,
      estimatedProbability: result.estimatedProbability,
      rsi: result.rsi, macdHistogram: result.macdHistogram,
      ema50: result.ema50, ema100: result.ema100, ema200: result.ema200,
      atr: result.atr, volumeRatio: result.volumeRatio,
      trend, momentum, volatility: "Normale",
      confluence: result.confluence, marketRegime: result.marketRegime,
      verdict: result.verdict, falseSignalRisk: result.falseSignalRisk,
      qualified, qualityTier: tier,
      scoreBreakdown: result.scoreBreakdown as Record<string, number>,
      confluenceFactors: result.confluenceFactors as Record<string, boolean>,
      reason: result.reason,
    });

    if (qualified && chatId) {
      const histCtx = await getHistoricalContext(
        result.score, result.confidenceScore, result.confluence, result.direction
      ).catch(() => null);

      await sendSignalAlert({
        chatId, asset: ticker, direction: result.direction,
        price: result.price, tp: result.tp, sl: result.sl,
        score: result.score, confidenceScore: result.confidenceScore,
        confluence: result.confluence, marketRegime: result.marketRegime,
        verdict: result.verdict, qualityTier: tier, qualified,
        historicalWinRate: histCtx?.winRate,
        historicalCases: histCtx?.totalCases,
        dataLabel: histCtx?.dataLabel,
        signalId: id,
      });
    }
  } catch (err) {
    logger.error({ ticker, err }, "[trading] persistSignal error");
  }
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

router.get("/portfolio", (_req, res) => {
  res.json(GetPortfolioResponse.parse(loadPortfolio()));
});

router.patch("/portfolio", (req, res) => {
  const parsed = UpdatePortfolioBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const portfolio = loadPortfolio();
  if (parsed.data.balance !== undefined && parsed.data.balance > 0) {
    portfolio.balance = parsed.data.balance;
  }
  if (parsed.data.telegramChatId !== undefined) {
    portfolio.telegramChatId = parsed.data.telegramChatId.trim() || null;
  }
  savePortfolio(portfolio);
  res.json(GetPortfolioResponse.parse(portfolio));
});

router.get("/portfolio/summary", (_req, res) => {
  const portfolio = loadPortfolio();
  const trades = portfolio.trades;
  res.json(GetPortfolioSummaryResponse.parse({
    totalTrades: trades.length,
    buySignals:  trades.length,
    avgScore:    trades.length > 0 ? 80 : 0,
    highestScoringTicker: trades.length > 0 ? trades[trades.length - 1].ticker : null,
  }));
});

router.get("/portfolio/metrics", (_req, res) => {
  const portfolio = loadPortfolio();
  res.json(GetPortfolioMetricsResponse.parse(calcMetrics(portfolio.closedTrades || [])));
});

// ─── Trades ───────────────────────────────────────────────────────────────────

router.get("/trades", (_req, res) => {
  res.json(GetTradesResponse.parse(loadPortfolio().trades));
});

router.get("/trades/closed", (_req, res) => {
  res.json(GetClosedTradesResponse.parse(loadPortfolio().closedTrades || []));
});

router.get("/trades/live", async (_req, res) => {
  const portfolio = loadPortfolio();
  const tickers = portfolio.trades.map(t => t.ticker);
  const prices = await getBatchPrices(tickers);

  const results = portfolio.trades.map(trade => {
    const currentPrice = prices.get(trade.ticker) ?? null;
    if (currentPrice === null) {
      return { ...trade, currentPrice: null, unrealizedPnl: null, priceChangePercent: null };
    }
    const pct =
      trade.direction === "LONG"
        ? (currentPrice - trade.entry) / trade.entry
        : (trade.entry - currentPrice) / trade.entry;
    return {
      ...trade,
      currentPrice,
      unrealizedPnl:      Math.round(pct * trade.investAmount * 100) / 100,
      priceChangePercent: Math.round(pct * 10_000) / 100,
    };
  });

  res.json(GetTradesLiveResponse.parse(results));
});

// ─── Add trade ────────────────────────────────────────────────────────────────

router.post("/trades", async (req, res) => {
  const parsed = AddTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker      = parsed.data.ticker.toUpperCase().trim();
  const investAmount = parsed.data.investAmount ?? 100;

  const result = await runAnalysis(ticker);
  const extraFields = result
    ? { verdict: result.verdict ?? null, confidenceScore: result.confidenceScore ?? null, estimatedProbability: result.estimatedProbability ?? null }
    : { verdict: null, confidenceScore: null, estimatedProbability: null };

  if (!result) {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `Errore nel recupero dati per ${ticker}. Verifica il simbolo (es. BTC/USD).`,
      signal: "WAIT", direction: null, score: null, reason: null, ...extraFields,
    }));
    return;
  }

  const portfolio = loadPortfolio();
  const chatId    = portfolio.telegramChatId ?? "";
  // Fire-and-forget — never block the response
  void persistSignal(ticker, result, chatId);

  if (result.signal !== "BUY") {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `Segnale WAIT per ${ticker} (Score: ${result.score}/100). Condizioni non idonee.`,
      signal: result.signal, direction: result.direction, score: result.score,
      reason: result.reason, ...extraFields,
    }));
    return;
  }

  if (portfolio.trades.some(t => t.ticker === ticker)) {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `${ticker} è già sotto monitoraggio.`,
      signal: result.signal, direction: result.direction, score: result.score,
      reason: result.reason, ...extraFields,
    }));
    return;
  }

  const trade: Trade = {
    ticker, entry: result.price, tp: result.tp, sl: result.sl, atr: result.atr,
    direction: result.direction as "LONG" | "SHORT",
    reason: result.reason, investAmount, addedAt: new Date().toISOString(),
    status: "active",
  };
  portfolio.trades.push(trade);
  savePortfolio(portfolio);

  res.json(AddTradeResponse.parse({
    success: true,
    message: `${ticker} aggiunto — Direzione: ${result.direction}`,
    signal: result.signal, direction: result.direction, score: result.score,
    reason: result.reason, trade, ...extraFields,
  }));
});

// ─── Pause / resume trade monitoring ───────────────────────────────────────────

router.patch("/trades/:ticker/status", (req, res) => {
  const ticker = String(req.params.ticker || "").toUpperCase().trim();
  const status = req.body?.status;
  if (status !== "active" && status !== "paused") {
    res.status(400).json({ error: "Stato non valido (usa 'active' o 'paused')" });
    return;
  }

  const portfolio = loadPortfolio();
  const trade = portfolio.trades.find(t => t.ticker === ticker);
  if (!trade) {
    res.status(404).json({ error: `${ticker} non trovato nel tracciamento` });
    return;
  }

  trade.status = status;
  savePortfolio(portfolio);
  res.json(trade);
});

// ─── Delete trade ─────────────────────────────────────────────────────────────

router.delete("/trades/:ticker", (req, res) => {
  const parsed = DeleteTradeParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker    = parsed.data.ticker.toUpperCase();
  const portfolio = loadPortfolio();
  const trade     = portfolio.trades.find(t => t.ticker === ticker);

  if (!trade) {
    res.status(404).json({ error: `${ticker} non trovato nel tracciamento` });
    return;
  }

  portfolio.trades = portfolio.trades.filter(t => t.ticker !== ticker);
  portfolio.closedTrades = portfolio.closedTrades || [];
  portfolio.closedTrades.push({
    ...trade,
    closedAt:    new Date().toISOString(),
    closeReason: "MANUAL",
    exitPrice:   trade.entry,
    pnl:         0,
  } as ClosedTrade);
  savePortfolio(portfolio);

  res.json(DeleteTradeResponse.parse({ success: true, message: `Monitoraggio interrotto per ${ticker}` }));
});

// ─── Symbol search (universal: company name, ticker, ISIN, crypto, ETF) ───────

router.get("/symbols/search", async (req, res) => {
  const parsed = SearchSymbolsQueryParams.safeParse({ q: req.query.q });
  if (!parsed.success || parsed.data.q.trim().length < 1) {
    res.status(400).json({ error: "Parametro di ricerca mancante" });
    return;
  }

  const query = parsed.data.q.trim();
  const outcome = await searchSymbols(query);

  res.json(SearchSymbolsResponse.parse({
    query,
    matches: outcome.matches,
    providerLimited: outcome.providerLimited,
    note: outcome.note,
  }));
});

// ─── Analysis ─────────────────────────────────────────────────────────────────

router.get("/analysis/:ticker", async (req, res) => {
  const parsed = AnalyzeTickerParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker = parsed.data.ticker.toUpperCase();
  const result = await runAnalysis(ticker);
  if (!result) {
    res.status(400).json({ error: `Errore nel recupero dati per ${ticker}` });
    return;
  }

  const portfolio = loadPortfolio();
  void persistSignal(ticker, result, portfolio.telegramChatId ?? "");

  res.json(AnalyzeTickerResponse.parse(result));
});

export default router;

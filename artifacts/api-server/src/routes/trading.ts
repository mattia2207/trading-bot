import { Router, type IRouter } from "express";
import {
  GetPortfolioResponse,
  GetTradesResponse,
  AddTradeBody,
  AddTradeResponse,
  DeleteTradeParams,
  DeleteTradeResponse,
  AnalyzeTickerParams,
  AnalyzeTickerResponse,
  GetPortfolioSummaryResponse,
  GetPortfolioMetricsResponse,
  SearchSymbolsQueryParams,
  SearchSymbolsResponse,
} from "@workspace/api-zod";
import {
  getSettings, updateSettings, listLegacyPortfolio, closePosition,
} from "../lib/platform.js";
import { analyzeTicker as runAnalysis, searchSymbols } from "../lib/analysis.js";
import {
  insertSignal, getQualityFilter, getQualityTier,
  isQualifiedSignal, getHistoricalContext,
} from "../lib/signals.js";
import { sendSignalAlert } from "../lib/telegram.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const owner = (req: import("express").Request) => req.userId!;
type AnalysisResult = NonNullable<Awaited<ReturnType<typeof runAnalysis>>>;

async function persistSignal(
  ticker: string, result: AnalysisResult, chatId: string,
): Promise<void> {
  try {
    const filter = await getQualityFilter();
    const tier = getQualityTier(result.score, result.confidenceScore, result.confluence);
    const qualified = isQualifiedSignal(
      result.score, result.confidenceScore, result.confluence, filter,
    );
    const breakdown = result.scoreBreakdown as unknown as Record<string, number>;
    const id = await insertSignal({
      asset: ticker, direction: result.direction, entryPrice: result.price,
      tp: result.tp, sl: result.sl, score: result.score,
      confidenceScore: result.confidenceScore,
      heuristicConfidence: result.heuristicConfidence,
      rsi: result.rsi, macdHistogram: result.macdHistogram,
      ema50: result.ema50, ema100: result.ema100, ema200: result.ema200,
      atr: result.atr, volumeRatio: result.volumeRatio,
      trend: breakdown.trend > 15 ? "Rialzista" : breakdown.trend > 8 ? "Neutrale" : "Ribassista",
      momentum: result.rsi > 60 ? "Forte Rialzista" : result.rsi < 40 ? "Forte Ribassista" : "Neutrale",
      volatility: "Normale", confluence: result.confluence,
      marketRegime: result.marketRegime, verdict: result.verdict,
      falseSignalRisk: result.falseSignalRisk, qualified, qualityTier: tier,
      scoreBreakdown: breakdown,
      confluenceFactors: result.confluenceFactors as unknown as Record<string, boolean>,
      reason: result.reason,
    });
    if (qualified && chatId) {
      const hist = await getHistoricalContext(
        result.score, result.confidenceScore, result.confluence, result.direction,
      ).catch(() => null);
      await sendSignalAlert({
        chatId, asset: ticker, direction: result.direction, price: result.price,
        tp: result.tp, sl: result.sl, score: result.score,
        confidenceScore: result.confidenceScore, confluence: result.confluence,
        marketRegime: result.marketRegime, verdict: result.verdict,
        qualityTier: tier, qualified, historicalWinRate: hist?.winRate,
        historicalCases: hist?.totalCases, dataLabel: hist?.dataLabel, signalId: id,
      });
    }
  } catch (error) {
    logger.error({ ticker, error }, "[trading] signal persistence failed");
  }
}

function legacyMetrics(closedTrades: Array<{ pnl: number }>) {
  const wins = closedTrades.filter((trade) => trade.pnl > 0);
  const losses = closedTrades.filter((trade) => trade.pnl <= 0);
  const grossWin = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  return {
    totalPnl: Math.round(closedTrades.reduce((sum, trade) => sum + trade.pnl, 0) * 100) / 100,
    winRate: closedTrades.length ? Math.round(wins.length / closedTrades.length * 1000) / 10 : 0,
    profitFactor: grossLoss ? Math.round(grossWin / grossLoss * 100) / 100 : 0,
    totalClosedTrades: closedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
  };
}

router.get("/portfolio", async (req, res, next) => {
  try { res.json(GetPortfolioResponse.parse(await listLegacyPortfolio(owner(req)))); }
  catch (error) { next(error); }
});

router.patch("/portfolio", async (req, res, next) => {
  const body = req.body as { balance?: unknown; telegramChatId?: unknown };
  const telegramChatId = body.telegramChatId === undefined
    ? undefined
    : String(body.telegramChatId).trim() || null;
  if (body.balance !== undefined && (!Number.isFinite(Number(body.balance)) || Number(body.balance) <= 0)) {
    res.status(400).json({ error: "Saldo non valido" });
    return;
  }
  try {
    await updateSettings(owner(req), {
      ...(telegramChatId !== undefined ? { telegramChatId } : {}),
      ...(body.balance !== undefined ? { paperStartingBalance: Number(body.balance) } : {}),
    });
    res.json(await listLegacyPortfolio(owner(req)));
  } catch (error) { next(error); }
});

router.get("/portfolio/summary", async (req, res, next) => {
  try {
    const portfolio = await listLegacyPortfolio(owner(req));
    const highest = portfolio.trades[0]?.ticker ?? null;
    res.json(GetPortfolioSummaryResponse.parse({
      totalTrades: portfolio.trades.length + portfolio.closedTrades.length,
      buySignals: portfolio.trades.length,
      avgScore: 0,
      highestScoringTicker: highest,
    }));
  } catch (error) { next(error); }
});

router.get("/portfolio/metrics", async (req, res, next) => {
  try {
    const portfolio = await listLegacyPortfolio(owner(req));
    res.json(GetPortfolioMetricsResponse.parse(legacyMetrics(portfolio.closedTrades)));
  } catch (error) { next(error); }
});

router.get("/trades", async (req, res, next) => {
  try { res.json(GetTradesResponse.parse((await listLegacyPortfolio(owner(req))).trades)); }
  catch (error) { next(error); }
});

router.get("/trades/closed", async (req, res, next) => {
  try { res.json((await listLegacyPortfolio(owner(req))).closedTrades); }
  catch (error) { next(error); }
});

/**
 * An analysis never opens a position. The returned signal must be approved
 * explicitly through POST /signals/:id/approve.
 */
router.post("/trades", async (req, res, next) => {
  const parsed = AddTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }
  const ticker = parsed.data.ticker.toUpperCase().trim();
  try {
    const result = await runAnalysis(ticker);
    if (!result) {
      res.json(AddTradeResponse.parse({
        success: false, message: `Dati non disponibili per ${ticker}.`,
        signal: "WAIT", direction: null, score: null, reason: null,
        verdict: null, confidenceScore: null, heuristicConfidence: null,
      }));
      return;
    }
    const settings = await getSettings(owner(req));
    void persistSignal(ticker, result, settings.telegramChatId ?? "");
    const canApprove = result.signal === "BUY" && result.direction === "LONG";
    res.json(AddTradeResponse.parse({
      success: false,
      message: canApprove
        ? `${ticker}: segnale LONG creato. Richiede approvazione manuale.`
        : `${ticker}: nessun segnale LONG qualificato.`,
      signal: result.signal, direction: result.direction, score: result.score,
      reason: result.reason, verdict: result.verdict,
      confidenceScore: result.confidenceScore,
      heuristicConfidence: result.heuristicConfidence,
    }));
  } catch (error) { next(error); }
});

router.patch("/trades/:ticker/status", (_req, res) => {
  res.status(410).json({ error: "La pausa del monitor legacy è stata rimossa: usa il kill switch." });
});

router.delete("/trades/:ticker", async (req, res, next) => {
  const parsed = DeleteTradeParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }
  try {
    const closed = await closePosition(owner(req), parsed.data.ticker.toUpperCase());
    if (!closed) { res.status(404).json({ error: "Posizione non trovata" }); return; }
    res.json(DeleteTradeResponse.parse({
      success: true, message: `Posizione chiusa per ${parsed.data.ticker.toUpperCase()}`,
    }));
  } catch (error) { next(error); }
});

router.get("/symbols/search", async (req, res, next) => {
  const parsed = SearchSymbolsQueryParams.safeParse({ q: req.query.q });
  if (!parsed.success || parsed.data.q.trim().length < 1) {
    res.status(400).json({ error: "Parametro di ricerca mancante" });
    return;
  }
  try {
    const query = parsed.data.q.trim();
    const outcome = await searchSymbols(query);
    res.json(SearchSymbolsResponse.parse({ query, ...outcome }));
  } catch (error) { next(error); }
});

router.get("/analysis/:ticker", async (req, res, next) => {
  const parsed = AnalyzeTickerParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }
  try {
    const result = await runAnalysis(parsed.data.ticker.toUpperCase());
    if (!result) { res.status(400).json({ error: "Dati non disponibili" }); return; }
    const settings = await getSettings(owner(req));
    void persistSignal(result.ticker, result, settings.telegramChatId ?? "");
    res.json(AnalyzeTickerResponse.parse(result));
  } catch (error) { next(error); }
});

export default router;
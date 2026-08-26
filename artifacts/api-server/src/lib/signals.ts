import { pool } from "@workspace/db";
import { logger } from "./logger.js";

// ─── SCHEMA INIT ─────────────────────────────────────────────────────────────

export async function initSignalsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY,
      asset VARCHAR(20) NOT NULL,
      timeframe VARCHAR(10) NOT NULL DEFAULT '1h',
      direction VARCHAR(10) NOT NULL,
      entry_price DECIMAL(20,8) NOT NULL,
      tp DECIMAL(20,8),
      sl DECIMAL(20,8),
      score INTEGER NOT NULL DEFAULT 0,
      confidence_score INTEGER NOT NULL DEFAULT 0,
      estimated_probability INTEGER NOT NULL DEFAULT 0,
      rsi DECIMAL(8,4),
      macd_histogram DECIMAL(16,8),
      ema50 DECIMAL(20,8),
      ema100 DECIMAL(20,8),
      ema200 DECIMAL(20,8),
      atr DECIMAL(20,8),
      volume_ratio DECIMAL(8,4),
      trend VARCHAR(50),
      momentum VARCHAR(50),
      volatility VARCHAR(50),
      confluence INTEGER NOT NULL DEFAULT 0,
      market_regime VARCHAR(50),
      verdict VARCHAR(20),
      false_signal_risk VARCHAR(20),
      status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
      qualified BOOLEAN NOT NULL DEFAULT false,
      quality_tier VARCHAR(10),
      exit_price DECIMAL(20,8),
      profit_pct DECIMAL(10,4),
      max_profit_pct DECIMAL(10,4),
      max_drawdown_pct DECIMAL(10,4),
      duration_minutes INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
    -- Extended columns (added after initial schema)
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS confluence_factors JSONB;
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS reason TEXT;

    CREATE TABLE IF NOT EXISTS quality_filter_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      min_score INTEGER NOT NULL DEFAULT 70,
      min_confidence INTEGER NOT NULL DEFAULT 60,
      min_confluence INTEGER NOT NULL DEFAULT 4,
      CHECK (id = 1)
    );
    INSERT INTO quality_filter_settings (id, min_score, min_confidence, min_confluence)
    VALUES (1, 70, 60, 4) ON CONFLICT (id) DO NOTHING;

    -- Single-column indexes
    CREATE INDEX IF NOT EXISTS idx_signals_asset      ON signals(asset);
    CREATE INDEX IF NOT EXISTS idx_signals_status     ON signals(status);
    CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_signals_score      ON signals(score);
    CREATE INDEX IF NOT EXISTS idx_signals_qualified  ON signals(qualified);

    -- Composite indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_signals_status_created ON signals(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_signals_asset_status   ON signals(asset, status);
    CREATE INDEX IF NOT EXISTS idx_signals_score_conf_dir ON signals(score, confidence_score, confluence, direction)
      WHERE status IN ('WIN','LOSS');
  `);
  logger.info("[DB] Signals schema ready.");
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SignalInsertData {
  asset: string; direction: string; entryPrice: number;
  tp: number; sl: number; score: number;
  confidenceScore: number; estimatedProbability: number;
  rsi: number; macdHistogram: number;
  ema50: number; ema100: number; ema200: number;
  atr: number; volumeRatio: number;
  trend: string; momentum: string; volatility: string;
  confluence: number; marketRegime: string;
  verdict: string; falseSignalRisk: string;
  qualified: boolean; qualityTier: string | null;
  scoreBreakdown?: Record<string, number> | null;
  confluenceFactors?: Record<string, boolean> | null;
  reason?: string | null;
}

export interface QualityFilterSettings {
  minScore: number; minConfidence: number; minConfluence: number;
}

export interface StatRow {
  label: string; totalSignals: number; closedSignals: number;
  wins: number; losses: number; winRate: number;
  profitFactor: number; avgReturn: number; avgDrawdown: number; expectancy: number;
}

export interface GlobalStats {
  totalSignals: number; closedSignals: number; pendingSignals: number;
  wins: number; losses: number; expired: number;
  winRate: number; profitFactor: number; avgReturn: number;
  avgDrawdown: number; expectancy: number; avgRiskReward: number;
  maxDrawdown: number; roiTheoretical: number;
}

export interface HistoricalContext {
  totalCases: number; wins: number; winRate: number;
  profitFactor: number; avgReturn: number;
  isValidated: boolean; dataLabel: string;
}

// ─── QUALITY HELPERS ──────────────────────────────────────────────────────────

export function getQualityTier(
  score: number, confidence: number, confluence: number
): "ELITE" | "FORTE" | "NORMALE" | null {
  if (score >= 85 && confidence >= 70 && confluence >= 5) return "ELITE";
  if (score >= 75 && confidence >= 65) return "FORTE";
  if (score >= 70 && confidence >= 60) return "NORMALE";
  return null;
}

export function isQualifiedSignal(
  score: number, confidence: number, confluence: number,
  filter: QualityFilterSettings
): boolean {
  return (
    score >= filter.minScore &&
    confidence >= filter.minConfidence &&
    confluence >= filter.minConfluence
  );
}

// ─── PROFIT FACTOR ────────────────────────────────────────────────────────────

function calcPF(w: number, l: number, aw: number, al: number): number {
  if (l === 0 && w > 0) return 9.99;
  if (l === 0) return 0;
  const gw = w * Math.max(0, aw);
  const gl = l * Math.abs(Math.min(0, al));
  return gl > 0 ? Math.round((gw / gl) * 100) / 100 : 0;
}

/** Map a raw DB row {total,wins,losses,avg_win,avg_loss,avg_dd} to a StatRow. */
function rowToStat(label: string, r: {
  total: string; wins: string; losses: string;
  avg_win: string | null; avg_loss: string | null; avg_dd: string | null;
}): StatRow {
  const t = parseInt(r.total) || 0;
  const w = parseInt(r.wins) || 0;
  const l = parseInt(r.losses) || 0;
  const aw = parseFloat(r.avg_win ?? "0") || 0;
  const al = parseFloat(r.avg_loss ?? "0") || 0;
  const wr = t > 0 ? Math.round((w / t) * 1000) / 10 : 0;
  return {
    label, totalSignals: t, closedSignals: t, wins: w, losses: l, winRate: wr,
    profitFactor: calcPF(w, l, aw, al),
    avgReturn: Math.round(((aw * w + al * l) / Math.max(1, t)) * 100) / 100,
    avgDrawdown: Math.round((parseFloat(r.avg_dd ?? "0") || 0) * 100) / 100,
    expectancy: Math.round(((wr / 100) * aw - (1 - wr / 100) * Math.abs(al)) * 100) / 100,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function insertSignal(data: SignalInsertData): Promise<number> {
  const res = await pool.query<{ id: number }>(
    `INSERT INTO signals (asset,direction,entry_price,tp,sl,score,confidence_score,
      estimated_probability,rsi,macd_histogram,ema50,ema100,ema200,atr,volume_ratio,
      trend,momentum,volatility,confluence,market_regime,verdict,false_signal_risk,
      qualified,quality_tier,score_breakdown,confluence_factors,reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     RETURNING id`,
    [
      data.asset, data.direction, data.entryPrice, data.tp, data.sl,
      data.score, data.confidenceScore, data.estimatedProbability,
      data.rsi, data.macdHistogram, data.ema50, data.ema100, data.ema200,
      data.atr, data.volumeRatio, data.trend, data.momentum, data.volatility,
      data.confluence, data.marketRegime, data.verdict, data.falseSignalRisk,
      data.qualified, data.qualityTier,
      data.scoreBreakdown ? JSON.stringify(data.scoreBreakdown) : null,
      data.confluenceFactors ? JSON.stringify(data.confluenceFactors) : null,
      data.reason ?? null,
    ]
  );
  return res.rows[0].id;
}

/** Single-query update: computes duration inline, no pre-SELECT needed. */
export async function updateSignalStatus(
  id: number, status: "WIN" | "LOSS" | "EXPIRED",
  exitPrice?: number, profitPct?: number,
  maxProfitPct?: number, maxDrawdownPct?: number
): Promise<void> {
  await pool.query(
    `UPDATE signals
     SET status=$1,
         exit_price=$2,
         profit_pct=$3,
         max_profit_pct=$4,
         max_drawdown_pct=$5,
         duration_minutes=ROUND(EXTRACT(EPOCH FROM (NOW()-created_at))/60),
         closed_at=NOW()
     WHERE id=$6`,
    [status, exitPrice ?? null, profitPct ?? null,
     maxProfitPct ?? null, maxDrawdownPct ?? null, id]
  );
}

/** Mark PENDING signals older than 48 h as EXPIRED. Called by the monitor. */
export async function expireOldSignals(): Promise<void> {
  const res = await pool.query<{ count: string }>(
    `WITH expired AS (
       UPDATE signals SET status='EXPIRED', closed_at=NOW()
       WHERE status='PENDING' AND created_at < NOW() - INTERVAL '48 hours'
       RETURNING id
     ) SELECT COUNT(*) AS count FROM expired`
  );
  const n = parseInt(res.rows[0]?.count ?? "0");
  if (n > 0) logger.info({ count: n }, "[signals] expired signals marked");
}

export async function getSignalById(id: number): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `SELECT id, asset, direction, status, quality_tier, score, confidence_score,
            confluence, market_regime, verdict, false_signal_risk,
            entry_price::FLOAT AS entry_price,
            tp::FLOAT AS tp,
            sl::FLOAT AS sl,
            exit_price::FLOAT AS exit_price,
            profit_pct::FLOAT AS profit_pct,
            max_profit_pct::FLOAT AS max_profit_pct,
            max_drawdown_pct::FLOAT AS max_drawdown_pct,
            rsi::FLOAT AS rsi,
            macd_histogram::FLOAT AS macd_histogram,
            ema50::FLOAT AS ema50,
            ema100::FLOAT AS ema100,
            ema200::FLOAT AS ema200,
            atr::FLOAT AS atr,
            volume_ratio::FLOAT AS volume_ratio,
            estimated_probability,
            duration_minutes,
            score_breakdown,
            confluence_factors,
            reason,
            created_at,
            closed_at
     FROM signals WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function getPendingSignalsByAsset(asset: string): Promise<
  Array<{ id: number; tp: number; sl: number; direction: string; entry_price: number }>
> {
  const res = await pool.query(
    `SELECT id,
            tp::FLOAT       AS tp,
            sl::FLOAT       AS sl,
            direction,
            entry_price::FLOAT AS entry_price
     FROM signals
     WHERE asset=$1 AND status='PENDING'
     ORDER BY created_at DESC LIMIT 10`,
    [asset]
  );
  return res.rows;
}

// ─── QUALITY FILTER ───────────────────────────────────────────────────────────

export async function getQualityFilter(): Promise<QualityFilterSettings> {
  try {
    const res = await pool.query<{ min_score: number; min_confidence: number; min_confluence: number }>(
      "SELECT min_score,min_confidence,min_confluence FROM quality_filter_settings WHERE id=1"
    );
    if (!res.rows.length) return { minScore: 70, minConfidence: 60, minConfluence: 4 };
    const r = res.rows[0];
    return { minScore: r.min_score, minConfidence: r.min_confidence, minConfluence: r.min_confluence };
  } catch (err) {
    logger.warn({ err }, "[signals] getQualityFilter failed, using defaults");
    return { minScore: 70, minConfidence: 60, minConfluence: 4 };
  }
}

export async function updateQualityFilter(
  settings: Partial<QualityFilterSettings>
): Promise<QualityFilterSettings> {
  const cur = await getQualityFilter();
  const next = { ...cur, ...settings };
  await pool.query(
    `INSERT INTO quality_filter_settings (id,min_score,min_confidence,min_confluence)
     VALUES (1,$1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET
       min_score=EXCLUDED.min_score,
       min_confidence=EXCLUDED.min_confidence,
       min_confluence=EXCLUDED.min_confluence`,
    [next.minScore, next.minConfidence, next.minConfluence]
  );
  return next;
}

// ─── GLOBAL STATS ─────────────────────────────────────────────────────────────

export async function getGlobalStats(): Promise<GlobalStats> {
  const res = await pool.query<{
    total: string; closed: string; pending: string;
    wins: string; losses: string; expired: string;
    avg_win_pct: string | null; avg_loss_pct: string | null;
    max_drawdown: string | null; avg_drawdown: string | null;
  }>(`
    SELECT
      COUNT(*)                                                      AS total,
      COUNT(*) FILTER (WHERE status IN ('WIN','LOSS','EXPIRED'))    AS closed,
      COUNT(*) FILTER (WHERE status='PENDING')                      AS pending,
      COUNT(*) FILTER (WHERE status='WIN')                          AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')                         AS losses,
      COUNT(*) FILTER (WHERE status='EXPIRED')                      AS expired,
      AVG(profit_pct)      FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win_pct,
      AVG(profit_pct)      FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss_pct,
      MIN(profit_pct)      FILTER (WHERE profit_pct IS NOT NULL)    AS max_drawdown,
      AVG(max_drawdown_pct) FILTER (WHERE max_drawdown_pct IS NOT NULL) AS avg_drawdown
    FROM signals
  `);
  const r = res.rows[0];
  const total   = parseInt(r.total)   || 0;
  const closed  = parseInt(r.closed)  || 0;
  const pending = parseInt(r.pending) || 0;
  const wins    = parseInt(r.wins)    || 0;
  const losses  = parseInt(r.losses)  || 0;
  const expired = parseInt(r.expired) || 0;
  const wc = wins + losses;
  const wr = wc > 0 ? Math.round((wins / wc) * 1000) / 10 : 0;
  const aw = parseFloat(r.avg_win_pct  ?? "0") || 0;
  const al = parseFloat(r.avg_loss_pct ?? "0") || 0;
  const pf = calcPF(wins, losses, aw, al);
  const avgReturn = Math.round(((aw * wins + al * losses) / Math.max(1, wc)) * 100) / 100;
  const avgDD     = Math.round((parseFloat(r.avg_drawdown ?? "0") || 0) * 100) / 100;
  const exp       = Math.round(((wr / 100) * aw - (1 - wr / 100) * Math.abs(al)) * 100) / 100;
  const maxDD     = Math.round((parseFloat(r.max_drawdown ?? "0") || 0) * 100) / 100;
  return {
    totalSignals: total, closedSignals: closed, pendingSignals: pending,
    wins, losses, expired, winRate: wr, profitFactor: pf,
    avgReturn, avgDrawdown: avgDD, expectancy: exp,
    avgRiskReward: 2.0, maxDrawdown: maxDD,
    roiTheoretical: Math.round(avgReturn * wc * 100) / 100,
  };
}

// ─── OPTIMISED RANGE STATS — single query per dimension ──────────────────────

export async function getStatsByScore(): Promise<StatRow[]> {
  const res = await pool.query<{
    rank: string; label: string;
    total: string; wins: string; losses: string;
    avg_win: string | null; avg_loss: string | null; avg_dd: string | null;
  }>(`
    SELECT
      CASE WHEN score>=90 THEN 1 WHEN score>=80 THEN 2
           WHEN score>=70 THEN 3 WHEN score>=60 THEN 4 ELSE 5 END AS rank,
      CASE WHEN score>=90 THEN 'Score 90-100' WHEN score>=80 THEN 'Score 80-89'
           WHEN score>=70 THEN 'Score 70-79'  WHEN score>=60 THEN 'Score 60-69'
           ELSE 'Score <60' END AS label,
      COUNT(*) FILTER (WHERE status IN ('WIN','LOSS'))                         AS total,
      COUNT(*) FILTER (WHERE status='WIN')                                     AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')                                    AS losses,
      AVG(profit_pct)      FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win,
      AVG(profit_pct)      FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss,
      AVG(max_drawdown_pct) FILTER (WHERE max_drawdown_pct IS NOT NULL)        AS avg_dd
    FROM signals
    GROUP BY rank, label
    ORDER BY rank
  `);
  return res.rows.map(r => rowToStat(r.label, r));
}

export async function getStatsByConfidence(): Promise<StatRow[]> {
  const res = await pool.query<{
    rank: string; label: string;
    total: string; wins: string; losses: string;
    avg_win: string | null; avg_loss: string | null; avg_dd: string | null;
  }>(`
    SELECT
      CASE WHEN confidence_score>80 THEN 1 WHEN confidence_score>=70 THEN 2
           WHEN confidence_score>=60 THEN 3 WHEN confidence_score>=50 THEN 4 ELSE 5 END AS rank,
      CASE WHEN confidence_score>80 THEN 'Confidence >80'
           WHEN confidence_score>=70 THEN 'Confidence 70-80'
           WHEN confidence_score>=60 THEN 'Confidence 60-70'
           WHEN confidence_score>=50 THEN 'Confidence 50-60'
           ELSE 'Confidence <50' END AS label,
      COUNT(*) FILTER (WHERE status IN ('WIN','LOSS'))                         AS total,
      COUNT(*) FILTER (WHERE status='WIN')                                     AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')                                    AS losses,
      AVG(profit_pct)      FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win,
      AVG(profit_pct)      FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss,
      AVG(max_drawdown_pct) FILTER (WHERE max_drawdown_pct IS NOT NULL)        AS avg_dd
    FROM signals
    GROUP BY rank, label
    ORDER BY rank
  `);
  return res.rows.map(r => rowToStat(r.label, r));
}

export async function getStatsByConfluence(): Promise<StatRow[]> {
  const res = await pool.query<{
    confluence: string;
    total: string; wins: string; losses: string;
    avg_win: string | null; avg_loss: string | null; avg_dd: string | null;
  }>(`
    SELECT
      confluence::TEXT,
      COUNT(*) FILTER (WHERE status IN ('WIN','LOSS'))                         AS total,
      COUNT(*) FILTER (WHERE status='WIN')                                     AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')                                    AS losses,
      AVG(profit_pct)      FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win,
      AVG(profit_pct)      FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss,
      AVG(max_drawdown_pct) FILTER (WHERE max_drawdown_pct IS NOT NULL)        AS avg_dd
    FROM signals
    WHERE status IN ('WIN','LOSS')
    GROUP BY confluence
    ORDER BY confluence DESC
  `);
  return res.rows.map(r =>
    rowToStat(`Confluenza ${parseInt(r.confluence)}/6`, r)
  );
}

export async function getStatsByRegime(): Promise<StatRow[]> {
  const res = await pool.query<{
    market_regime: string;
    total: string; wins: string; losses: string;
    avg_win: string | null; avg_loss: string | null; avg_dd: string | null;
  }>(`
    SELECT
      COALESCE(market_regime,'N/D') AS market_regime,
      COUNT(*) FILTER (WHERE status IN ('WIN','LOSS'))                         AS total,
      COUNT(*) FILTER (WHERE status='WIN')                                     AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')                                    AS losses,
      AVG(profit_pct)      FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win,
      AVG(profit_pct)      FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss,
      AVG(max_drawdown_pct) FILTER (WHERE max_drawdown_pct IS NOT NULL)        AS avg_dd
    FROM signals
    WHERE status IN ('WIN','LOSS')
    GROUP BY market_regime
    ORDER BY total DESC
  `);
  return res.rows.map(r => rowToStat(r.market_regime, r));
}

// ─── HISTORICAL CONTEXT (AUTO-LEARNING) ──────────────────────────────────────

export async function getHistoricalContext(
  score: number, confidence: number, confluence: number, direction: string
): Promise<HistoricalContext | null> {
  try {
    const res = await pool.query<{
      total: string; wins: string; losses: string;
      avg_win: string | null; avg_loss: string | null;
    }>(
      `SELECT
         COUNT(*)                                                           AS total,
         COUNT(*) FILTER (WHERE status='WIN')                              AS wins,
         COUNT(*) FILTER (WHERE status='LOSS')                             AS losses,
         AVG(profit_pct) FILTER (WHERE status='WIN'  AND profit_pct IS NOT NULL) AS avg_win,
         AVG(profit_pct) FILTER (WHERE status='LOSS' AND profit_pct IS NOT NULL) AS avg_loss
       FROM signals
       WHERE status IN ('WIN','LOSS')
         AND score            BETWEEN $1 AND $2
         AND confidence_score BETWEEN $3 AND $4
         AND ABS(confluence - $5) <= 1
         AND direction = $6`,
      [
        Math.max(0,   score      - 10), Math.min(100, score      + 10),
        Math.max(0,   confidence - 10), Math.min(100, confidence + 10),
        confluence, direction,
      ]
    );
    const r = res.rows[0];
    const total = parseInt(r.total) || 0;
    if (total < 3) return null;
    const w  = parseInt(r.wins)    || 0;
    const l  = parseInt(r.losses)  || 0;
    const aw = parseFloat(r.avg_win  ?? "0") || 0;
    const al = parseFloat(r.avg_loss ?? "0") || 0;
    const wr = Math.round((w / Math.max(1, w + l)) * 1000) / 10;
    return {
      totalCases: total, wins: w, winRate: wr,
      profitFactor: calcPF(w, l, aw, al),
      avgReturn: Math.round(((aw * w + al * l) / Math.max(1, w + l)) * 100) / 100,
      isValidated: total >= 100,
      dataLabel: total >= 100 ? "Validato" : "Preliminare",
    };
  } catch (err) {
    logger.warn({ err }, "[signals] getHistoricalContext failed");
    return null;
  }
}

// ─── LIST SIGNALS — single query with window count ───────────────────────────

export async function listSignals(
  limit = 50, offset = 0, status?: string, asset?: string
): Promise<{ signals: Record<string, unknown>[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (asset) {
    params.push(asset.toUpperCase());
    conditions.push(`asset=$${params.length}`);
  }
  if (status && status !== "ALL") {
    params.push(status);
    conditions.push(`status=$${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);
  const limitParam  = params.length - 1;
  const offsetParam = params.length;

  const res = await pool.query<Record<string, unknown> & { full_count: string }>(
    `SELECT
       id, asset, direction,
       entry_price::FLOAT  AS entry_price,
       tp::FLOAT           AS tp,
       sl::FLOAT           AS sl,
       score, confidence_score, estimated_probability,
       rsi::FLOAT          AS rsi,
       confluence, market_regime,
       verdict, false_signal_risk, status, qualified, quality_tier,
       profit_pct::FLOAT   AS profit_pct,
       exit_price::FLOAT   AS exit_price,
       duration_minutes, created_at, closed_at,
       COUNT(*) OVER()     AS full_count
     FROM signals
     ${where}
     ORDER BY created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  const total = res.rows.length > 0 ? (parseInt(res.rows[0].full_count as string) || 0) : 0;
  const signals = res.rows.map(({ full_count: _, ...rest }) => rest);
  return { signals, total };
}

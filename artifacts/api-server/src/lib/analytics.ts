import { pool } from "@workspace/db";

// ─── Equity & Profit Curve ────────────────────────────────────────────────────

export async function getEquityCurve(): Promise<
  { date: string; cumProfit: number; dailyProfit: number; wins: number; losses: number }[]
> {
  const res = await pool.query<{
    date: string; daily_profit: string; wins: string; losses: string;
  }>(`
    SELECT
      DATE(closed_at AT TIME ZONE 'UTC') AS date,
      SUM(profit_pct)::FLOAT              AS daily_profit,
      COUNT(*) FILTER (WHERE status='WIN')  AS wins,
      COUNT(*) FILTER (WHERE status='LOSS') AS losses
    FROM signals
    WHERE status IN ('WIN','LOSS') AND closed_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  let cum = 0;
  return res.rows.map(r => {
    const dp = parseFloat(r.daily_profit) || 0;
    cum += dp;
    return {
      date: r.date,
      dailyProfit: Math.round(dp * 100) / 100,
      cumProfit:   Math.round(cum * 100) / 100,
      wins:        parseInt(r.wins) || 0,
      losses:      parseInt(r.losses) || 0,
    };
  });
}

// ─── Rolling window (every N closed signals) ──────────────────────────────────

export async function getRollingMetrics(window = 20): Promise<
  { idx: number; asset: string; date: string; winRate: number; profitFactor: number; avgReturn: number }[]
> {
  const res = await pool.query<{
    rn: string; asset: string; closed_at: string;
    profit_pct: string; status: string;
  }>(`
    SELECT
      ROW_NUMBER() OVER (ORDER BY closed_at ASC) AS rn,
      asset,
      closed_at::TEXT,
      profit_pct::FLOAT AS profit_pct,
      status
    FROM signals
    WHERE status IN ('WIN','LOSS') AND closed_at IS NOT NULL
    ORDER BY closed_at ASC
  `);

  const rows = res.rows;
  const result: { idx: number; asset: string; date: string; winRate: number; profitFactor: number; avgReturn: number }[] = [];

  for (let i = window - 1; i < rows.length; i++) {
    const slice = rows.slice(i - window + 1, i + 1);
    const wins   = slice.filter(r => r.status === "WIN");
    const losses = slice.filter(r => r.status === "LOSS");
    const grossWin  = wins.reduce((s, r)  => s + Math.max(0, r.profit_pct),  0);
    const grossLoss = losses.reduce((s, r) => s + Math.abs(Math.min(0, r.profit_pct)), 0);
    const pf = grossLoss > 0 ? grossWin / grossLoss : wins.length > 0 ? 9.99 : 0;

    result.push({
      idx:          i + 1,
      asset:        rows[i].asset,
      date:         rows[i].closed_at.slice(0, 10),
      winRate:      Math.round((wins.length / window) * 1000) / 10,
      profitFactor: Math.round(pf * 100) / 100,
      avgReturn:    Math.round((slice.reduce((s, r) => s + r.profit_pct, 0) / window) * 100) / 100,
    });
  }

  return result;
}

// ─── Distributions ────────────────────────────────────────────────────────────

interface DistributionBucket { label: string; total: number; wins: number; losses: number; winRate: number }

function mkBuckets(edges: number[], label: (lo: number, hi: number) => string): DistributionBucket[] {
  return edges.slice(0, -1).map((lo, i) => ({
    label: label(lo, edges[i + 1]),
    total: 0, wins: 0, losses: 0, winRate: 0,
  }));
}

export async function getScoreDistribution(): Promise<DistributionBucket[]> {
  const edges = [0, 50, 60, 70, 75, 80, 85, 90, 100, 101];
  const buckets = mkBuckets(edges, (lo, hi) => `${lo}–${Math.min(hi - 1, 100)}`);

  const res = await pool.query<{ score: string; status: string }>(
    `SELECT score::INT AS score, status FROM signals WHERE status IN ('WIN','LOSS')`
  );
  for (const r of res.rows) {
    const s = parseInt(r.score);
    const bi = edges.findIndex((e, i) => s >= e && s < edges[i + 1]);
    if (bi >= 0) {
      buckets[bi].total++;
      if (r.status === "WIN")  buckets[bi].wins++;
      if (r.status === "LOSS") buckets[bi].losses++;
    }
  }
  buckets.forEach(b => { b.winRate = b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0; });
  return buckets;
}

export async function getConfidenceDistribution(): Promise<DistributionBucket[]> {
  const edges = [0, 50, 60, 65, 70, 75, 80, 85, 90, 101];
  const buckets = mkBuckets(edges, (lo, hi) => `${lo}–${Math.min(hi - 1, 100)}%`);

  const res = await pool.query<{ cs: string; status: string }>(
    `SELECT confidence_score::INT AS cs, status FROM signals WHERE status IN ('WIN','LOSS')`
  );
  for (const r of res.rows) {
    const s = parseInt(r.cs);
    const bi = edges.findIndex((e, i) => s >= e && s < edges[i + 1]);
    if (bi >= 0) {
      buckets[bi].total++;
      if (r.status === "WIN")  buckets[bi].wins++;
      if (r.status === "LOSS") buckets[bi].losses++;
    }
  }
  buckets.forEach(b => { b.winRate = b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0; });
  return buckets;
}

export async function getConfluenceDistribution(): Promise<DistributionBucket[]> {
  const res = await pool.query<{ c: string; status: string }>(
    `SELECT confluence::INT AS c, status FROM signals WHERE status IN ('WIN','LOSS')`
  );
  const buckets: DistributionBucket[] = Array.from({ length: 7 }, (_, i) => ({
    label: `${i}/6`, total: 0, wins: 0, losses: 0, winRate: 0,
  }));
  for (const r of res.rows) {
    const c = Math.max(0, Math.min(6, parseInt(r.c)));
    buckets[c].total++;
    if (r.status === "WIN")  buckets[c].wins++;
    if (r.status === "LOSS") buckets[c].losses++;
  }
  buckets.forEach(b => { b.winRate = b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0; });
  return buckets;
}

export async function getRegimeDistribution(): Promise<DistributionBucket[]> {
  const res = await pool.query<{ regime: string; status: string }>(
    `SELECT COALESCE(market_regime,'Sconosciuto') AS regime, status
     FROM signals WHERE status IN ('WIN','LOSS')`
  );
  const map = new Map<string, DistributionBucket>();
  for (const r of res.rows) {
    if (!map.has(r.regime)) map.set(r.regime, { label: r.regime, total: 0, wins: 0, losses: 0, winRate: 0 });
    const b = map.get(r.regime)!;
    b.total++;
    if (r.status === "WIN")  b.wins++;
    if (r.status === "LOSS") b.losses++;
  }
  const result = [...map.values()].sort((a, b) => b.total - a.total);
  result.forEach(b => { b.winRate = b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0; });
  return result;
}

export async function getTierDistribution(): Promise<DistributionBucket[]> {
  const res = await pool.query<{ tier: string; status: string }>(
    `SELECT COALESCE(quality_tier,'NESSUNO') AS tier, status
     FROM signals WHERE status IN ('WIN','LOSS')`
  );
  const ORDER = ["ELITE", "FORTE", "NORMALE", "NESSUNO"];
  const map = new Map<string, DistributionBucket>();
  for (const r of res.rows) {
    if (!map.has(r.tier)) map.set(r.tier, { label: r.tier, total: 0, wins: 0, losses: 0, winRate: 0 });
    const b = map.get(r.tier)!;
    b.total++;
    if (r.status === "WIN")  b.wins++;
    if (r.status === "LOSS") b.losses++;
  }
  const result = ORDER.map(t => map.get(t)).filter(Boolean) as DistributionBucket[];
  result.forEach(b => { b.winRate = b.total > 0 ? Math.round((b.wins / b.total) * 1000) / 10 : 0; });
  return result;
}

// ─── Per-asset performance ────────────────────────────────────────────────────

export async function getPerformanceByAsset(): Promise<{
  asset: string; total: number; wins: number; losses: number;
  winRate: number; avgReturn: number; profitFactor: number;
}[]> {
  const res = await pool.query<{
    asset: string; total: string; wins: string; losses: string;
    avg_win: string; avg_loss: string;
  }>(`
    SELECT
      asset,
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE status='WIN')            AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')           AS losses,
      AVG(profit_pct) FILTER (WHERE status='WIN')    AS avg_win,
      AVG(profit_pct) FILTER (WHERE status='LOSS')   AS avg_loss
    FROM signals
    WHERE status IN ('WIN','LOSS')
    GROUP BY asset
    ORDER BY total DESC
    LIMIT 30
  `);

  return res.rows.map(r => {
    const t  = parseInt(r.total)  || 0;
    const w  = parseInt(r.wins)   || 0;
    const l  = parseInt(r.losses) || 0;
    const aw = parseFloat(r.avg_win  ?? "0") || 0;
    const al = parseFloat(r.avg_loss ?? "0") || 0;
    const gw = w * Math.max(0, aw);
    const gl = l * Math.abs(Math.min(0, al));
    return {
      asset:        r.asset,
      total:        t,
      wins:         w,
      losses:       l,
      winRate:      t > 0 ? Math.round((w / t) * 1000) / 10 : 0,
      avgReturn:    Math.round(((aw * w + al * l) / Math.max(1, t)) * 100) / 100,
      profitFactor: gl > 0 ? Math.round((gw / gl) * 100) / 100 : (w > 0 ? 9.99 : 0),
    };
  });
}

// ─── Heatmap: day of week + hour of day ──────────────────────────────────────

export async function getHeatmap(): Promise<{
  byDow: { dow: number; label: string; wins: number; losses: number; winRate: number }[];
  byHour: { hour: number; wins: number; losses: number; winRate: number }[];
}> {
  const res = await pool.query<{ dow: string; hour: string; status: string }>(`
    SELECT
      EXTRACT(DOW  FROM created_at AT TIME ZONE 'UTC')::INT AS dow,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::INT AS hour,
      status
    FROM signals
    WHERE status IN ('WIN','LOSS')
  `);

  const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const byDow  = Array.from({ length: 7  }, (_, i) => ({ dow: i, label: DAYS[i], wins: 0, losses: 0, winRate: 0 }));
  const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, wins: 0, losses: 0, winRate: 0 }));

  for (const r of res.rows) {
    const d = parseInt(r.dow);
    const h = parseInt(r.hour);
    if (r.status === "WIN")  { byDow[d].wins++; byHour[h].wins++;  }
    if (r.status === "LOSS") { byDow[d].losses++; byHour[h].losses++; }
  }

  [byDow, byHour].forEach(arr =>
    arr.forEach((b: { wins: number; losses: number; winRate: number }) => {
      const t = b.wins + b.losses;
      b.winRate = t > 0 ? Math.round((b.wins / t) * 1000) / 10 : 0;
    })
  );

  return { byDow, byHour };
}

// ─── Scatter data ─────────────────────────────────────────────────────────────

export async function getScatterData(): Promise<{
  id: number; asset: string; direction: string; status: string;
  score: number; confidence: number; confluence: number; profit: number;
}[]> {
  const res = await pool.query<{
    id: string; asset: string; direction: string; status: string;
    score: string; confidence: string; confluence: string; profit: string;
  }>(`
    SELECT id, asset, direction, status,
           score::INT AS score,
           confidence_score::INT AS confidence,
           confluence::INT AS confluence,
           profit_pct::FLOAT AS profit
    FROM signals
    WHERE status IN ('WIN','LOSS') AND profit_pct IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 500
  `);

  return res.rows.map(r => ({
    id:         parseInt(r.id),
    asset:      r.asset,
    direction:  r.direction,
    status:     r.status,
    score:      parseInt(r.score),
    confidence: parseInt(r.confidence),
    confluence: parseInt(r.confluence),
    profit:     Math.round(parseFloat(r.profit) * 100) / 100,
  }));
}

// ─── Direction comparison ─────────────────────────────────────────────────────

export async function getDirectionComparison(): Promise<{
  direction: string; total: number; wins: number; losses: number;
  winRate: number; avgReturn: number;
}[]> {
  const res = await pool.query<{
    direction: string; total: string; wins: string; losses: string; avg_ret: string;
  }>(`
    SELECT
      direction,
      COUNT(*)                                      AS total,
      COUNT(*) FILTER (WHERE status='WIN')           AS wins,
      COUNT(*) FILTER (WHERE status='LOSS')          AS losses,
      AVG(profit_pct)::FLOAT                         AS avg_ret
    FROM signals
    WHERE status IN ('WIN','LOSS')
    GROUP BY direction
    ORDER BY total DESC
  `);

  return res.rows.map(r => ({
    direction: r.direction,
    total:     parseInt(r.total)  || 0,
    wins:      parseInt(r.wins)   || 0,
    losses:    parseInt(r.losses) || 0,
    winRate:   parseInt(r.total) > 0 ? Math.round((parseInt(r.wins) / parseInt(r.total)) * 1000) / 10 : 0,
    avgReturn: Math.round((parseFloat(r.avg_ret) || 0) * 100) / 100,
  }));
}

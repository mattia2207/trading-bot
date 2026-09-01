---
name: Signal system architecture
description: Design decisions for the DB-backed signal tracking and auto-learning system in Advisor Bot Terminal
---

## Quality Tiers
ELITE: score≥85, confidence≥70, confluence≥5
FORTE: score≥75, confidence≥65
NORMALE: score≥70, confidence≥60

## Confluence (6 factors)
Trend (price vs EMA200), MACD alignment, Volume, Structure, MTF (score≥8), Momentum (RSI zone).
Stored as integer 0–6 in `signals.confluence` column.

## Market Regime
Computed from atrRatio + EMA stack alignment. Values (Italian): Alta Volatilità, Bassa Volatilità, Trend Forte Rialzista, Trend Forte Ribassista, Laterale, Trend Debole Rialzista, Trend Debole Ribassista.

## Persistence and execution boundary
Operational state is persisted in PostgreSQL through Drizzle-managed schema changes; runtime DDL is not part of startup. Execution defaults to Paper and the only exchange adapter is explicitly gated Binance Spot Testnet.

**Why:** Startup DDL caused deployment failures when the managed database endpoint was unavailable, while a fail-closed broker boundary prevents accidental exchange requests.

**How to apply:** Keep schema changes in Drizzle migrations/push workflows, and require both testnet mode flags plus both Binance credentials before constructing an exchange request.

## Signal Persistence
Every call to `/api/analysis/:ticker` and POST `/api/trades` runs `persistSignal()` (fire-and-forget). Telegram alerts only sent for qualified signals (tier != null).

## Auto-learning thresholds
30 closed trades = preliminary stats shown. 100 closed trades = validated label shown in UI. Labels shown in SignalStats globale tab.

## Frontend endpoints (signal stats)
`/api/signals/stats/global` — global stats
`/api/signals/stats/score` — by score range
`/api/signals/stats/confidence` — by confidence range  
`/api/signals/stats/confluence` — by confluence count
`/api/signals/stats/regime` — by market regime
`/api/signals` — paginated list (limit/offset)
`/api/signals/quality-filter` — GET/PATCH

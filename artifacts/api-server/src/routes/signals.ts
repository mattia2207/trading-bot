import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getGlobalStats, getStatsByScore, getStatsByConfidence,
  getStatsByConfluence, getStatsByRegime,
  listSignals, getQualityFilter, updateQualityFilter, updateSignalStatus,
  getSignalById,
} from "../lib/signals.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const ListSignalsQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["ALL", "PENDING", "WIN", "LOSS", "EXPIRED"]).optional(),
  asset:  z.string().max(20).optional(),
});

const PatchStatusBody = z.object({
  status:         z.enum(["WIN", "LOSS", "EXPIRED"]),
  exitPrice:      z.number().finite().optional(),
  profitPct:      z.number().finite().optional(),
  maxProfitPct:   z.number().finite().optional(),
  maxDrawdownPct: z.number().finite().optional(),
});

const PatchFilterBody = z.object({
  minScore:      z.number().int().min(0).max(100).optional(),
  minConfidence: z.number().int().min(0).max(100).optional(),
  minConfluence: z.number().int().min(0).max(6).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleStats(
  name: string, fn: () => Promise<unknown>,
  res: import("express").Response
) {
  try {
    const data = await fn();
    res.json(data);
  } catch (err) {
    logger.error({ err }, `[signals] ${name} error`);
    res.status(500).json({ error: `Errore statistiche ${name}` });
  }
}

// ─── Stats endpoints ──────────────────────────────────────────────────────────

router.get("/signals/stats/global",     (_req, res) => handleStats("global",     getGlobalStats,       res));
router.get("/signals/stats/score",      (_req, res) => handleStats("score",      getStatsByScore,      res));
router.get("/signals/stats/confidence", (_req, res) => handleStats("confidence", getStatsByConfidence, res));
router.get("/signals/stats/confluence", (_req, res) => handleStats("confluence", getStatsByConfluence, res));
router.get("/signals/stats/regime",     (_req, res) => handleStats("regime",     getStatsByRegime,     res));

// ─── Signal list ──────────────────────────────────────────────────────────────

router.get("/signals", async (req, res) => {
  const parsed = ListSignalsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parametri non validi", details: parsed.error.flatten() });
    return;
  }
  try {
    const { limit, offset, status, asset } = parsed.data;
    const result = await listSignals(limit, offset, status, asset);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "[signals] listSignals error");
    res.status(500).json({ error: "Errore lista segnali" });
  }
});

// ─── Quality filter (must be registered BEFORE /signals/:id) ─────────────────

router.get("/signals/quality-filter", async (_req, res) => {
  try {
    res.json(await getQualityFilter());
  } catch (err) {
    logger.error({ err }, "[signals] getQualityFilter error");
    res.status(500).json({ error: "Errore filtro qualità" });
  }
});

router.patch("/signals/quality-filter", async (req, res) => {
  const parsed = PatchFilterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valori filtro non validi", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json(await updateQualityFilter(parsed.data));
  } catch (err) {
    logger.error({ err }, "[signals] updateQualityFilter error");
    res.status(500).json({ error: "Errore aggiornamento filtro" });
  }
});

// ─── Signal detail ────────────────────────────────────────────────────────────

router.get("/signals/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  try {
    const signal = await getSignalById(id);
    if (!signal) { res.status(404).json({ error: "Segnale non trovato" }); return; }
    res.json(signal);
  } catch (err) {
    logger.error({ err, id }, "[signals] getSignalById error");
    res.status(500).json({ error: "Errore recupero segnale" });
  }
});

// ─── Update signal status ─────────────────────────────────────────────────────

router.patch("/signals/:id/status", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID segnale non valido" });
    return;
  }
  const parsed = PatchStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.flatten() });
    return;
  }
  try {
    const { status, exitPrice, profitPct, maxProfitPct, maxDrawdownPct } = parsed.data;
    await updateSignalStatus(id, status, exitPrice, profitPct, maxProfitPct, maxDrawdownPct);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "[signals] updateSignalStatus error");
    res.status(500).json({ error: "Errore aggiornamento stato" });
  }
});

export default router;

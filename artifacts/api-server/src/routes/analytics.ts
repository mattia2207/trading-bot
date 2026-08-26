import { Router, type IRouter } from "express";
import {
  getEquityCurve, getRollingMetrics,
  getScoreDistribution, getConfidenceDistribution,
  getConfluenceDistribution, getRegimeDistribution, getTierDistribution,
  getPerformanceByAsset, getHeatmap, getScatterData, getDirectionComparison,
} from "../lib/analytics.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function wrap(name: string, fn: () => Promise<unknown>) {
  return async (_: unknown, res: import("express").Response) => {
    try {
      res.json(await fn());
    } catch (err) {
      logger.error({ err }, `[analytics] ${name}`);
      (res as import("express").Response).status(500).json({ error: `Errore ${name}` });
    }
  };
}

router.get("/analytics/equity-curve",    wrap("equity-curve",    getEquityCurve));
router.get("/analytics/rolling",          wrap("rolling",          () => getRollingMetrics(20)));
router.get("/analytics/dist/score",       wrap("dist-score",       getScoreDistribution));
router.get("/analytics/dist/confidence",  wrap("dist-confidence",  getConfidenceDistribution));
router.get("/analytics/dist/confluence",  wrap("dist-confluence",  getConfluenceDistribution));
router.get("/analytics/dist/regime",      wrap("dist-regime",      getRegimeDistribution));
router.get("/analytics/dist/tier",        wrap("dist-tier",        getTierDistribution));
router.get("/analytics/by-asset",         wrap("by-asset",         getPerformanceByAsset));
router.get("/analytics/heatmap",          wrap("heatmap",          getHeatmap));
router.get("/analytics/scatter",          wrap("scatter",          getScatterData));
router.get("/analytics/direction",        wrap("direction",        getDirectionComparison));

export default router;

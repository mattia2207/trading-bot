import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getSettings, updateSettings, updateKillSwitch, listPositions,
  listOrders, listFills, listAuditEvents, testnetConfigured,
  approveLongSignal,
} from "../lib/platform.js";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const user = (req: import("express").Request) => req.userId!;

const settingsBody = z.object({
  riskPerTradePct: z.number().min(0.01).max(1).optional(),
  maxExposurePct: z.number().min(0.01).max(100).optional(),
  maxOpenPositions: z.number().int().min(1).max(2).optional(),
  maxDailyTrades: z.number().int().min(1).max(3).optional(),
  maxDailyLossPct: z.number().min(0.01).max(2).optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  minRewardRisk: z.number().min(1.5).max(20).optional(),
  paperStartingBalance: z.number().positive().optional(),
  telegramChatId: z.string().max(128).nullable().optional(),
}).strict();

router.get("/platform/status", async (req, res, next) => {
  try {
    const settings = await getSettings(user(req));
    const dbUp = true;
    res.json({
      executionMode: settings.executionMode,
      testnetEnabled: settings.testnetEnabled,
      testnetConfigured: testnetConfigured(),
      killSwitchActive: settings.killSwitchActive,
      apiStatus: "up",
      websocketStatus: "unavailable",
      databaseStatus: dbUp ? "up" : "down",
      manualApprovalRequired: true,
      spotOnly: true,
      longOnly: true,
    });
  } catch (error) { next(error); }
});

router.get("/platform/settings", async (req, res, next) => {
  try { res.json(await getSettings(user(req))); } catch (error) { next(error); }
});

router.patch("/platform/settings", async (req, res, next) => {
  const parsed = settingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Impostazioni non valide", details: parsed.error.flatten() }); return; }
  try { res.json(await updateSettings(user(req), parsed.data)); } catch (error) { next(error); }
});

router.patch("/platform/kill-switch", async (req, res, next) => {
  const parsed = z.object({ active: z.boolean(), reason: z.string().nullable().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Payload kill switch non valido" }); return; }
  try {
    const settings = await updateKillSwitch(user(req), parsed.data.active, parsed.data.reason ?? null);
    res.json({ active: settings.killSwitchActive, reason: settings.killSwitchReason, updatedAt: settings.updatedAt });
  } catch (error) { next(error); }
});

router.get("/platform/positions", async (req, res, next) => {
  try { res.json(await listPositions(user(req))); } catch (error) { next(error); }
});
router.get("/platform/orders", async (req, res, next) => {
  try { res.json(await listOrders(user(req))); } catch (error) { next(error); }
});
router.get("/platform/fills", async (req, res, next) => {
  try { res.json(await listFills(user(req))); } catch (error) { next(error); }
});
router.get("/platform/audit", async (req, res, next) => {
  try { res.json(await listAuditEvents(user(req))); } catch (error) { next(error); }
});

router.post("/signals/:id/approve", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID segnale non valido" }); return; }
  try {
    const result = await approveLongSignal(user(req), id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Approvazione rifiutata" });
  }
});

export default router;
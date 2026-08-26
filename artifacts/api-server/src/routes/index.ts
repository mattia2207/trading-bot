import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradingRouter from "./trading";
import signalsRouter from "./signals";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(signalsRouter);
router.use(analyticsRouter);
router.use(tradingRouter);

export default router;

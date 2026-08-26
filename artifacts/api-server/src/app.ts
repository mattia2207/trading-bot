import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ─── CORS — restrict to same-origin proxy ────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl) and same-host proxy
    if (!origin || origin.includes("replit.dev") || origin.includes("localhost")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppe richieste. Riprova tra un minuto." },
  skip: (req) => req.url === "/api/health",
});

const analysisLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite analisi raggiunte (10/min). Attendere." },
});

app.use(globalLimiter);
app.use("/api/analysis", analysisLimiter);
app.use("/api/trades", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") return analysisLimiter(req, res, next);
  next();
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Errore interno del server" });
});

export default app;

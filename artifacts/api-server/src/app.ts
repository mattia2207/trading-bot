import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";

const app: Express = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

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

// Clerk's production proxy must be mounted before body parsers.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ─── CORS — restrict to same-origin proxy ────────────────────────────────────
app.use(cors({
  credentials: true,
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
  skip: (req) => req.url === "/api/healthz",
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
  if (req.method === "POST") {
    analysisLimiter(req, res, next);
    return;
  }
  next();
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Errore interno del server" });
});

export default app;

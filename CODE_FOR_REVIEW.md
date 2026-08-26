# Codice sorgente per revisione

Questo documento raccoglie i file necessari al funzionamento dell’app. Dipendenze installate, cache, asset binari, mockup non runtime e segreti sono esclusi.

## PERCORSO: .replit
```text
modules = ["nodejs-24"]

[deployment]
router = "application"
deploymentTarget = "autoscale"

[deployment.postBuild]
args = ["pnpm", "store", "prune"]
env = { "CI" = "true" }

[workflows]
runButton = "Project"

[agent]
stack = "PNPM_WORKSPACE"
expertMode = true

[postMerge]
path = "scripts/post-merge.sh"
timeoutMs = 20000

[[ports]]
localPort = 8080
externalPort = 8080

[[ports]]
localPort = 8081
externalPort = 80

[[ports]]
localPort = 8082
externalPort = 3002

[[ports]]
localPort = 8083
externalPort = 3001

[[ports]]
localPort = 8084
externalPort = 3003

[[ports]]
localPort = 8085
externalPort = 4200

[[ports]]
localPort = 8086
externalPort = 5000

[[ports]]
localPort = 24210
externalPort = 3000
```

## PERCORSO: artifacts/api-server/.replit-artifact/artifact.toml
```toml
kind = "api"
previewPath = "/api" # TODO - should be excluded from preview in the first place
title = "API Server"
version = "1.0.0"
id = "3B4_FFSkEVBkAeYMFRJ2e"

[[services]]
localPort = 8080
name = "API Server"
paths = ["/api"]

[services.development]
run = "pnpm --filter @workspace/api-server run dev"

[services.production]

[services.production.build]
args = ["pnpm", "--filter", "@workspace/api-server", "run", "build"]

[services.production.build.env]
NODE_ENV = "production"

[services.production.run]
# we don't run through pnpm to make startup faster in production
args = ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

[services.production.run.env]
PORT = "8080"
NODE_ENV = "production"

[services.production.health.startup]
path = "/api/healthz"
```

## PERCORSO: artifacts/api-server/build.mjs
```javascript
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## PERCORSO: artifacts/api-server/package.json
```json
{
  "name": "@workspace/api-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "export NODE_ENV=development && pnpm run build && pnpm run start",
    "build": "node ./build.mjs",
    "start": "node --enable-source-maps ./dist/index.mjs",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@workspace/api-zod": "workspace:*",
    "@workspace/db": "workspace:*",
    "axios": "^1.16.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "drizzle-orm": "catalog:",
    "express": "^5.2.1",
    "express-rate-limit": "^8.5.2",
    "helmet": "^8.2.0",
    "pino": "^9.14.0",
    "pino-http": "^10.5.0",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/express-rate-limit": "^6.0.2",
    "@types/node": "catalog:",
    "esbuild": "0.28.1",
    "esbuild-plugin-pino": "^2.3.3",
    "pino-pretty": "^13.1.3",
    "thread-stream": "3.1.0"
  }
}
```

## PERCORSO: artifacts/api-server/src/app.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/index.ts
```ts
import app from "./app";
import { logger } from "./lib/logger";
import { startTelegramMonitor } from "./lib/telegram.js";
import { initSignalsSchema } from "./lib/signals.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await initSignalsSchema();
  } catch (dbErr) {
    logger.error({ err: dbErr }, "DB schema init failed — continuing without DB");
  }

  startTelegramMonitor();
});
```

## PERCORSO: artifacts/api-server/src/lib/analysis.ts
```ts
import axios from "axios";

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY ?? "";

interface OHLCRow {
  open: string;
  high: string;
  low: string;
  close: string;
  datetime: string;
  volume?: string;
}

interface TwelveDataResponse {
  values?: OHLCRow[];
  status?: string;
  message?: string;
}

export interface ScoreBreakdown {
  trend: number;       // 0-30
  momentum: number;   // 0-20
  volatility: number; // 0-10
  volume: number;     // 0-15
  structure: number;  // 0-15
  multiTimeframe: number; // 0-10
}

export interface MtfAnalysis {
  m15: string;
  h1: string;
  h4: string;
  daily: string;
}

export interface ConfluenceFactors {
  trend: boolean;
  macd: boolean;
  volume: boolean;
  structure: boolean;
  mtf: boolean;
  momentum: boolean;
}

export interface AnalysisData {
  ticker: string;
  price: number;
  score: number;
  signal: "BUY" | "WAIT";
  direction: "LONG" | "SHORT" | "WAIT";
  verdict: "FORTE_BUY" | "BUY" | "NEUTRALE" | "SELL" | "FORTE_SELL";
  reason: string;
  tp: number;
  sl: number;
  atr: number;
  ema50: number;
  ema100: number;
  ema200: number;
  rsi: number;
  macdHistogram: number;
  volumeRatio: number;
  falseSignalRisk: "Basso" | "Medio" | "Alto";
  confidenceScore: number;
  estimatedProbability: number;
  scoreBreakdown: ScoreBreakdown;
  confluenceFactors: ConfluenceFactors;
  mtfAnalysis: MtfAnalysis;
  invalidationConditions: string[];
  confluence: number;
  marketRegime: string;
}

// ─── MATH HELPERS ────────────────────────────────────────────────────────────

function calcEMA(values: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const ema: number[] = [];
  for (let i = 0; i < values.length; i++) {
    ema.push(i === 0 ? values[0] : values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function lastEMA(values: number[], span: number): number {
  return calcEMA(values, span).at(-1) ?? values.at(-1) ?? 0;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const deltas = closes.slice(1).map((v, i) => v - closes[i]);
  let avgGain = deltas.slice(0, period).reduce((s, d) => s + (d > 0 ? d : 0), 0) / period;
  let avgLoss = deltas.slice(0, period).reduce((s, d) => s + (d < 0 ? -d : 0), 0) / period;
  for (let i = period; i < deltas.length; i++) {
    const g = deltas[i] > 0 ? deltas[i] : 0;
    const l = deltas[i] < 0 ? -deltas[i] : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const pc = closes[i - 1];
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - pc), Math.abs(lows[i] - pc)));
  }
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const last = macdLine.length - 1;
  const macd = macdLine[last] ?? 0;
  const signal = signalLine[last] ?? 0;
  return { macd, signal, histogram: macd - signal };
}

// ─── PRICE STRUCTURE ─────────────────────────────────────────────────────────

interface Structure {
  type: "Rialzista" | "Ribassista" | "Laterale";
  description: string;
  lastSupport: number;
  lastResistance: number;
  higherHighs: boolean;
  higherLows: boolean;
}

function detectStructure(closes: number[], highs: number[], lows: number[]): Structure {
  const n = Math.min(closes.length, 20);
  const recentHighs = highs.slice(-n);
  const recentLows = lows.slice(-n);

  // Find local pivot highs and lows (simplified: compare every 3 candles)
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  for (let i = 1; i < recentHighs.length - 1; i++) {
    if (recentHighs[i] > recentHighs[i - 1] && recentHighs[i] > recentHighs[i + 1]) {
      pivotHighs.push(recentHighs[i]);
    }
    if (recentLows[i] < recentLows[i - 1] && recentLows[i] < recentLows[i + 1]) {
      pivotLows.push(recentLows[i]);
    }
  }

  // HH/HL detection
  const higherHighs = pivotHighs.length >= 2
    ? pivotHighs.at(-1)! > pivotHighs.at(-2)!
    : false;
  const higherLows = pivotLows.length >= 2
    ? pivotLows.at(-1)! > pivotLows.at(-2)!
    : false;
  const lowerHighs = pivotHighs.length >= 2
    ? pivotHighs.at(-1)! < pivotHighs.at(-2)!
    : false;
  const lowerLows = pivotLows.length >= 2
    ? pivotLows.at(-1)! < pivotLows.at(-2)!
    : false;

  const lastSupport = pivotLows.at(-1) ?? Math.min(...recentLows);
  const lastResistance = pivotHighs.at(-1) ?? Math.max(...recentHighs);

  let type: Structure["type"] = "Laterale";
  let description = "";

  if (higherHighs && higherLows) {
    type = "Rialzista";
    description = "Higher High + Higher Low: struttura rialzista in progressione. Trade LONG in favore della struttura.";
  } else if (lowerHighs && lowerLows) {
    type = "Ribassista";
    description = "Lower High + Lower Low: struttura ribassista in progressione. Trade SHORT in favore della struttura.";
  } else if (higherHighs && lowerLows) {
    type = "Laterale";
    description = "Higher High + Lower Low: struttura espansiva (broadening). Segnale misto — cautela.";
  } else if (lowerHighs && higherLows) {
    type = "Laterale";
    description = "Lower High + Higher Low: struttura compressiva (wedge/triangle). Breakout imminente — direzione incerta.";
  } else {
    type = "Laterale";
    description = "Struttura laterale senza pattern direzionale chiaro. Attendere rottura.";
  }

  return { type, description, lastSupport, lastResistance, higherHighs, higherLows };
}

// ─── TIMEFRAME TREND ─────────────────────────────────────────────────────────

function calcTimeframeTrend(values: OHLCRow[]): string {
  if (!values || values.length < 26) return "Neutrale";
  const rows = [...values].reverse();
  const closes = rows.map((r) => parseFloat(r.close));
  const price = closes.at(-1) ?? 0;
  const ema200 = lastEMA(closes, Math.min(200, closes.length));
  const ema50 = lastEMA(closes, Math.min(50, closes.length));
  const rsi = calcRSI(closes);

  if (price > ema200 && price > ema50 && rsi > 55) return "Rialzista";
  if (price > ema200 && price > ema50) return "Debolmente Rialzista";
  if (price < ema200 && price < ema50 && rsi < 45) return "Ribassista";
  if (price < ema200 && price < ema50) return "Debolmente Ribassista";
  return "Neutrale";
}

function mtfScore(mtf: MtfAnalysis, direction: "LONG" | "SHORT" | "WAIT"): number {
  const tfValues = [mtf.m15, mtf.h1, mtf.h4, mtf.daily];
  if (direction === "WAIT") return 5;
  let aligned = 0;
  for (const tf of tfValues) {
    if (direction === "LONG" && tf.includes("Rialzista")) aligned++;
    if (direction === "SHORT" && tf.includes("Ribassista")) aligned++;
  }
  // 4/4 aligned = 10, 3/4 = 8, 2/4 = 5, 1/4 = 2, 0/4 = 0
  return [0, 2, 5, 8, 10][aligned] ?? 0;
}

// ─── PRICE FORMAT ────────────────────────────────────────────────────────────

function fp(val: number): string {
  const abs = Math.abs(val);
  const dec = abs >= 10000 ? 2 : abs >= 1000 ? 2 : abs >= 100 ? 3 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return val.toFixed(dec);
}

// ─── NORMALISE SYMBOL ────────────────────────────────────────────────────────

function normalizeSymbol(ticker: string): string {
  return ticker
    .replace("-", "/")
    .replace(/\/USDT$/i, "/USD")
    .replace(/\/BUSD$/i, "/USD")
    .replace(/\/USDC$/i, "/USD");
}

// ─── SYMBOL SEARCH ───────────────────────────────────────────────────────────

export interface SymbolMatch {
  symbol: string;
  instrumentName: string;
  exchange: string | null;
  country: string | null;
  instrumentType: string | null;
  currency: string | null;
}

export interface SymbolSearchOutcome {
  matches: SymbolMatch[];
  providerLimited: boolean;
  note: string | null;
}

interface TwelveDataSymbolSearchRow {
  symbol: string;
  instrument_name: string;
  exchange?: string;
  country?: string;
  instrument_type?: string;
  currency?: string;
}

interface TwelveDataSymbolSearchResponse {
  data?: TwelveDataSymbolSearchRow[];
  status?: string;
  message?: string;
}

export async function searchSymbols(query: string): Promise<SymbolSearchOutcome> {
  if (!TWELVE_DATA_KEY) {
    return { matches: [], providerLimited: true, note: "Chiave provider dati non configurata." };
  }
  try {
    const { data } = await axios.get<TwelveDataSymbolSearchResponse>(
      "https://api.twelvedata.com/symbol_search",
      { params: { symbol: query, apikey: TWELVE_DATA_KEY, outputsize: 15 } }
    );

    if (data.status === "error") {
      return {
        matches: [],
        providerLimited: true,
        note: data.message ?? "Il provider dati non ha restituito risultati per questa ricerca.",
      };
    }

    const rows = data.data ?? [];
    const matches: SymbolMatch[] = rows.map((r) => ({
      symbol: r.symbol,
      instrumentName: r.instrument_name,
      exchange: r.exchange ?? null,
      country: r.country ?? null,
      instrumentType: r.instrument_type ?? null,
      currency: r.currency ?? null,
    }));

    return {
      matches,
      providerLimited: false,
      note: matches.length === 0
        ? "Nessun risultato trovato. L'asset potrebbe non essere supportato dal provider dati attuale (es. alcuni titoli italiani/europei o ETF specifici)."
        : null,
    };
  } catch (err) {
    return {
      matches: [],
      providerLimited: true,
      note: "Errore di comunicazione con il provider dati durante la ricerca del simbolo.",
    };
  }
}

// ─── FETCH HELPER ────────────────────────────────────────────────────────────

async function fetchOHLC(symbol: string, interval: string, outputsize: number): Promise<OHLCRow[] | null> {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_KEY}`;
    const res = await axios.get<TwelveDataResponse>(url, { timeout: 14000 });
    if (!res.data.values || res.data.values.length < 10) {
      console.warn(`[fetchOHLC] ${symbol}/${interval}: no values — status=${res.data.status} msg=${res.data.message}`);
      return null;
    }
    return res.data.values;
  } catch (err: any) {
    console.error(`[fetchOHLC] ${symbol}/${interval}: exception — ${err?.message}`);
    return null;
  }
}

// ─── FULL REPORT ─────────────────────────────────────────────────────────────

function buildFullReport(params: {
  ticker: string;
  price: number;
  ema50: number;
  ema100: number;
  ema200: number;
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  atr: number;
  atrAvg: number;
  volumeRatio: number;
  structure: Structure;
  mtf: MtfAnalysis;
  direction: "LONG" | "SHORT" | "WAIT";
  verdict: "FORTE_BUY" | "BUY" | "NEUTRALE" | "SELL" | "FORTE_SELL";
  score: number;
  scoreBreakdown: ScoreBreakdown;
  confidenceScore: number;
  estimatedProbability: number;
  tp: number;
  sl: number;
  falseSignalRisk: "Basso" | "Medio" | "Alto";
  invalidationConditions: string[];
}): string {
  const {
    ticker, price, ema50, ema100, ema200, rsi, macd, atr, atrAvg,
    volumeRatio, structure, mtf, direction, verdict, score, scoreBreakdown,
    confidenceScore, estimatedProbability, tp, sl,
    falseSignalRisk, invalidationConditions,
  } = params;

  // 1. TREND classification
  const trendClass =
    price > ema200 && price > ema100 && price > ema50 ? "Fortemente Rialzista" :
    price > ema200 && price > ema100 ? "Rialzista" :
    price < ema200 && price < ema100 && price < ema50 ? "Fortemente Ribassista" :
    price < ema200 && price < ema100 ? "Ribassista" : "Neutrale";

  const ema200Gap = (((price - ema200) / ema200) * 100).toFixed(2);
  const ema50Gap = (((price - ema50) / ema50) * 100).toFixed(2);

  // 2. MOMENTUM RSI label
  const rsiLabel =
    rsi >= 70 ? "Ipercomprato" :
    rsi <= 30 ? "Ipervenduto" :
    rsi > 60 ? "Momentum Forte Rialzista" :
    rsi > 50 ? "Momentum Moderato Rialzista" :
    rsi > 40 ? "Momentum Moderato Ribassista" : "Momentum Forte Ribassista";

  const macdLabel = macd.histogram > 0 ? "Positivo (momentum rialzista)" : "Negativo (momentum ribassista)";
  const momentumClass =
    (Math.abs(macd.histogram) > atr * 0.1 && ((direction === "LONG" && macd.histogram > 0) || (direction === "SHORT" && macd.histogram < 0)))
      ? "Momentum Forte"
      : Math.abs(rsi - 50) > 10
      ? "Momentum Moderato"
      : "Momentum Debole";

  // 3. VOLATILITY
  const atrRatio = atrAvg > 0 ? atr / atrAvg : 1;
  const volClass =
    atrRatio > 1.4 ? "Volatilità Elevata" :
    atrRatio < 0.7 ? "Volatilità Bassa" : "Volatilità Normale";
  const volFavorable =
    direction === "WAIT" ? "Neutro." :
    volClass === "Volatilità Bassa" ? "La bassa volatilita' potrebbe rallentare il raggiungimento del target." :
    volClass === "Volatilità Elevata" ? "Volatilita' elevata: il target e' piu' raggiungibile, ma SL potrebbe essere testato." :
    "Volatilita' nella norma: favorevole per il trade.";

  // 4. VOLUMES
  const volLabel =
    volumeRatio > 1.3 && direction === "LONG" ? "Conferma Rialzista" :
    volumeRatio > 1.3 && direction === "SHORT" ? "Conferma Ribassista" :
    volumeRatio < 0.7 ? "Nessuna Conferma (volumi bassi)" : "Volumi nella norma";
  const volPct = ((volumeRatio - 1) * 100).toFixed(0);
  const volDesc = volumeRatio >= 1
    ? `Volume attuale superiore del ${volPct}% alla media 20 periodi.`
    : `Volume attuale inferiore del ${Math.abs(Number(volPct))}% alla media 20 periodi.`;

  // 5. MTF alignment count
  const tfList = [mtf.m15, mtf.h1, mtf.h4, mtf.daily];
  const aligned = tfList.filter(tf =>
    direction === "LONG" ? tf.includes("Rialzista") :
    direction === "SHORT" ? tf.includes("Ribassista") : false
  ).length;
  const mtfLabel = aligned >= 3 ? "Allineamento Multi-Timeframe: Forte" :
    aligned === 2 ? "Allineamento Multi-Timeframe: Parziale" :
    "Segnale controtrend nei timeframe superiori";

  // 7. R:R
  const riskPct = direction === "LONG"
    ? (((price - sl) / price) * 100).toFixed(2)
    : (((sl - price) / price) * 100).toFixed(2);
  const rewardPct = direction === "LONG"
    ? (((tp - price) / price) * 100).toFixed(2)
    : (((price - tp) / price) * 100).toFixed(2);
  const rrRatio = Number(riskPct) > 0
    ? (Number(rewardPct) / Number(riskPct)).toFixed(2)
    : "N/D";
  const rrLabel =
    Number(rrRatio) >= 3 ? "Ottimo" :
    Number(rrRatio) >= 2 ? "Buono" :
    Number(rrRatio) >= 1.5 ? "Accettabile" : "Scarso";

  // Positive / Negative factors for probability section
  const posFactors: string[] = [];
  const negFactors: string[] = [];
  if (price > ema200) posFactors.push("Prezzo sopra EMA200 — trend rialzista principale");
  else negFactors.push("Prezzo sotto EMA200 — trend ribassista principale");
  if (direction === "LONG" && rsi > 50 && rsi < 70) posFactors.push("RSI in zona momentum rialzista ottimale");
  if (direction === "SHORT" && rsi < 50 && rsi > 30) posFactors.push("RSI in zona momentum ribassista");
  if (direction === "LONG" && macd.histogram > 0) posFactors.push("MACD positivo — conferma momentum");
  if (direction === "SHORT" && macd.histogram < 0) posFactors.push("MACD negativo — conferma momentum");
  if (aligned >= 3) posFactors.push(`Multi-timeframe allineato (${aligned}/4)`);
  else negFactors.push(`Allineamento MTF parziale (${aligned}/4)`);
  if (volumeRatio > 1.2) posFactors.push(`Volumi superiori del ${volPct}% alla media`);
  else negFactors.push("Volumi nella norma o bassi");
  if (structure.type === (direction === "LONG" ? "Rialzista" : "Ribassista")) posFactors.push("Struttura del prezzo in favore del trade");
  else negFactors.push("Struttura del prezzo non allineata con la direzione");
  if (falseSignalRisk === "Alto") negFactors.push("Rischio di falso segnale elevato");

  // 3 main verdict reasons
  const verdictReasons = [
    price > ema200 ? "Prezzo sopra EMA200" : "Prezzo sotto EMA200",
    `Struttura con ${structure.higherHighs ? "Higher High" : "Lower High"} e ${structure.higherLows ? "Higher Low" : "Lower Low"}`,
    `Risk/Reward ${rrLabel} (${rrRatio}:1)`,
  ];

  const verdictLabel = {
    FORTE_BUY: "FORTE BUY",
    BUY: "BUY",
    NEUTRALE: "NEUTRALE",
    SELL: "SELL",
    FORTE_SELL: "FORTE SELL",
  }[verdict];

  const lines: string[] = [
    `═══════════════════════════════════════`,
    `  ANALISI QUANTITATIVA — ${ticker}`,
    `═══════════════════════════════════════`,
    ``,
    `1. TREND`,
    `Classificazione: ${trendClass}`,
    `EMA50:  ${fp(ema50)}  |  EMA100: ${fp(ema100)}  |  EMA200: ${fp(ema200)}`,
    `Prezzo vs EMA200: ${Number(ema200Gap) >= 0 ? "+" : ""}${ema200Gap}%`,
    `Prezzo vs EMA50:  ${Number(ema50Gap) >= 0 ? "+" : ""}${ema50Gap}%`,
    price > ema200 && price > ema100 && price > ema50
      ? "Prezzo sopra tutte le EMA principali — trend rialzista strutturale confermato."
      : price < ema200 && price < ema100 && price < ema50
      ? "Prezzo sotto tutte le EMA principali — trend ribassista strutturale confermato."
      : "EMA non allineate — trend in transizione o compressione laterale.",
    ``,
    `2. MOMENTUM`,
    `RSI (14): ${rsi.toFixed(1)} — ${rsiLabel}`,
    `MACD Histogram: ${macd.histogram.toFixed(4)} — ${macdLabel}`,
    `MACD Line: ${macd.macd.toFixed(4)}  |  Signal: ${macd.signal.toFixed(4)}`,
    `Valutazione: ${momentumClass}`,
    rsi > 70 ? "ATTENZIONE: RSI in ipercomprato — probabile corruzione del segnale LONG."
      : rsi < 30 ? "ATTENZIONE: RSI in ipervenduto — possibile rimbalzo tecnico."
      : "",
    ``,
    `3. VOLATILITÀ`,
    `ATR(14): ${fp(atr)}  |  ATR medio 20 candele: ${fp(atrAvg)}`,
    `Rapporto ATR/ATRmedio: ${atrRatio.toFixed(2)}x — ${volClass}`,
    volFavorable,
    ``,
    `4. VOLUMI`,
    volDesc,
    `Valutazione: ${volLabel}`,
    volumeRatio > 1.3 ? "Movimento supportato dai volumi — segnale valido." : "Volumi insufficienti — segnale da confermare.",
    ``,
    `5. STRUTTURA DEL PREZZO`,
    structure.description,
    `Ultimo supporto: ${fp(structure.lastSupport)}`,
    `Ultima resistenza: ${fp(structure.lastResistance)}`,
    direction !== "WAIT"
      ? structure.type === (direction === "LONG" ? "Rialzista" : "Ribassista")
        ? "Il trade e' IN FAVORE della struttura di prezzo."
        : "ATTENZIONE: Il trade e' CONTRO la struttura di prezzo."
      : "",
    ``,
    `6. ANALISI MULTI-TIMEFRAME`,
    `15M:   ${mtf.m15}`,
    `1H:    ${mtf.h1}`,
    `4H:    ${mtf.h4}`,
    `Daily: ${mtf.daily}`,
    mtfLabel,
    ``,
    `7. RISK / REWARD`,
    `Ingresso:    ${fp(price)}`,
    `Take Profit: ${fp(tp)}  (+${rewardPct}%)`,
    `Stop Loss:   ${fp(sl)}  (-${riskPct}%)`,
    `Rapporto R/R: 1:${rrRatio} — ${rrLabel}`,
    ``,
    `8. RISCHIO DI FALSO SEGNALE`,
    `Classificazione: ${falseSignalRisk}`,
    falseSignalRisk === "Basso"
      ? "Trend, momentum, volumi e struttura sono allineati. Bassa probabilita' di falso segnale."
      : falseSignalRisk === "Medio"
      ? "Alcuni indicatori non confermano. Monitorare il prezzo dopo l'ingresso."
      : "Divergenze significative rilevate. Considerare di ridurre la size o attendere conferma.",
    ``,
    `9. SCORE COMPLESSIVO: ${score}/100`,
    `  Trend:          ${scoreBreakdown.trend}/30`,
    `  Momentum:       ${scoreBreakdown.momentum}/20`,
    `  Volatilita':    ${scoreBreakdown.volatility}/10`,
    `  Volumi:         ${scoreBreakdown.volume}/15`,
    `  Struttura:      ${scoreBreakdown.structure}/15`,
    `  Multi-Timeframe: ${scoreBreakdown.multiTimeframe}/10`,
    score >= 91 ? "Interpretazione: Setup Eccezionale" :
    score >= 76 ? "Interpretazione: Setup Forte" :
    score >= 61 ? "Interpretazione: Setup Valido" :
    score >= 41 ? "Interpretazione: Setup Debole" : "Interpretazione: Nessun Trade",
    ``,
    `10. CONFIDENCE SCORE: ${confidenceScore}%`,
    confidenceScore >= 80 ? "Confidenza Molto Alta" :
    confidenceScore >= 66 ? "Confidenza Alta" :
    confidenceScore >= 50 ? "Confidenza Moderata" : "Confidenza Bassa",
    ``,
    `11. PROBABILITÀ STIMATA: ${estimatedProbability}%`,
    `Fattori positivi:`,
    ...posFactors.map(f => `  + ${f}`),
    `Fattori negativi:`,
    ...negFactors.map(f => `  - ${f}`),
    ``,
    `12. CONDIZIONI DI INVALIDAZIONE`,
    ...invalidationConditions.map((c, i) => `  ${i + 1}. ${c}`),
    ``,
    `═══════════════════════════════════════`,
    `VERDETTO: ${verdictLabel}`,
    ``,
    `Score:                ${score}/100`,
    `Confidence Score:     ${confidenceScore}%`,
    `Probabilita' stimata: ${estimatedProbability}%`,
    ``,
    `Motivi principali:`,
    ...verdictReasons.map((r, i) => `  ${i + 1}. ${r}`),
    `═══════════════════════════════════════`,
  ];

  return lines.filter(l => l !== undefined).join("\n");
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function analyzeTicker(ticker: string): Promise<AnalysisData | null> {
  try {
    const symbol = normalizeSymbol(ticker);

    // Fetch primary 1H first (required), then MTF calls sequentially with
    // 400ms pauses to stay within Twelve Data free-tier rate limit (8/min).
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const h1Data = await fetchOHLC(symbol, "1h", 220);
    if (!h1Data || h1Data.length < 30) return null;

    await sleep(700);
    const m15Data = await fetchOHLC(symbol, "15min", 100);

    await sleep(700);
    const h4Data = await fetchOHLC(symbol, "4h", 100);

    await sleep(700);
    const dailyData = await fetchOHLC(symbol, "1day", 100);

    // 1H is the primary timeframe
    const rows1h = [...h1Data].reverse();
    const closes = rows1h.map((r) => parseFloat(r.close));
    const highs = rows1h.map((r) => parseFloat(r.high));
    const lows = rows1h.map((r) => parseFloat(r.low));
    const volumes = rows1h.map((r) => parseFloat(r.volume ?? "0")).filter(v => !isNaN(v) && v > 0);

    const price = closes.at(-1) ?? 0;
    const ema50 = lastEMA(closes, Math.min(50, closes.length));
    const ema100 = lastEMA(closes, Math.min(100, closes.length));
    const ema200 = lastEMA(closes, Math.min(200, closes.length));
    const rsi = calcRSI(closes);
    const macd = calcMACD(closes);
    const atr = calcATR(highs, lows, closes, 14);

    // ATR average over last 20 ATR readings (use simple method)
    const atrReadings: number[] = [];
    for (let i = 14; i <= Math.min(34, closes.length); i++) {
      atrReadings.push(calcATR(highs.slice(0, i), lows.slice(0, i), closes.slice(0, i), 14));
    }
    const atrAvg = atrReadings.length > 0
      ? atrReadings.reduce((a, b) => a + b, 0) / atrReadings.length
      : atr;
    const atrRatio = atrAvg > 0 ? atr / atrAvg : 1;

    // Volume ratio
    const currentVol = volumes.at(-1) ?? 1;
    const avgVol = volumes.length > 1
      ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length - 1)
      : currentVol;
    const volumeRatio = avgVol > 0 ? currentVol / avgVol : 1;

    // Price structure
    const structure = detectStructure(closes, highs, lows);

    // Multi-timeframe
    const mtfAnalysis: MtfAnalysis = {
      m15: m15Data ? calcTimeframeTrend(m15Data) : "Dati non disponibili",
      h1: calcTimeframeTrend(h1Data),
      h4: h4Data ? calcTimeframeTrend(h4Data) : "Dati non disponibili",
      daily: dailyData ? calcTimeframeTrend(dailyData) : "Dati non disponibili",
    };

    // ─── DIRECTION & SCORING ──────────────────────────────────────────────────

    const trendRialzista = price > ema200;
    const trendRibassista = price < ema200;
    const rsiOk_LONG = rsi > 40 && rsi < 70;
    const rsiOk_SHORT = rsi > 30 && rsi < 60;

    const isLong = trendRialzista && rsiOk_LONG && macd.histogram >= 0;
    const isShort = trendRibassista && rsiOk_SHORT && macd.histogram <= 0;

    // Trend score (0-30)
    let trendScore = 0;
    if (price > ema50) trendScore += 5;
    if (price > ema100) trendScore += 5;
    if (price > ema200) trendScore += 10;
    if (ema50 > ema100 && ema100 > ema200) trendScore += 10; // perfect bull stack
    else if (ema50 < ema100 && ema100 < ema200) trendScore += 10; // perfect bear stack — also high score
    else trendScore += 3; // mixed
    if (price < ema50) {
      // Rebalance for short
      trendScore = 0;
      if (price < ema50) trendScore += 5;
      if (price < ema100) trendScore += 5;
      if (price < ema200) trendScore += 10;
      if (ema50 < ema100 && ema100 < ema200) trendScore += 10;
      else trendScore += 3;
    }

    // Momentum score (0-20)
    let momentumScore = 0;
    const macdAligned = (isLong && macd.histogram > 0) || (isShort && macd.histogram < 0);
    if (macdAligned) momentumScore += 10;
    if (isLong && rsi > 50 && rsi < 70) momentumScore += 10;
    else if (isShort && rsi < 50 && rsi > 30) momentumScore += 10;
    else if (isLong && rsi > 40) momentumScore += 5;
    else if (isShort && rsi < 60) momentumScore += 5;

    // Volatility score (0-10)
    let volatilityScore = 0;
    if (atr > 0) {
      if (atrRatio >= 0.8 && atrRatio <= 1.5) volatilityScore = 10;
      else if (atrRatio > 1.5) volatilityScore = 6;
      else volatilityScore = 4;
    }

    // Volume score (0-15)
    let volumeScore = 0;
    const volAligned = (isLong && volumeRatio > 1.1) || (isShort && volumeRatio > 1.1);
    if (volAligned) volumeScore = 15;
    else if (volumeRatio >= 0.9) volumeScore = 8;
    else volumeScore = 3;

    // Structure score (0-15)
    let structureScore = 0;
    const structAligned =
      (isLong && structure.type === "Rialzista") ||
      (isShort && structure.type === "Ribassista");
    const structContra =
      (isLong && structure.type === "Ribassista") ||
      (isShort && structure.type === "Rialzista");
    if (structAligned) structureScore = 15;
    else if (structContra) structureScore = 0;
    else structureScore = 7;

    const direction: "LONG" | "SHORT" | "WAIT" =
      isLong ? "LONG" : isShort ? "SHORT" : "WAIT";

    // MTF score (0-10)
    const mtfScoreVal = mtfScore(mtfAnalysis, direction);

    const scoreBreakdown: ScoreBreakdown = {
      trend: Math.min(30, trendScore),
      momentum: Math.min(20, momentumScore),
      volatility: Math.min(10, volatilityScore),
      volume: Math.min(15, volumeScore),
      structure: Math.min(15, structureScore),
      multiTimeframe: Math.min(10, mtfScoreVal),
    };
    const score = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

    const signal: "BUY" | "WAIT" = direction !== "WAIT" && score >= 60 ? "BUY" : "WAIT";

    // ─── TP / SL (R:R 1:2) ────────────────────────────────────────────────────

    const SL_MULT = 1.5;
    const TP_MULT = 3.0;

    let tp: number, sl: number;
    if (direction === "SHORT") {
      tp = Math.round((price - TP_MULT * atr) * 1e6) / 1e6;
      sl = Math.round((price + SL_MULT * atr) * 1e6) / 1e6;
    } else {
      tp = Math.round((price + TP_MULT * atr) * 1e6) / 1e6;
      sl = Math.round((price - SL_MULT * atr) * 1e6) / 1e6;
    }

    // ─── VERDICT ──────────────────────────────────────────────────────────────

    const verdict: AnalysisData["verdict"] =
      direction === "LONG" && score >= 85 ? "FORTE_BUY" :
      direction === "LONG" && score >= 60 ? "BUY" :
      direction === "SHORT" && score >= 85 ? "FORTE_SELL" :
      direction === "SHORT" && score >= 60 ? "SELL" : "NEUTRALE";

    // ─── CONFIDENCE & PROBABILITY ─────────────────────────────────────────────

    // Confluence: 6 factors (Trend, Momentum, Volume, Structure, MTF, Volatility)
    const trendAligned = (direction === "LONG" && price > ema200) || (direction === "SHORT" && price < ema200);
    const momentumAligned = (direction === "LONG" && rsi > 50 && rsi < 70) || (direction === "SHORT" && rsi < 50 && rsi > 30);
    const confluenceFactors = [
      trendAligned,
      macdAligned,
      volAligned,
      structAligned,
      mtfScoreVal >= 8,
      momentumAligned,
    ];
    const confluence = confluenceFactors.filter(Boolean).length;
    const alignedFactors = confluence;

    // Market regime
    const marketRegime: string =
      atrRatio > 1.4 ? "Alta Volatilità" :
      atrRatio < 0.7 ? "Bassa Volatilità" :
      (price > ema50 && ema50 > ema100 && ema100 > ema200) ? "Trend Forte Rialzista" :
      (price < ema50 && ema50 < ema100 && ema100 < ema200) ? "Trend Forte Ribassista" :
      structure.type === "Laterale" ? "Laterale" :
      price > ema200 ? "Trend Debole Rialzista" : "Trend Debole Ribassista";

    const confidenceScore = Math.min(95, Math.round(
      (score / 100) * 60 +
      (alignedFactors / 5) * 30 +
      (mtfScoreVal / 10) * 10
    ));

    const estimatedProbability = Math.min(90, Math.round(
      confidenceScore * 0.8 + (score >= 76 ? 10 : score >= 61 ? 5 : 0)
    ));

    // ─── FALSE SIGNAL RISK ────────────────────────────────────────────────────

    const riskFactors = [
      rsi > 70 || rsi < 30,                // RSI extreme
      !macdAligned,                         // MACD not aligned
      volumeRatio < 0.8,                   // low volume
      structContra,                         // structure against trade
      mtfScoreVal <= 2,                     // MTF not aligned
    ].filter(Boolean).length;

    const falseSignalRisk: "Basso" | "Medio" | "Alto" =
      riskFactors >= 3 ? "Alto" :
      riskFactors >= 2 ? "Medio" : "Basso";

    // ─── INVALIDATION CONDITIONS ──────────────────────────────────────────────

    const invalidationConditions: string[] = [];
    if (direction === "LONG") {
      invalidationConditions.push(`Prezzo chiude sotto EMA200 (${fp(ema200)})`);
      invalidationConditions.push(`RSI supera 75 senza conferma di volume`);
      invalidationConditions.push(`Rottura ribassista dell'ultimo supporto (${fp(structure.lastSupport)})`);
      invalidationConditions.push(`MACD incrocia al ribasso la linea dello 0`);
    } else if (direction === "SHORT") {
      invalidationConditions.push(`Prezzo chiude sopra EMA200 (${fp(ema200)})`);
      invalidationConditions.push(`RSI scende sotto 30 (ipervenduto — rimbalzo probabile)`);
      invalidationConditions.push(`Rottura rialzista dell'ultima resistenza (${fp(structure.lastResistance)})`);
      invalidationConditions.push(`MACD incrocia al rialzo la linea dello 0`);
    } else {
      invalidationConditions.push(`Allineamento delle EMA (50/100/200) in una direzione`);
      invalidationConditions.push(`RSI esce dal range 40-60 con volume > media`);
      invalidationConditions.push(`MACD histogram supera ${fp(atr * 0.2)} in valore assoluto`);
    }

    // ─── FULL REPORT ──────────────────────────────────────────────────────────

    const reason = buildFullReport({
      ticker, price, ema50, ema100, ema200, rsi, macd, atr,
      atrAvg, volumeRatio, structure, mtf: mtfAnalysis,
      direction, verdict, score, scoreBreakdown,
      confidenceScore, estimatedProbability,
      tp: signal === "BUY" ? tp : Math.round((price + TP_MULT * atr) * 1e6) / 1e6,
      sl: signal === "BUY" ? sl : Math.round((price - SL_MULT * atr) * 1e6) / 1e6,
      falseSignalRisk, invalidationConditions,
    });

    const namedConfluenceFactors: ConfluenceFactors = {
      trend:     confluenceFactors[0],
      macd:      confluenceFactors[1],
      volume:    confluenceFactors[2],
      structure: confluenceFactors[3],
      mtf:       confluenceFactors[4],
      momentum:  confluenceFactors[5],
    };

    return {
      ticker,
      price,
      score,
      signal,
      direction,
      verdict,
      reason,
      tp: signal === "BUY" ? tp : Math.round((price + TP_MULT * atr) * 1e6) / 1e6,
      sl: signal === "BUY" ? sl : Math.round((price - SL_MULT * atr) * 1e6) / 1e6,
      atr,
      ema50,
      ema100,
      ema200,
      rsi,
      macdHistogram: macd.histogram,
      volumeRatio,
      falseSignalRisk,
      confidenceScore,
      estimatedProbability,
      scoreBreakdown,
      confluenceFactors: namedConfluenceFactors,
      mtfAnalysis,
      invalidationConditions,
      confluence,
      marketRegime,
    };
  } catch (err: any) {
    console.error("[analysis] Errore in analyzeTicker:", err?.message);
    return null;
  }
}
```

## PERCORSO: artifacts/api-server/src/lib/analytics.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/lib/logger.ts
```ts
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
```

## PERCORSO: artifacts/api-server/src/lib/portfolio.ts
```ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_FILE = path.resolve(__dirname, "../../../../portfolio.json");

export interface Trade {
  ticker: string;
  entry: number;
  tp: number;
  sl: number;
  atr: number;
  direction: "LONG" | "SHORT";
  reason: string;
  investAmount: number;
  addedAt: string;
  status: "active" | "paused";
}

export interface ClosedTrade extends Trade {
  closedAt: string;
  closeReason: "TP_HIT" | "SL_HIT" | "MANUAL";
  exitPrice: number;
  pnl: number;
}

export interface Portfolio {
  balance: number;
  telegramChatId?: string | null;
  trades: Trade[];
  closedTrades: ClosedTrade[];
}

export interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export function loadPortfolio(): Portfolio {
  try {
    if (!fs.existsSync(PORTFOLIO_FILE)) {
      const initial: Portfolio = { balance: 1000, trades: [], closedTrades: [], telegramChatId: null };
      fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(PORTFOLIO_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Portfolio;
    parsed.trades = (parsed.trades || []).map((t) => ({
      direction: "LONG" as const,
      reason: "",
      investAmount: 100,
      status: "active" as const,
      ...t,
    }));
    parsed.closedTrades = parsed.closedTrades || [];
    return parsed;
  } catch {
    return { balance: 1000, trades: [], closedTrades: [], telegramChatId: null };
  }
}

export function savePortfolio(data: Portfolio): void {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

export function calcMetrics(closedTrades: ClosedTrade[]): PerformanceMetrics {
  if (closedTrades.length === 0) {
    return { totalPnl: 0, winRate: 0, profitFactor: 0, totalClosedTrades: 0, winningTrades: 0, losingTrades: 0 };
  }
  const winners = closedTrades.filter((t) => t.pnl > 0);
  const losers = closedTrades.filter((t) => t.pnl <= 0);
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
  return {
    totalPnl: Math.round(closedTrades.reduce((s, t) => s + t.pnl, 0) * 100) / 100,
    winRate: Math.round((winners.length / closedTrades.length) * 1000) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    totalClosedTrades: closedTrades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
  };
}
```

## PERCORSO: artifacts/api-server/src/lib/price.ts
```ts
/**
 * Shared price-fetching utilities.
 * Single source of truth for symbol normalization and live price retrieval.
 */
import axios from "axios";
import { logger } from "./logger.js";

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY ?? "";

/** Normalise crypto/forex ticker to a Twelve Data-compatible symbol. */
export function normalizeSymbol(ticker: string): string {
  return ticker
    .replace(/-/g, "/")
    .replace(/\/USDT$/i, "/USD")
    .replace(/\/BUSD$/i, "/USD")
    .replace(/\/USDC$/i, "/USD");
}

/** Adaptive decimal formatter — same logic used across components. */
export function formatPrice(val: number): string {
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  const decimals =
    abs >= 10_000 ? 2 :
    abs >= 1_000  ? 2 :
    abs >= 100    ? 3 :
    abs >= 1      ? 4 :
    abs >= 0.01   ? 6 : 8;
  return val.toFixed(decimals);
}

/** Fetch the current price for a single ticker. Returns null on any failure. */
export async function getCurrentPrice(ticker: string): Promise<number | null> {
  if (!TWELVE_DATA_KEY) return null;
  try {
    const symbol = normalizeSymbol(ticker);
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await axios.get<{ price?: string; status?: string }>(url, { timeout: 8_000 });
    if (res.data.status === "error") return null;
    const price = parseFloat(res.data.price ?? "");
    return isNaN(price) ? null : price;
  } catch (err) {
    logger.warn({ ticker, err }, "[price] getCurrentPrice failed");
    return null;
  }
}

/** Fetch prices for multiple tickers concurrently (max 6 in parallel to respect rate limits). */
export async function getBatchPrices(
  tickers: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  const CONCURRENCY = 6;

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const chunk = tickers.slice(i, i + CONCURRENCY);
    const prices = await Promise.all(chunk.map(t => getCurrentPrice(t)));
    chunk.forEach((t, idx) => result.set(t, prices[idx]));
  }
  return result;
}
```

## PERCORSO: artifacts/api-server/src/lib/signals.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/lib/telegram.ts
```ts
import axios from "axios";
import { loadPortfolio, savePortfolio, type ClosedTrade } from "./portfolio.js";
import { getPendingSignalsByAsset, updateSignalStatus, getGlobalStats, expireOldSignals } from "./signals.js";
import { getBatchPrices } from "./price.js";
import { logger } from "./logger.js";

const TOKEN = process.env.TELEGRAM_TOKEN ?? "";

// ─── Core Telegram send ───────────────────────────────────────────────────────

async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!TOKEN || !chatId) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 8_000 }
    );
  } catch (err) {
    logger.warn({ chatId, err }, "[telegram] sendMessage failed");
  }
}

// ─── P&L helpers ─────────────────────────────────────────────────────────────

function calcPnl(
  direction: "LONG" | "SHORT", entry: number, exit: number, investAmount: number
): number {
  const pct = direction === "LONG"
    ? (exit - entry) / entry
    : (entry - exit) / entry;
  return Math.round(pct * investAmount * 100) / 100;
}

function calcProfitPct(direction: "LONG" | "SHORT", entry: number, exit: number): number {
  return Math.round(
    (direction === "LONG"
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100) * 100
  ) / 100;
}

// ─── Combined monitor ─────────────────────────────────────────────────────────
// Single portfolio load + single batch price fetch per cycle.

async function runMonitor(): Promise<void> {
  const portfolio = loadPortfolio();
  const chatId = portfolio.telegramChatId ?? "";
  if (portfolio.trades.length === 0) return;

  const tickers = [...new Set(portfolio.trades.map(t => t.ticker))];
  const prices = await getBatchPrices(tickers);

  let portfolioChanged = false;
  const remaining = [];

  for (const trade of portfolio.trades) {
    if (trade.status === "paused") { remaining.push(trade); continue; }

    const price = prices.get(trade.ticker) ?? null;
    if (price === null) { remaining.push(trade); continue; }

    const hitTP = trade.direction === "LONG" ? price >= trade.tp : price <= trade.tp;
    const hitSL = trade.direction === "LONG" ? price <= trade.sl : price >= trade.sl;

    if (hitTP || hitSL) {
      const closeReason: "TP_HIT" | "SL_HIT" = hitTP ? "TP_HIT" : "SL_HIT";
      const pnl = calcPnl(trade.direction, trade.entry, price, trade.investAmount);
      const closed: ClosedTrade = {
        ...trade, closedAt: new Date().toISOString(),
        closeReason, exitPrice: price, pnl,
      };
      portfolio.closedTrades = portfolio.closedTrades || [];
      portfolio.closedTrades.push(closed);
      portfolioChanged = true;

      if (chatId) {
        const emoji = hitTP ? "✅ TAKE PROFIT RAGGIUNTO" : "❌ STOP LOSS COLPITO";
        const pnlStr = pnl >= 0 ? `+${pnl}` : `${pnl}`;
        await sendMessage(chatId,
          `<b>${emoji}</b>\n\n` +
          `Asset: <code>${trade.ticker}</code>\n` +
          `Direzione: ${trade.direction}\n` +
          `Prezzo attuale: ${price}\n` +
          `${hitTP ? `Target TP: ${trade.tp}` : `Stop Loss: ${trade.sl}`}\n` +
          `Investimento: ${trade.investAmount} EUR\n` +
          `<b>PnL: ${pnlStr} EUR</b>\n\n` +
          `Il trade è stato chiuso automaticamente.`
        );
      }
    } else {
      remaining.push(trade);
    }
  }

  // Monitor DB signals for the same tickers
  for (const ticker of tickers) {
    const price = prices.get(ticker) ?? null;
    if (price === null) continue;

    try {
      const pendingSignals = await getPendingSignalsByAsset(ticker);
      for (const sig of pendingSignals) {
        const hitTP = sig.direction === "LONG" ? price >= sig.tp : price <= sig.tp;
        const hitSL = sig.direction === "LONG" ? price <= sig.sl : price >= sig.sl;

        if (!hitTP && !hitSL) continue;

        const status: "WIN" | "LOSS" = hitTP ? "WIN" : "LOSS";
        const profitPct = calcProfitPct(sig.direction as "LONG" | "SHORT", sig.entry_price, price);
        await updateSignalStatus(sig.id, status, price, profitPct);

        if (chatId) {
          let statsLine = "";
          try {
            const gs = await getGlobalStats();
            if (gs.closedSignals >= 5) {
              statsLine = `\n📊 Win Rate Globale: ${gs.winRate}% (${gs.wins}W/${gs.losses}L)`;
            }
          } catch { /* non-critical */ }

          const emoji = hitTP ? "✅ TARGET RAGGIUNTO" : "❌ STOP LOSS COLPITO";
          await sendMessage(chatId,
            `<b>${emoji}</b>\n\n` +
            `Asset: <code>${ticker}</code>\n` +
            `Direzione: ${sig.direction}\n` +
            `Entrata: ${sig.entry_price}\n` +
            `Prezzo attuale: ${price}\n` +
            `${hitTP ? `Take Profit: ${sig.tp}` : `Stop Loss: ${sig.sl}`}\n` +
            `P&L: <b>${profitPct >= 0 ? "+" : ""}${profitPct}%</b>` +
            statsLine +
            `\n\nSegnale DB #${sig.id} chiuso automaticamente.`
          );
        }
      }
    } catch (err) {
      logger.error({ ticker, err }, "[Monitor] DB signal check failed");
    }
  }

  if (portfolioChanged) {
    portfolio.trades = remaining;
    savePortfolio(portfolio);
  }
}

// ─── SMART SIGNAL ALERT ───────────────────────────────────────────────────────

export interface SignalAlertParams {
  chatId: string; asset: string; direction: string;
  price: number; tp: number; sl: number;
  score: number; confidenceScore: number; confluence: number;
  marketRegime: string; verdict: string;
  qualityTier: string | null; qualified: boolean;
  historicalWinRate?: number; historicalCases?: number; dataLabel?: string;
  signalId: number;
}

export async function sendSignalAlert(params: SignalAlertParams): Promise<void> {
  if (!params.chatId || !TOKEN || !params.qualified) return;

  const tierEmoji: Record<string, string> = { ELITE: "🏆", FORTE: "⭐", NORMALE: "📊" };
  const tier     = params.qualityTier ?? "N/A";
  const tierIcon = tierEmoji[tier] ?? "📊";
  const dirEmoji = params.direction === "LONG" ? "🟢 LONG" : "🔴 SHORT";

  const rrTP = params.direction === "LONG"
    ? (((params.tp - params.price) / params.price) * 100).toFixed(2)
    : (((params.price - params.tp) / params.price) * 100).toFixed(2);
  const rrSL = params.direction === "LONG"
    ? (((params.price - params.sl) / params.price) * 100).toFixed(2)
    : (((params.sl - params.price) / params.price) * 100).toFixed(2);

  const histLine = params.historicalWinRate !== undefined && params.historicalCases !== undefined
    ? `\n📈 Win Rate Storico: <b>${params.historicalWinRate}%</b> (${params.historicalCases} casi — ${params.dataLabel ?? "Preliminare"})`
    : "";

  await sendMessage(params.chatId,
    `${tierIcon} <b>NUOVO SEGNALE ${tier}</b>\n\n` +
    `Asset: <code>${params.asset}</code>\n` +
    `Direzione: <b>${dirEmoji}</b>\n` +
    `Entrata: ${params.price}\n` +
    `Take Profit: ${params.tp} (+${rrTP}%)\n` +
    `Stop Loss: ${params.sl} (-${rrSL}%)\n\n` +
    `Score: <b>${params.score}/100</b>\n` +
    `Confidence: ${params.confidenceScore}%\n` +
    `Confluenza: ${params.confluence}/6\n` +
    `Regime: ${params.marketRegime}\n` +
    `Verdetto: ${params.verdict}` +
    histLine +
    `\n\nID Segnale: #${params.signalId}`
  );
}

// ─── START MONITOR ────────────────────────────────────────────────────────────

export function startTelegramMonitor(): void {
  if (!TOKEN) {
    logger.warn("[Monitor] TELEGRAM_TOKEN non configurato — monitor disabilitato.");
    return;
  }
  logger.info("[Monitor] Monitor Telegram avviato (ogni 60s).");

  const run = () => {
    runMonitor().catch(err => logger.error({ err }, "[Monitor] Cycle error"));
    expireOldSignals().catch(err => logger.warn({ err }, "[Monitor] expireOldSignals failed"));
  };

  // First run after 10 s to let the server warm up
  setTimeout(run, 10_000);
  setInterval(run, 60_000);
}
```

## PERCORSO: artifacts/api-server/src/routes/analytics.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/routes/health.ts
```ts
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
```

## PERCORSO: artifacts/api-server/src/routes/index.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/routes/signals.ts
```ts
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
```

## PERCORSO: artifacts/api-server/src/routes/trading.ts
```ts
import { Router, type IRouter } from "express";
import {
  GetPortfolioResponse,
  GetTradesResponse,
  GetTradesLiveResponse,
  AddTradeBody,
  AddTradeResponse,
  DeleteTradeParams,
  DeleteTradeResponse,
  AnalyzeTickerParams,
  AnalyzeTickerResponse,
  GetPortfolioSummaryResponse,
  UpdatePortfolioBody,
  GetClosedTradesResponse,
  GetPortfolioMetricsResponse,
  SearchSymbolsQueryParams,
  SearchSymbolsResponse,
} from "@workspace/api-zod";
import { loadPortfolio, savePortfolio, calcMetrics, type Trade, type ClosedTrade } from "../lib/portfolio.js";
import { analyzeTicker as runAnalysis, searchSymbols } from "../lib/analysis.js";
import {
  insertSignal, getQualityFilter, getQualityTier,
  isQualifiedSignal, getHistoricalContext,
} from "../lib/signals.js";
import { sendSignalAlert } from "../lib/telegram.js";
import { getBatchPrices } from "../lib/price.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Type for analysis result ─────────────────────────────────────────────────

type AnalysisResult = NonNullable<Awaited<ReturnType<typeof runAnalysis>>>;

// ─── Fire-and-forget signal persistence ──────────────────────────────────────

async function persistSignal(
  ticker: string, result: AnalysisResult, chatId: string
): Promise<void> {
  try {
    const [filter] = await Promise.all([getQualityFilter()]);
    const tier      = getQualityTier(result.score, result.confidenceScore, result.confluence);
    const qualified = isQualifiedSignal(result.score, result.confidenceScore, result.confluence, filter);

    const scoreBreakdown = result.scoreBreakdown as Record<string, number>;
    const trend =
      scoreBreakdown.trend > 15 ? "Rialzista" :
      scoreBreakdown.trend > 8  ? "Neutrale"  : "Ribassista";
    const momentum =
      result.rsi > 60 ? "Forte Rialzista" :
      result.rsi > 50 ? "Moderato Rialzista" :
      result.rsi < 40 ? "Forte Ribassista" : "Neutrale";

    const id = await insertSignal({
      asset: ticker, direction: result.direction, entryPrice: result.price,
      tp: result.tp, sl: result.sl, score: result.score,
      confidenceScore: result.confidenceScore,
      estimatedProbability: result.estimatedProbability,
      rsi: result.rsi, macdHistogram: result.macdHistogram,
      ema50: result.ema50, ema100: result.ema100, ema200: result.ema200,
      atr: result.atr, volumeRatio: result.volumeRatio,
      trend, momentum, volatility: "Normale",
      confluence: result.confluence, marketRegime: result.marketRegime,
      verdict: result.verdict, falseSignalRisk: result.falseSignalRisk,
      qualified, qualityTier: tier,
      scoreBreakdown: result.scoreBreakdown as Record<string, number>,
      confluenceFactors: result.confluenceFactors as Record<string, boolean>,
      reason: result.reason,
    });

    if (qualified && chatId) {
      const histCtx = await getHistoricalContext(
        result.score, result.confidenceScore, result.confluence, result.direction
      ).catch(() => null);

      await sendSignalAlert({
        chatId, asset: ticker, direction: result.direction,
        price: result.price, tp: result.tp, sl: result.sl,
        score: result.score, confidenceScore: result.confidenceScore,
        confluence: result.confluence, marketRegime: result.marketRegime,
        verdict: result.verdict, qualityTier: tier, qualified,
        historicalWinRate: histCtx?.winRate,
        historicalCases: histCtx?.totalCases,
        dataLabel: histCtx?.dataLabel,
        signalId: id,
      });
    }
  } catch (err) {
    logger.error({ ticker, err }, "[trading] persistSignal error");
  }
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

router.get("/portfolio", (_req, res) => {
  res.json(GetPortfolioResponse.parse(loadPortfolio()));
});

router.patch("/portfolio", (req, res) => {
  const parsed = UpdatePortfolioBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const portfolio = loadPortfolio();
  if (parsed.data.balance !== undefined && parsed.data.balance > 0) {
    portfolio.balance = parsed.data.balance;
  }
  if (parsed.data.telegramChatId !== undefined) {
    portfolio.telegramChatId = parsed.data.telegramChatId.trim() || null;
  }
  savePortfolio(portfolio);
  res.json(GetPortfolioResponse.parse(portfolio));
});

router.get("/portfolio/summary", (_req, res) => {
  const portfolio = loadPortfolio();
  const trades = portfolio.trades;
  res.json(GetPortfolioSummaryResponse.parse({
    totalTrades: trades.length,
    buySignals:  trades.length,
    avgScore:    trades.length > 0 ? 80 : 0,
    highestScoringTicker: trades.length > 0 ? trades[trades.length - 1].ticker : null,
  }));
});

router.get("/portfolio/metrics", (_req, res) => {
  const portfolio = loadPortfolio();
  res.json(GetPortfolioMetricsResponse.parse(calcMetrics(portfolio.closedTrades || [])));
});

// ─── Trades ───────────────────────────────────────────────────────────────────

router.get("/trades", (_req, res) => {
  res.json(GetTradesResponse.parse(loadPortfolio().trades));
});

router.get("/trades/closed", (_req, res) => {
  res.json(GetClosedTradesResponse.parse(loadPortfolio().closedTrades || []));
});

router.get("/trades/live", async (_req, res) => {
  const portfolio = loadPortfolio();
  const tickers = portfolio.trades.map(t => t.ticker);
  const prices = await getBatchPrices(tickers);

  const results = portfolio.trades.map(trade => {
    const currentPrice = prices.get(trade.ticker) ?? null;
    if (currentPrice === null) {
      return { ...trade, currentPrice: null, unrealizedPnl: null, priceChangePercent: null };
    }
    const pct =
      trade.direction === "LONG"
        ? (currentPrice - trade.entry) / trade.entry
        : (trade.entry - currentPrice) / trade.entry;
    return {
      ...trade,
      currentPrice,
      unrealizedPnl:      Math.round(pct * trade.investAmount * 100) / 100,
      priceChangePercent: Math.round(pct * 10_000) / 100,
    };
  });

  res.json(GetTradesLiveResponse.parse(results));
});

// ─── Add trade ────────────────────────────────────────────────────────────────

router.post("/trades", async (req, res) => {
  const parsed = AddTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker      = parsed.data.ticker.toUpperCase().trim();
  const investAmount = parsed.data.investAmount ?? 100;

  const result = await runAnalysis(ticker);
  const extraFields = result
    ? { verdict: result.verdict ?? null, confidenceScore: result.confidenceScore ?? null, estimatedProbability: result.estimatedProbability ?? null }
    : { verdict: null, confidenceScore: null, estimatedProbability: null };

  if (!result) {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `Errore nel recupero dati per ${ticker}. Verifica il simbolo (es. BTC/USD).`,
      signal: "WAIT", direction: null, score: null, reason: null, ...extraFields,
    }));
    return;
  }

  const portfolio = loadPortfolio();
  const chatId    = portfolio.telegramChatId ?? "";
  // Fire-and-forget — never block the response
  void persistSignal(ticker, result, chatId);

  if (result.signal !== "BUY") {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `Segnale WAIT per ${ticker} (Score: ${result.score}/100). Condizioni non idonee.`,
      signal: result.signal, direction: result.direction, score: result.score,
      reason: result.reason, ...extraFields,
    }));
    return;
  }

  if (portfolio.trades.some(t => t.ticker === ticker)) {
    res.json(AddTradeResponse.parse({
      success: false,
      message: `${ticker} è già sotto monitoraggio.`,
      signal: result.signal, direction: result.direction, score: result.score,
      reason: result.reason, ...extraFields,
    }));
    return;
  }

  const trade: Trade = {
    ticker, entry: result.price, tp: result.tp, sl: result.sl, atr: result.atr,
    direction: result.direction as "LONG" | "SHORT",
    reason: result.reason, investAmount, addedAt: new Date().toISOString(),
    status: "active",
  };
  portfolio.trades.push(trade);
  savePortfolio(portfolio);

  res.json(AddTradeResponse.parse({
    success: true,
    message: `${ticker} aggiunto — Direzione: ${result.direction}`,
    signal: result.signal, direction: result.direction, score: result.score,
    reason: result.reason, trade, ...extraFields,
  }));
});

// ─── Pause / resume trade monitoring ───────────────────────────────────────────

router.patch("/trades/:ticker/status", (req, res) => {
  const ticker = String(req.params.ticker || "").toUpperCase().trim();
  const status = req.body?.status;
  if (status !== "active" && status !== "paused") {
    res.status(400).json({ error: "Stato non valido (usa 'active' o 'paused')" });
    return;
  }

  const portfolio = loadPortfolio();
  const trade = portfolio.trades.find(t => t.ticker === ticker);
  if (!trade) {
    res.status(404).json({ error: `${ticker} non trovato nel tracciamento` });
    return;
  }

  trade.status = status;
  savePortfolio(portfolio);
  res.json(trade);
});

// ─── Delete trade ─────────────────────────────────────────────────────────────

router.delete("/trades/:ticker", (req, res) => {
  const parsed = DeleteTradeParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker    = parsed.data.ticker.toUpperCase();
  const portfolio = loadPortfolio();
  const trade     = portfolio.trades.find(t => t.ticker === ticker);

  if (!trade) {
    res.status(404).json({ error: `${ticker} non trovato nel tracciamento` });
    return;
  }

  portfolio.trades = portfolio.trades.filter(t => t.ticker !== ticker);
  portfolio.closedTrades = portfolio.closedTrades || [];
  portfolio.closedTrades.push({
    ...trade,
    closedAt:    new Date().toISOString(),
    closeReason: "MANUAL",
    exitPrice:   trade.entry,
    pnl:         0,
  } as ClosedTrade);
  savePortfolio(portfolio);

  res.json(DeleteTradeResponse.parse({ success: true, message: `Monitoraggio interrotto per ${ticker}` }));
});

// ─── Symbol search (universal: company name, ticker, ISIN, crypto, ETF) ───────

router.get("/symbols/search", async (req, res) => {
  const parsed = SearchSymbolsQueryParams.safeParse({ q: req.query.q });
  if (!parsed.success || parsed.data.q.trim().length < 1) {
    res.status(400).json({ error: "Parametro di ricerca mancante" });
    return;
  }

  const query = parsed.data.q.trim();
  const outcome = await searchSymbols(query);

  res.json(SearchSymbolsResponse.parse({
    query,
    matches: outcome.matches,
    providerLimited: outcome.providerLimited,
    note: outcome.note,
  }));
});

// ─── Analysis ─────────────────────────────────────────────────────────────────

router.get("/analysis/:ticker", async (req, res) => {
  const parsed = AnalyzeTickerParams.safeParse({ ticker: req.params.ticker });
  if (!parsed.success) { res.status(400).json({ error: "Ticker non valido" }); return; }

  const ticker = parsed.data.ticker.toUpperCase();
  const result = await runAnalysis(ticker);
  if (!result) {
    res.status(400).json({ error: `Errore nel recupero dati per ${ticker}` });
    return;
  }

  const portfolio = loadPortfolio();
  void persistSignal(ticker, result, portfolio.telegramChatId ?? "");

  res.json(AnalyzeTickerResponse.parse(result));
});

export default router;
```

## PERCORSO: artifacts/api-server/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"],
  "references": [
    {
      "path": "../../lib/db"
    },
    {
      "path": "../../lib/api-zod"
    }
  ]
}
```

## PERCORSO: artifacts/trading-dashboard/.replit-artifact/artifact.toml
```toml
kind = "web"
previewPath = "/"
title = "Trading Bot Dashboard"
version = "1.0.0"
id = "artifacts/trading-dashboard"
router = "path"

[[integratedSkills]]
name = "react-vite"
version = "1.0.0"

[[services]]
name = "web"
paths = [ "/" ]
localPort = 24210

[services.development]
run = "pnpm --filter @workspace/trading-dashboard run dev"

[services.production]
build = [ "pnpm", "--filter", "@workspace/trading-dashboard", "run", "build" ]
publicDir = "artifacts/trading-dashboard/dist/public"
serve = "static"

[[services.production.rewrites]]
from = "/*"
to = "/index.html"

[services.env]
PORT = "24210"
BASE_PATH = "/"
```

## PERCORSO: artifacts/trading-dashboard/components.json
```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
      "config": "",
      "css": "src/index.css",
      "baseColor": "neutral",
      "cssVariables": true,
      "prefix": ""
    },
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils",
      "ui": "@/components/ui",
      "lib": "@/lib",
      "hooks": "@/hooks"
    }
}
```

## PERCORSO: artifacts/trading-dashboard/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>Trading Bot Dashboard</title>
    <meta name="description" content="Trading Bot Dashboard — built on Replit. Update this description to reflect the app." />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="Trading Bot Dashboard" />
    <meta property="og:description" content="Trading Bot Dashboard — built on Replit. Update this description to reflect the app." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Trading Bot Dashboard" />
    <meta name="twitter:description" content="Trading Bot Dashboard — built on Replit. Update this description to reflect the app." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## PERCORSO: artifacts/trading-dashboard/package.json
```json
{
  "name": "@workspace/trading-dashboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --config vite.config.ts --host 0.0.0.0",
    "build": "vite build --config vite.config.ts",
    "serve": "vite preview --config vite.config.ts --host 0.0.0.0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@replit/vite-plugin-cartographer": "catalog:",
    "@replit/vite-plugin-dev-banner": "catalog:",
    "@replit/vite-plugin-runtime-error-modal": "catalog:",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "catalog:",
    "@tanstack/react-query": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@workspace/api-client-react": "workspace:*",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "catalog:",
    "input-otp": "^1.4.2",
    "lucide-react": "catalog:",
    "next-themes": "^0.4.6",
    "react": "catalog:",
    "react-day-picker": "^9.11.1",
    "react-dom": "catalog:",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "catalog:",
    "tailwindcss": "catalog:",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "vite": "catalog:",
    "wouter": "^3.3.5",
    "zod": "catalog:"
  }
}
```

## PERCORSO: artifacts/trading-dashboard/public/favicon.svg
```xml
<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="180" height="180" rx="36" fill="#FF3C00"/>
</svg>
```

## PERCORSO: artifacts/trading-dashboard/public/robots.txt
```text
User-agent: *
Allow: /
```

## PERCORSO: artifacts/trading-dashboard/src/App.tsx
```tsx
import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home         = lazy(() => import("@/pages/home"));
const Analytics    = lazy(() => import("@/pages/analytics"));
const SignalDetail = lazy(() => import("@/pages/signal-detail"));
const NotFound     = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      gcTime:              300_000,
      retry:                     1,
      refetchOnWindowFocus:  false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/"            component={Home}         />
        <Route path="/analytics"   component={Analytics}    />
        <Route path="/signals/:id" component={SignalDetail} />
        <Route                     component={NotFound}     />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

## PERCORSO: artifacts/trading-dashboard/src/components/add-trade-form.tsx
```tsx
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddTrade,
  useSearchSymbols,
  getGetPortfolioQueryKey,
  getGetTradesQueryKey,
  getGetTradesLiveQueryKey,
  getGetPortfolioSummaryQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  ticker: z.string().min(1, "Ticker obbligatorio").toUpperCase(),
});

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const VERDICT_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  FORTE_BUY:  { label: "FORTE BUY",  color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  BUY:        { label: "BUY",         color: "text-green-400",   border: "border-green-500/30",   bg: "bg-green-500/10"   },
  NEUTRALE:   { label: "NEUTRALE",    color: "text-amber-400",   border: "border-amber-500/30",   bg: "bg-amber-500/10"   },
  SELL:       { label: "SELL",        color: "text-red-400",     border: "border-red-500/30",     bg: "bg-red-500/10"     },
  FORTE_SELL: { label: "FORTE SELL",  color: "text-rose-400",    border: "border-rose-500/30",    bg: "bg-rose-500/10"    },
};

export function AddTradeForm({ investAmount }: { investAmount: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addTradeMutation = useAddTrade();
  const [result, setResult] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { ticker: "" },
  });

  const debouncedTerm = useDebounced(searchTerm, 350);
  const searchQuery = useSearchSymbols(
    { q: debouncedTerm },
    { query: { enabled: debouncedTerm.trim().length >= 2 } }
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setResult(null);
    setReportOpen(false);
    addTradeMutation.mutate({ data: { ticker: values.ticker, investAmount } as any }, {
      onSuccess: (res) => {
        setResult(res);
        if (res.success && res.signal === "BUY") {
          toast({
            title: "Asset Aggiunto",
            description: res.message,
            className: "bg-primary border-primary text-primary-foreground",
          });
          queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTradesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTradesLiveQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPortfolioSummaryQueryKey() });
          form.reset();
        }
      },
      onError: (err: any) => {
        toast({
          title: "Errore",
          description: err?.response?.data?.error || "Impossibile analizzare il ticker",
          variant: "destructive",
        });
      }
    });
  };

  const cfg = result?.verdict ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <Card className="bg-card border-border rounded-sm shadow-none h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Nuova Analisi</CardTitle>
        <CardDescription className="text-xs">
          Inserisci un ticker (es. BTC/USD) per valutare e tracciare l'asset.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative" ref={containerRef}>
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Es. Apple, Ferrari, Bitcoin, AAPL..."
                        className="pl-9 font-mono bg-background border-border rounded-sm focus-visible:ring-primary h-9 text-sm"
                        {...field}
                        onChange={(e) => {
                          setResult(null);
                          const raw = e.target.value;
                          field.onChange(raw.toUpperCase());
                          setSearchTerm(raw);
                          setSuggestOpen(true);
                        }}
                        onFocus={() => { if (searchTerm.trim().length >= 2) setSuggestOpen(true); }}
                      />
                      {suggestOpen && searchTerm.trim().length >= 2 && (
                        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-sm border border-border bg-popover shadow-lg">
                          {searchQuery.isFetching && (
                            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Ricerca in corso...
                            </div>
                          )}
                          {!searchQuery.isFetching && searchQuery.data?.matches?.length ? (
                            searchQuery.data.matches.map((m) => (
                              <button
                                key={`${m.symbol}-${m.exchange ?? ""}`}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-b-0"
                                onClick={() => {
                                  field.onChange(m.symbol.toUpperCase());
                                  setSearchTerm(m.symbol);
                                  setSuggestOpen(false);
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-semibold text-foreground">{m.symbol}</span>
                                  {m.instrumentType && (
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.instrumentType}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {m.instrumentName}{m.exchange ? ` · ${m.exchange}` : ""}{m.country ? ` · ${m.country}` : ""}
                                </div>
                              </button>
                            ))
                          ) : null}
                          {!searchQuery.isFetching && searchQuery.data && searchQuery.data.matches.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-muted-foreground">
                              {searchQuery.data.note ?? "Nessun risultato trovato."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <div className="text-[10px] text-muted-foreground px-1">
                    Importo da investire: {investAmount} EUR — cerca per nome azienda, ticker o crypto
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full h-9 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
              disabled={addTradeMutation.isPending}
            >
              {addTradeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisi in corso...
                </>
              ) : (
                "Analizza & Traccia"
              )}
            </Button>
          </form>
        </Form>

        {result && cfg && (
          <div className={`animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-sm border ${cfg.border} ${cfg.bg} overflow-hidden`}>

            {/* Verdict header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${cfg.border}`}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${cfg.color} ${cfg.border} ${cfg.bg} font-mono font-bold text-xs px-2 h-6 rounded-sm`}>
                  {cfg.label}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {result.direction || "—"}
                </span>
              </div>
              <span className={`font-mono text-sm font-bold ${cfg.color}`}>
                {result.score ?? 0}/100
              </span>
            </div>

            {/* Key metrics row */}
            {(result.confidenceScore != null || result.estimatedProbability != null) && (
              <div className={`grid grid-cols-2 divide-x ${cfg.border} border-b ${cfg.border}`}>
                <div className="px-4 py-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Confidence</p>
                  <p className={`font-mono text-base font-bold ${cfg.color}`}>
                    {result.confidenceScore ?? "—"}%
                  </p>
                </div>
                <div className="px-4 py-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Probabilità</p>
                  <p className={`font-mono text-base font-bold ${cfg.color}`}>
                    {result.estimatedProbability ?? "—"}%
                  </p>
                </div>
              </div>
            )}

            {/* TP / SL */}
            {result.trade && (
              <div className={`grid grid-cols-2 divide-x ${cfg.border} border-b ${cfg.border} text-xs font-mono`}>
                <div className="px-4 py-2">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Take Profit</span>
                  <span className="text-green-400 font-semibold">{result.trade.tp}</span>
                </div>
                <div className="px-4 py-2">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-0.5">Stop Loss</span>
                  <span className="text-red-400 font-semibold">{result.trade.sl}</span>
                </div>
              </div>
            )}

            {/* Full report collapsible */}
            {result.reason && (
              <>
                <button
                  onClick={() => setReportOpen(!reportOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium"
                >
                  Report completo
                  {reportOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {reportOpen && (
                  <div className={`border-t ${cfg.border} px-4 py-3`}>
                    <pre className="text-[10px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
                      {result.reason}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/closed-trades-table.tsx
```tsx
import { useState } from "react";
import { useGetClosedTrades } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ClosedTradesTable() {
  const { data: trades, isLoading } = useGetClosedTrades();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-sm" />;
  }

  const tradesCount = trades?.length || 0;

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(val);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <Card className="bg-card border-border rounded-sm shadow-none overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
          <History className="w-4 h-4" />
          <h2>Storico Trade Completati ({tradesCount})</h2>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </div>

      {isOpen && (
        <CardContent className="p-0 border-t border-border">
          {tradesCount === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nessun trade completato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider h-10">Coppia</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider h-10">Direzione</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider h-10">Azione</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">Prezzo Ingresso</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider h-10 w-[200px]">Motivo Ingresso (Trigger)</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">SL / TP</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center h-10">Esito</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">PnL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades!.map((trade: any) => (
                      <TableRow key={trade.ticker + trade.closedAt} className="border-border hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono text-[#00E5FF] font-medium">
                          {trade.ticker}
                        </TableCell>
                        <TableCell>
                          {trade.direction === "SHORT" ? (
                            <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">SHORT</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">LONG</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-sm font-mono text-[10px] px-1.5 h-5 bg-muted">
                            {trade.direction === "LONG" ? "BUY" : "SELL"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-foreground">
                          {formatPrice(trade.entry)}
                        </TableCell>
                        <TableCell>
                          {trade.reason && (
                            <Tooltip>
                              <TooltipTrigger className="text-left">
                                <div className="text-xs italic text-amber-500/90 line-clamp-2 max-w-[200px]">
                                  {trade.reason}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                {trade.reason}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <div className="text-destructive">{formatPrice(trade.sl)}</div>
                          <div className="text-primary">{formatPrice(trade.tp)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          {trade.closeReason === "TP_HIT" ? (
                            <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">TARGET</Badge>
                          ) : trade.closeReason === "SL_HIT" ? (
                            <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">STOP</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted/50 rounded-sm font-mono text-[10px] px-1.5 h-5">MANUALE</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm font-bold ${trade.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {trade.pnl >= 0 ? "+" : ""}{formatCurrency(trade.pnl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/performance-metrics.tsx
```tsx
import { useGetPortfolioMetrics } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PerformanceMetrics() {
  const { data: metrics, isLoading } = useGetPortfolioMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-sm" />)}
      </div>
    );
  }

  if (!metrics || metrics.totalClosedTrades === 0) {
    return (
      <Card className="bg-card border-border border-dashed rounded-sm shadow-none">
        <CardContent className="flex items-center justify-center p-8 text-center text-muted-foreground">
          <p className="text-sm">Nessun trade completato — le metriche appariranno dopo il primo TP o SL.</p>
        </CardContent>
      </Card>
    );
  }

  const pnlColor = metrics.totalPnl >= 0 ? "text-green-500" : "text-red-500";
  const pfColor = metrics.profitFactor >= 1.5 ? "text-green-500" : metrics.profitFactor >= 1.0 ? "text-yellow-500" : "text-red-500";

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profitto Totale Netto</p>
          <p className={`text-3xl font-bold font-mono ${pnlColor}`}>
            {metrics.totalPnl >= 0 ? "+" : ""}{formatCurrency(metrics.totalPnl)}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profit Factor</p>
          <p className={`text-3xl font-bold font-mono ${pfColor}`}>
            {metrics.profitFactor.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">Target ideale: &gt; 1.5 — Sotto 1.0 la strategia perde</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Win Rate</p>
          <p className="text-3xl font-bold font-mono text-[#00E5FF]">
            {metrics.winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">Basato su {metrics.totalClosedTrades} trade completati</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/portfolio-summary.tsx
```tsx
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPortfolioSummary, useUpdatePortfolio, getGetPortfolioQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Hash, Target, Coins } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PortfolioSummary({ investAmount, setInvestAmount }: { investAmount: number, setInvestAmount: (val: number) => void }) {
  const { data: summary, isLoading: isLoadingSummary } = useGetPortfolioSummary();
  const updatePortfolio = useUpdatePortfolio();
  const queryClient = useQueryClient();
  const [, setQ] = useState(0);
  void updatePortfolio; void queryClient; void setQ;

  if (isLoadingSummary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[100px] rounded-sm" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-card border-border rounded-sm shadow-none bg-primary/5 border-primary/20 col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">
            Importo per Trade
          </CardTitle>
          <Coins className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              value={investAmount}
              onChange={(e) => setInvestAmount(Number(e.target.value) || 0)}
              className="h-8 text-lg font-bold font-mono w-24 bg-transparent border-primary/20 focus-visible:ring-primary px-2"
            />
            <span className="text-sm font-medium text-primary">EUR</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Segnali BUY
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono text-primary tracking-tight">
            {summary?.buySignals || 0}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Score Medio
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {summary?.avgScore ? summary.avgScore.toFixed(1) : "0.0"}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Totale Asset
          </CardTitle>
          <Hash className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {summary?.totalTrades || 0}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/quality-filter.tsx
```tsx
import { useState, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FilterSettings {
  minScore: number;
  minConfidence: number;
  minConfluence: number;
}

const TIER_INFO = [
  { tier: "ELITE",   icon: "🏆", color: "text-amber-400",  border: "border-amber-500/30",  bg: "bg-amber-500/10",  req: "Score ≥85 · Confidence ≥70% · Confluenza ≥5/6" },
  { tier: "FORTE",   icon: "⭐", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", req: "Score ≥75 · Confidence ≥65%"                    },
  { tier: "NORMALE", icon: "📊", color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-500/10",   req: "Score ≥70 · Confidence ≥60%"                    },
] as const;

// ─── Slider field ─────────────────────────────────────────────────────────────

const SliderField = memo(function SliderField({
  label, value, min, max, description, onChange,
}: {
  label: string; value: number; min: number; max: number;
  description: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="font-mono text-sm font-bold text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
        }}
      />
      <p className="text-[9px] text-muted-foreground">{description}</p>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export const QualityFilter = memo(function QualityFilter() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<FilterSettings>({
    queryKey: ["quality-filter"],
    queryFn: () => apiFetch("/api/signals/quality-filter"),
    staleTime: 60_000,
  });

  const [minScore,      setMinScore]      = useState(70);
  const [minConfidence, setMinConfidence] = useState(60);
  const [minConfluence, setMinConfluence] = useState(4);
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    if (data) {
      setMinScore(data.minScore ?? 70);
      setMinConfidence(data.minConfidence ?? 60);
      setMinConfluence(data.minConfluence ?? 4);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: Partial<FilterSettings>) =>
      apiFetch("/api/signals/quality-filter", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality-filter"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="py-6 text-center text-xs text-muted-foreground animate-pulse">Caricamento...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          Filtro Qualità Segnali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-5">
          <SliderField
            label="Score Minimo"
            value={minScore} min={50} max={100}
            description="Solo segnali con score ≥ questa soglia vengono inviati su Telegram"
            onChange={setMinScore}
          />
          <SliderField
            label="Confidence Minima"
            value={minConfidence} min={40} max={95}
            description="Filtra per livello di confidence del modello"
            onChange={setMinConfidence}
          />
          <SliderField
            label="Confluenza Minima (fattori/6)"
            value={minConfluence} min={1} max={6}
            description="Quanti dei 6 fattori (Trend, Momentum, Volume, Struttura, MTF, Volatilità) devono essere allineati"
            onChange={setMinConfluence}
          />
        </div>

        <Button
          onClick={() => mutation.mutate({ minScore, minConfidence, minConfluence })}
          disabled={mutation.isPending}
          className="w-full h-9 rounded-sm"
          size="sm"
        >
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Salvataggio...</>
          ) : saved ? (
            <><CheckCircle2 className="mr-2 h-3 w-3 text-emerald-400" />Salvato</>
          ) : (
            "Salva Impostazioni"
          )}
        </Button>

        <div className="space-y-2 pt-1">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Livelli di Qualità</p>
          {TIER_INFO.map(t => (
            <div key={t.tier} className={`rounded-sm border ${t.border} ${t.bg} px-3 py-2`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{t.icon}</span>
                <span className={`text-xs font-bold font-mono ${t.color}`}>{t.tier}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">{t.req}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
```

## PERCORSO: artifacts/trading-dashboard/src/components/signal-list.tsx
```tsx
import { useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { apiFetch, formatPrice } from "@/lib/api";

type SignalStatus = "PENDING" | "WIN" | "LOSS" | "EXPIRED";
type FilterKey   = "ALL" | SignalStatus;

interface SignalRow {
  id: number;
  asset: string;
  direction: string;
  status: SignalStatus;
  quality_tier?: string;
  score: number;
  confidence_score: number;
  confluence: number;
  market_regime?: string;
  entry_price: number;
  tp: number;
  sl: number;
  profit_pct?: number;
  created_at: string;
}

const STATUS_CFG: Record<SignalStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: "Attivo",  color: "text-amber-400",        bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  WIN:     { label: "WIN",     color: "text-emerald-400",      bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  LOSS:    { label: "LOSS",    color: "text-rose-400",         bg: "bg-rose-500/10",    border: "border-rose-500/30"    },
  EXPIRED: { label: "Scaduto", color: "text-muted-foreground", bg: "bg-muted/20",       border: "border-border"         },
};

const TIER_CFG: Record<string, string> = {
  ELITE:   "text-amber-400  border-amber-500/40  bg-amber-500/10",
  FORTE:   "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  NORMALE: "text-blue-400   border-blue-500/40   bg-blue-500/10",
};

const FILTER_OPTIONS: FilterKey[] = ["ALL", "PENDING", "WIN", "LOSS"];
const PAGE_SIZE = 20;

const SignalRowItem = memo(function SignalRowItem({ sig, onClick }: { sig: SignalRow; onClick: () => void }) {
  const st  = sig.status ?? "PENDING";
  const cfg = STATUS_CFG[st] ?? STATUS_CFG.PENDING;
  const profitColor = st === "WIN" ? "text-emerald-400" : st === "LOSS" ? "text-rose-400" : "text-muted-foreground";

  return (
    <div
      onClick={onClick}
      className={`border ${cfg.border} ${cfg.bg} rounded-sm px-3 py-2 space-y-1.5 cursor-pointer hover:brightness-110 transition-all group`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">{sig.asset}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
            sig.direction === "LONG"
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : "text-rose-400   border-rose-500/30   bg-rose-500/10"
          }`}>
            {sig.direction}
          </span>
          {sig.quality_tier && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ${TIER_CFG[sig.quality_tier] ?? "text-muted-foreground border-border"}`}>
              {sig.quality_tier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(st === "WIN" || st === "LOSS") && sig.profit_pct != null && (
            <span className={`font-mono text-xs font-bold ${profitColor}`}>
              {sig.profit_pct >= 0 ? "+" : ""}{sig.profit_pct.toFixed(2)}%
            </span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${cfg.border} ${cfg.color}`}>
            {cfg.label}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono">
        <span>Score: <span className="text-foreground">{sig.score}</span></span>
        <span>Conf: <span className="text-foreground">{sig.confidence_score}%</span></span>
        <span>Confluenza: <span className="text-foreground">{sig.confluence}/6</span></span>
        {sig.market_regime && (
          <span className="hidden sm:inline">Regime: <span className="text-foreground">{sig.market_regime}</span></span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[9px] font-mono">
        <span className="text-muted-foreground">Entrata: <span className="text-foreground">{formatPrice(sig.entry_price)}</span></span>
        <span className="text-emerald-400/70">TP: {formatPrice(sig.tp)}</span>
        <span className="text-rose-400/70">SL: {formatPrice(sig.sl)}</span>
        <span className="text-muted-foreground ml-auto">
          {new Date(sig.created_at).toLocaleString("it-IT", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
});

export const SignalList = memo(function SignalList() {
  const [page,         setPage]         = useState(0);
  const [filterStatus, setFilterStatus] = useState<FilterKey>("ALL");
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["signals-list", page, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      return apiFetch<{ signals: SignalRow[]; total: number }>(`/api/signals?${params}`);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const signals = data?.signals ?? [];
  const total   = data?.total   ?? 0;
  const pages   = Math.ceil(total / PAGE_SIZE);

  const handleFilter = (f: FilterKey) => { setFilterStatus(f); setPage(0); };

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Storico Segnali DB
            {total > 0 && (
              <Badge variant="outline" className="text-[9px] font-mono border-border text-muted-foreground h-4 px-1.5 rounded-sm">
                {total}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors font-medium ${
                  filterStatus === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "ALL" ? "Tutti" : f}
              </button>
            ))}
          </div>
        </div>
        {total > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Clicca su un segnale per vedere l'analisi completa e il breakdown dei fattori
          </p>
        )}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="text-xs text-muted-foreground text-center py-6 animate-pulse">Caricamento...</div>
        )}

        {!isLoading && signals.length === 0 && (
          <div className="text-center py-8 space-y-1">
            <p className="text-xs text-muted-foreground">Nessun segnale registrato</p>
            <p className="text-[10px] text-muted-foreground/60">
              I segnali vengono salvati automaticamente ad ogni analisi
            </p>
          </div>
        )}

        {!isLoading && signals.length > 0 && (
          <div className="space-y-2">
            {signals.map(sig => (
              <SignalRowItem
                key={sig.id}
                sig={sig}
                onClick={() => navigate(`/signals/${sig.id}`)}
              />
            ))}

            {pages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Precedenti
                </button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= pages - 1}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  Successivi <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
```

## PERCORSO: artifacts/trading-dashboard/src/components/signal-stats.tsx
```tsx
import { useState, memo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Layers, Globe } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Tab = "globale" | "score" | "confidence" | "confluenza";

// ─── Sub-components (memoised) ────────────────────────────────────────────────

const WinRateBar = memo(function WinRateBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate));
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  const textColor = pct >= 60 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs w-9 text-right font-bold ${textColor}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
});

const StatKV = memo(function StatKV({ label, value, suffix = "" }: { label: string; value: number | undefined; suffix?: string }) {
  const v = value ?? 0;
  const color = v >= 60 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex justify-between items-center py-1.5 px-2 border border-border/50 rounded-sm bg-background/30">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-xs font-bold ${color}`}>{v}{suffix}</span>
    </div>
  );
});

// ─── Global stats tab ─────────────────────────────────────────────────────────

function GlobalStats() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["signals-global"],
    queryFn: () => apiFetch("/api/signals/stats/global"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <Placeholder />;
  if (error || !data) return <ErrorMsg />;

  const d = data as Record<string, number>;
  const totalClosed = d.wins + d.losses;
  const isValidated  = totalClosed >= 100;
  const isPreliminary = totalClosed >= 30 && !isValidated;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Segnali totali registrati</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{d.totalSignals}</span>
          {isValidated && (
            <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 h-4 px-1.5 rounded-sm">✓ Validato</Badge>
          )}
          {isPreliminary && (
            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30 bg-amber-500/10 h-4 px-1.5 rounded-sm">~ Preliminare</Badge>
          )}
          {!isPreliminary && !isValidated && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground border-border h-4 px-1.5 rounded-sm">Insufficiente ({totalClosed}/30)</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "In attesa", value: d.pendingSignals, color: "text-amber-400" },
          { label: "Chiusi",    value: d.closedSignals,  color: "text-foreground"        },
          { label: "Scaduti",   value: d.expired,        color: "text-muted-foreground"  },
        ].map(s => (
          <div key={s.label} className="bg-background/50 border border-border rounded-sm p-3 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-sm p-3 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">WIN</p>
          <p className="font-mono text-2xl font-bold text-emerald-400">{d.wins}</p>
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-sm p-3 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">LOSS</p>
          <p className="font-mono text-2xl font-bold text-rose-400">{d.losses}</p>
        </div>
      </div>

      <div>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Win Rate</p>
        <WinRateBar rate={d.winRate} />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <StatKV label="Profit Factor" value={d.profitFactor}   suffix="x" />
        <StatKV label="Avg Return"    value={d.avgReturn}      suffix="%" />
        <StatKV label="Expectancy"    value={d.expectancy}     suffix="%" />
        <StatKV label="Max Drawdown"  value={d.maxDrawdown}    suffix="%" />
        <StatKV label="ROI Teorico"   value={d.roiTheoretical} suffix="%" />
        <StatKV label="Avg Drawdown"  value={d.avgDrawdown}    suffix="%" />
      </div>
    </div>
  );
}

// ─── Range stats tab ──────────────────────────────────────────────────────────

const RangeStatsTable = memo(function RangeStatsTable({
  endpoint, label,
}: { endpoint: string; label: string }) {
  const { data, isLoading } = useQuery({
    queryKey: [`signals-stats-${endpoint}`],
    queryFn: () => apiFetch(`/api/signals/stats/${endpoint}`),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) return <Placeholder />;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground">Nessun dato disponibile</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">I dati appariranno dopo aver chiuso i primi segnali</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 pb-1 border-b border-border">
        {[label, "W/L", "WR", "PF"].map(h => (
          <span key={h} className="text-[9px] text-muted-foreground uppercase tracking-wider text-right first:text-left">{h}</span>
        ))}
      </div>
      {(data as Record<string, number | string>[]).map((row) => (
        <div key={row.label as string} className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 items-center">
            <span className="text-xs text-foreground font-medium truncate">{row.label}</span>
            <span className="text-[10px] font-mono text-muted-foreground text-right whitespace-nowrap">
              {row.wins}W/{row.losses}L
            </span>
            <span className={`text-[10px] font-mono text-right font-bold whitespace-nowrap ${
              (row.winRate as number) >= 60 ? "text-emerald-400" :
              (row.winRate as number) >= 40 ? "text-amber-400"   : "text-rose-400"
            }`}>
              {row.winRate}%
            </span>
            <span className="text-[10px] font-mono text-right text-muted-foreground whitespace-nowrap">
              {row.profitFactor}x
            </span>
          </div>
          <div className="px-2">
            <WinRateBar rate={row.winRate as number} />
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Skeleton / error states ──────────────────────────────────────────────────

function Placeholder() {
  return <div className="text-xs text-muted-foreground py-6 text-center animate-pulse">Caricamento...</div>;
}

function ErrorMsg() {
  return <div className="text-xs text-rose-400 py-4 text-center">Errore caricamento dati</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "globale",    label: "Globale",    icon: <Globe className="w-3 h-3" /> },
  { id: "score",      label: "Score",      icon: <BarChart2 className="w-3 h-3" /> },
  { id: "confidence", label: "Confidence", icon: <TrendingUp className="w-3 h-3" /> },
  { id: "confluenza", label: "Confluenza", icon: <Layers className="w-3 h-3" /> },
];

export const SignalStats = memo(function SignalStats() {
  const [tab, setTab] = useState<Tab>("globale");

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          Statistiche Segnali
        </CardTitle>
      </CardHeader>

      <div className="flex border-b border-border mx-6 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <CardContent>
        {tab === "globale"    && <GlobalStats />}
        {tab === "score"      && <RangeStatsTable endpoint="score"      label="Range Score" />}
        {tab === "confidence" && <RangeStatsTable endpoint="confidence" label="Confidence Range" />}
        {tab === "confluenza" && (
          <div className="space-y-6">
            <RangeStatsTable endpoint="confluence" label="Confluenza (fattori/6)" />
            <div className="border-t border-border pt-4">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-3">Per Regime di Mercato</p>
              <RangeStatsTable endpoint="regime" label="Regime" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
```

## PERCORSO: artifacts/trading-dashboard/src/components/trades-table.tsx
```tsx
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTradesLive,
  useDeleteTrade,
  getGetPortfolioQueryKey,
  getGetTradesQueryKey,
  getGetTradesLiveQueryKey,
  getGetPortfolioSummaryQueryKey,
  getGetPortfolioMetricsQueryKey,
  getGetClosedTradesQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, AlertCircle, Info, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const REFRESH_INTERVAL_MS = 30_000;

function adaptivePrice(val: number): string {
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  let decimals: number;
  if (abs >= 10000) decimals = 2;
  else if (abs >= 1000) decimals = 2;
  else if (abs >= 100) decimals = 3;
  else if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 6;
  else decimals = 8;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function formatPnl(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)} €`;
}

export function TradesTable() {
  const { data: trades, isLoading, dataUpdatedAt, refetch } = useGetTradesLive(
    {},
    { query: { refetchInterval: REFRESH_INTERVAL_MS } }
  );
  const deleteTrade = useDeleteTrade();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL_MS / 1000;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_MS / 1000);
  }, [dataUpdatedAt]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    setCountdown(REFRESH_INTERVAL_MS / 1000);
  };

  const handleStop = (ticker: string) => {
    deleteTrade.mutate({ ticker }, {
      onSuccess: (res) => {
        toast({ title: "Monitoraggio Interrotto", description: res.message });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTradesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTradesLiveQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioMetricsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetClosedTradesQueryKey() });
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile interrompere il monitoraggio.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full rounded-sm" />
            <Skeleton className="h-12 w-full rounded-sm" />
            <Skeleton className="h-12 w-full rounded-sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed rounded-sm shadow-none">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-4 opacity-50" />
          <p className="text-sm font-medium">Nessun asset sotto monitoraggio.</p>
          <p className="text-xs mt-1 opacity-70">Aggiungi un ticker usando il modulo per iniziare.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="bg-card border-border rounded-sm shadow-none overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {trades.length} asset live
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-mono">
              aggiorn. in <span className="text-primary font-semibold">{countdown}s</span>
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-semibold text-xs uppercase tracking-wider h-10">Asset</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider h-10">Dir.</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">Investito</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">Ingresso</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">TP</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">SL</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">
                  <span className="flex items-center justify-end gap-1">
                    Prezzo Live
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  </span>
                </TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10">PnL Non Real.</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right h-10 w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade: any) => {
                const hasPnl = trade.unrealizedPnl !== null && trade.unrealizedPnl !== undefined;
                const pnlPositive = hasPnl && trade.unrealizedPnl >= 0;
                const pct = trade.priceChangePercent;

                return (
                  <TableRow key={trade.ticker} className="border-border hover:bg-muted/20 transition-colors">
                    <TableCell className="font-mono text-[#00E5FF] font-medium">
                      {trade.ticker}
                    </TableCell>
                    <TableCell>
                      {trade.direction === "SHORT" ? (
                        <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">SHORT</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">LONG</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {trade.investAmount} €
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {adaptivePrice(trade.entry)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-500">
                      {adaptivePrice(trade.tp)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-500">
                      {adaptivePrice(trade.sl)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.currentPrice !== null ? (
                        <span className="text-foreground">
                          {adaptivePrice(trade.currentPrice)}
                          {pct !== null && (
                            <span className={`ml-1.5 text-[10px] ${pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {pct >= 0 ? "+" : ""}{pct?.toFixed(2)}%
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${hasPnl ? (pnlPositive ? "text-green-500" : "text-red-500") : "text-muted-foreground"}`}>
                      {hasPnl ? formatPnl(trade.unrealizedPnl) : "—"}
                    </TableCell>
                    <TableCell className="text-right p-2 flex items-center justify-end gap-1">
                      {trade.reason && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Info className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed p-3">
                            {trade.reason}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm"
                        onClick={() => handleStop(trade.ticker)}
                        disabled={deleteTrade.isPending && deleteTrade.variables?.ticker === trade.ticker}
                      >
                        {deleteTrade.isPending && deleteTrade.variables?.ticker === trade.ticker ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </TooltipProvider>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/accordion.tsx
```tsx
import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/alert-dialog.tsx
```tsx
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/alert.tsx
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/aspect-ratio.tsx
```tsx
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

const AspectRatio = AspectRatioPrimitive.Root

export { AspectRatio }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/avatar.tsx
```tsx
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/badge.tsx
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // @replit no hover because we use hover-elevate
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
          // @replit shadow-xs" - use badge outline variable
        outline: "text-foreground border [border-color:var(--badge-outline)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/breadcrumb.tsx
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    )}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/button-group.tsx
```tsx
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      className={cn(
        "bg-muted shadow-xs flex items-center gap-2 rounded-md border px-4 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto",
        className
      )}
      {...props}
    />
  )
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/button.tsx
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           // @replit: no hover, and add primary border
           "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
        outline:
          // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color. Uses shadow-xs. no shadow on active
          // No hover state
          " border [border-color:var(--button-outline)] shadow-xs active:shadow-none ",
        secondary:
          // @replit border, no hover, no shadow, secondary border.
          "border bg-secondary text-secondary-foreground border border-secondary-border ",
        // @replit no hover, transparent border
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/calendar.tsx
```tsx
"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[--cell-size] select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "bg-accent rounded-l-md",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-[--cell-size] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/card.tsx
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/carousel.tsx
```tsx
import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins
    )
    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return
      }

      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
      api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
      if (!api || !setApi) {
        return
      }

      setApi(api)
    }, [api, setApi])

    React.useEffect(() => {
      if (!api) {
        return
      }

      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api?.off("select", onSelect)
      }
    }, [api, onSelect])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
})
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute  h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})
CarouselNext.displayName = "CarouselNext"

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/chart.tsx
```tsx
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`
              const itemConfig = getPayloadConfigFromPayload(config, item, key)
              const indicatorColor = color || item.payload.fill || item.color

              return (
                <div
                  key={item.dataKey}
                  className={cn(
                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                    indicator === "dot" && "items-center"
                  )}
                >
                  {formatter && item?.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn(
                              "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                              {
                                "h-2.5 w-2.5": indicator === "dot",
                                "w-1": indicator === "line",
                                "w-0 border-[1.5px] border-dashed bg-transparent":
                                  indicator === "dashed",
                                "my-0.5": nestLabel && indicator === "dashed",
                              }
                            )}
                            style={
                              {
                                "--color-bg": indicatorColor,
                                "--color-border": indicatorColor,
                              } as React.CSSProperties
                            }
                          />
                        )
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "items-end" : "items-center"
                        )}
                      >
                        <div className="grid gap-1.5">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-muted-foreground">
                            {itemConfig?.label || item.name}
                          </span>
                        </div>
                        {item.value && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {item.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload
          .filter((item) => item.type !== "none")
          .map((item) => {
            const key = `${nameKey || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)

            return (
              <div
                key={item.value}
                className={cn(
                  "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
                )}
              >
                {itemConfig?.icon && !hideIcon ? (
                  <itemConfig.icon />
                ) : (
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />
                )}
                {itemConfig?.label}
              </div>
            )
          })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/checkbox.tsx
```tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/collapsible.tsx
```tsx
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/command.tsx
```tsx
"use client"

import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = "CommandShortcut"

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/context-menu.tsx
```tsx
import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root

const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuPortal = ContextMenuPrimitive.Portal

const ContextMenuSub = ContextMenuPrimitive.Sub

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
      className
    )}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-[--radix-context-menu-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold text-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/dialog.tsx
```tsx
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/drawer.tsx
```tsx
import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/dropdown-menu.tsx
```tsx
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/empty.tsx
```tsx
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/field.tsx
```tsx
"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-medium",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field data-[invalid=true]:text-destructive flex w-full gap-3",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px has-[>[data-slot=field-content]]:items-start",
        ],
        responsive: [
          "@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto flex-col [&>*]:w-full [&>.sr-only]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>[data-slot=field]]:p-4",
        "has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium leading-snug group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-sm font-normal leading-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
        "nth-last-2:-mt-1 last:mt-0 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors) {
      return null
    }

    if (errors?.length === 1 && errors[0]?.message) {
      return errors[0].message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-destructive text-sm font-normal", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/form.tsx
```tsx
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/hover-card.tsx
```tsx
import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-hover-card-content-transform-origin]",
      className
    )}
    {...props}
  />
))
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/input-group.tsx
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group border-input dark:bg-input/30 shadow-xs relative flex w-full items-center rounded-md border outline-none transition-[color,box-shadow]",
        "h-9 has-[>textarea]:h-auto",

        // Variants based on alignment.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "has-[[data-slot=input-group-control]:focus-visible]:ring-ring has-[[data-slot=input-group-control]:focus-visible]:ring-1",

        // Error state.
        "has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text select-none items-center justify-center gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.4rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "[.border-b]:pb-3 order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5",
        "block-end":
          "[.border-t]:pt-3 order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/input-otp.tsx
```tsx
import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/input.tsx
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/item.tsx
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  )
}

function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-0", className)}
      {...props}
    />
  )
}

const itemVariants = cva(
  "group/item [a]:hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 [a]:transition-colors flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors duration-100 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "gap-4 p-4 ",
        sm: "gap-2.5 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"
  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  )
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted size-8 rounded-sm border [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...props}
    />
  )
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium leading-snug",
        className
      )}
      {...props}
    />
  )
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "text-muted-foreground line-clamp-2 text-balance text-sm font-normal leading-normal",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/kbd.tsx
```tsx
import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/label.tsx
```tsx
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/menubar.tsx
```tsx
import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

function MenubarMenu({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group {...props} />
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal {...props} />
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup {...props} />
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-9 items-center space-x-1 rounded-md border bg-background p-1 shadow-sm",
      className
    )}
    {...props}
  />
))
Menubar.displayName = MenubarPrimitive.Root.displayName

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      className
    )}
    {...props}
  />
))
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
))
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
      className
    )}
    {...props}
  />
))
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(
  (
    { className, align = "start", alignOffset = -4, sideOffset = 8, ...props },
    ref
  ) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
)
MenubarContent.displayName = MenubarPrimitive.Content.displayName

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarItem.displayName = MenubarPrimitive.Item.displayName

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
))
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
))
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarLabel.displayName = MenubarPrimitive.Label.displayName

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName

const MenubarShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
MenubarShortcut.displayname = "MenubarShortcut"

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/navigation-menu.tsx
```tsx
import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(
      "relative z-10 flex max-w-max flex-1 items-center justify-center",
      className
    )}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex flex-1 list-none items-center justify-center space-x-1",
      className
    )}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent"
)

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto ",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
))
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/pagination.tsx
```tsx
import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/popover.tsx
```tsx
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/progress.tsx
```tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/radio-group.tsx
```tsx
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/resizable.tsx
```tsx
"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/scroll-area.tsx
```tsx
import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/select.tsx
```tsx
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/separator.tsx
```tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/sheet.tsx
```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/sidebar.tsx
```tsx
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, VariantProps } from "class-variance-authority"
import { PanelLeftIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-[var(--sidebar-width)] flex-col",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-[var(--sidebar-width)] p-0 [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing-4))]"
            : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing-4)+2px)]"
            : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  // Note: Tailwind v3.4 doesn't support "in-" selectors. So the rail won't work perfectly.
  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("bg-background h-8 w-full shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:w-8! group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-[var(--skeleton-width)] flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline outline-2 outline-transparent outline-offset-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/skeleton.tsx
```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/slider.tsx
```tsx
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/sonner.tsx
```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/spinner.tsx
```tsx
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/switch.tsx
```tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/table.tsx
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/tabs.tsx
```tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/textarea.tsx
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/toast.tsx
```tsx
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/toaster.tsx
```tsx
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/toggle-group.tsx
```tsx
"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/toggle.tsx
```tsx
import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
```

## PERCORSO: artifacts/trading-dashboard/src/components/ui/tooltip.tsx
```tsx
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

## PERCORSO: artifacts/trading-dashboard/src/hooks/use-mobile.tsx
```tsx
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
```

## PERCORSO: artifacts/trading-dashboard/src/hooks/use-toast.ts
```ts
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
```

## PERCORSO: artifacts/trading-dashboard/src/index.css
```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-card-border: hsl(var(--card-border));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-popover-border: hsl(var(--popover-border));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-primary-border: var(--primary-border);

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-secondary-border: var(--secondary-border);

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-muted-border: var(--muted-border);

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-accent-border: var(--accent-border);

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-destructive-border: var(--destructive-border);

  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));

  --color-sidebar: hsl(var(--sidebar));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-primary-border: var(--sidebar-primary-border);
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-accent-border: var(--sidebar-accent-border);
  --color-sidebar-ring: hsl(var(--sidebar-ring));

  --font-sans: var(--app-font-sans);
  --font-serif: var(--app-font-serif);
  --font-mono: var(--app-font-mono);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root, .dark {
  --button-outline: rgba(255,255,255, .10);
  --badge-outline: rgba(255,255,255, .05);

  --opaque-button-border-intensity: 9;

  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);

  /* Deep dark terminal background */
  --background: 220 10% 4%;
  --foreground: 180 5% 90%;

  --border: 220 10% 12%;
  
  --card: 220 10% 6%;
  --card-foreground: 180 5% 90%;
  --card-border: 220 10% 12%;

  --popover: 220 10% 6%;
  --popover-foreground: 180 5% 90%;
  --popover-border: 220 10% 12%;

  /* #059669 / green-600 */
  --primary: 161 94% 30%;
  --primary-foreground: 0 0% 100%;

  --secondary: 220 10% 12%;
  --secondary-foreground: 0 0% 100%;

  --muted: 220 10% 12%;
  --muted-foreground: 220 10% 60%;

  --accent: 220 10% 12%;
  --accent-foreground: 0 0% 100%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  --input: 220 10% 15%;
  --ring: 161 94% 30%;

  --chart-1: 161 94% 30%;
  --chart-2: 0 84% 60%;
  --chart-3: 190 90% 50%; /* cyan */
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;

  --app-font-sans: 'Inter', sans-serif;
  --app-font-serif: Georgia, serif;
  --app-font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  
  --radius: 0.25rem;

  --shadow-2xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 1px 2px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 2px 4px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 4px 6px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00), 0px 8px 10px -1px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(202.8169 89.1213% 53.1373% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --sidebar: 220 10% 4%;
  --sidebar-foreground: 180 5% 90%;
  --sidebar-border: 220 10% 12%;
  --sidebar-primary: 161 94% 30%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 220 10% 12%;
  --sidebar-accent-foreground: 180 5% 90%;
  --sidebar-ring: 161 94% 30%;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
  
  /* Make all numbers monospace globally in data contexts if desired, but we will apply it explicitly to components */
}
```

## PERCORSO: artifacts/trading-dashboard/src/lib/api.ts
```ts
/**
 * Shared API fetch utility for the trading dashboard.
 * Centralises BASE_URL resolution and error handling.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Adaptive decimal formatter — consistent across all components. */
export function formatPrice(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  const dec =
    abs >= 10_000 ? 2 :
    abs >= 1_000  ? 2 :
    abs >= 100    ? 3 :
    abs >= 1      ? 4 :
    abs >= 0.01   ? 6 : 8;
  return val.toFixed(dec);
}
```

## PERCORSO: artifacts/trading-dashboard/src/lib/utils.ts
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## PERCORSO: artifacts/trading-dashboard/src/main.tsx
```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

## PERCORSO: artifacts/trading-dashboard/src/pages/analytics.tsx
```tsx
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { ArrowLeft, TrendingUp, BarChart2, Layers, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  win:  "#10b981",
  loss: "#f43f5e",
  blue: "#3b82f6",
  amber:"#f59e0b",
  purple:"#a855f7",
  cyan: "#06b6d4",
  muted:"#4b5563",
  text: "#e5e7eb",
  grid: "#1f2937",
};

const winRateColor = (wr: number) =>
  wr >= 60 ? C.win : wr >= 40 ? C.amber : C.loss;

// ─── Shared chart wrapper ─────────────────────────────────────────────────────

const ChartCard = memo(function ChartCard({
  title, icon, children, className = "",
}: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`bg-card border-border rounded-sm shadow-none ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ msg = "Nessun dato ancora disponibile. Chiudi alcuni segnali per vedere i grafici." }) {
  return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-xs text-muted-foreground text-center px-8">{msg}</p>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CT({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-sm px-3 py-2 text-xs">
      {label && <p className="text-muted-foreground mb-1 font-mono">{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Individual charts ────────────────────────────────────────────────────────

function EquityCurveChart() {
  const { data = [] } = useQuery<{ date: string; cumProfit: number; dailyProfit: number }[]>({
    queryKey: ["analytics-equity"],
    queryFn: () => apiFetch("/api/analytics/equity-curve"),
    staleTime: 60_000, refetchInterval: 120_000,
  });
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={d => d.slice(5)} />
        <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} />
        <Tooltip content={<CT />} />
        <Line type="monotone" dataKey="cumProfit" name="P&L Cumulativo %" stroke={C.win} dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="dailyProfit" name="P&L Giornaliero %" stroke={C.blue} dot={false} strokeWidth={1} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RollingWinRateChart() {
  const { data = [] } = useQuery<{ idx: number; winRate: number; profitFactor: number; avgReturn: number }[]>({
    queryKey: ["analytics-rolling"],
    queryFn: () => apiFetch("/api/analytics/rolling"),
    staleTime: 60_000, refetchInterval: 120_000,
  });
  if (!data.length) return <Empty msg="Servono almeno 20 segnali chiusi per il rolling." />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey="idx" tick={{ fill: C.muted, fontSize: 10 }} />
        <YAxis yAxisId="wr"  tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
        <YAxis yAxisId="pf" orientation="right" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v}x`} />
        <Tooltip content={<CT />} />
        <Line yAxisId="wr" type="monotone" dataKey="winRate"      name="Win Rate %"     stroke={C.win}    dot={false} strokeWidth={2} />
        <Line yAxisId="pf" type="monotone" dataKey="profitFactor" name="Profit Factor x" stroke={C.amber}  dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DistributionChart({ endpoint, xKey, title, color = C.blue }: {
  endpoint: string; xKey: string; title: string; color?: string;
}) {
  const { data = [] } = useQuery<{ label: string; total: number; wins: number; losses: number; winRate: number }[]>({
    queryKey: ["analytics-dist", endpoint],
    queryFn: () => apiFetch(`/api/analytics/dist/${endpoint}`),
    staleTime: 120_000, refetchInterval: 180_000,
  });
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey={xKey} tick={{ fill: C.muted, fontSize: 9 }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
        <Tooltip content={<CT />} />
        <Bar dataKey="wins"   name="WIN"   stackId="a" fill={C.win}  />
        <Bar dataKey="losses" name="LOSS"  stackId="a" fill={C.loss} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AssetPerformanceChart() {
  const { data = [] } = useQuery<{ asset: string; total: number; winRate: number; avgReturn: number }[]>({
    queryKey: ["analytics-by-asset"],
    queryFn: () => apiFetch("/api/analytics/by-asset"),
    staleTime: 120_000, refetchInterval: 180_000,
  });
  if (!data.length) return <Empty />;
  const sorted = [...data].sort((a, b) => b.total - a.total).slice(0, 15);
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: C.muted, fontSize: 10 }} />
        <YAxis type="category" dataKey="asset" tick={{ fill: C.muted, fontSize: 10 }} width={60} />
        <Tooltip content={<CT />} />
        <Bar dataKey="winRate" name="Win Rate %" radius={[0, 3, 3, 0]}>
          {sorted.map((d, i) => (
            <Cell key={i} fill={winRateColor(d.winRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HeatmapChart({ type }: { type: "dow" | "hour" }) {
  const { data } = useQuery<{
    byDow: { dow: number; label: string; wins: number; losses: number; winRate: number }[];
    byHour: { hour: number; wins: number; losses: number; winRate: number }[];
  }>({
    queryKey: ["analytics-heatmap"],
    queryFn: () => apiFetch("/api/analytics/heatmap"),
    staleTime: 120_000,
  });

  const arr = type === "dow"
    ? (data?.byDow ?? []).map(d => ({ label: d.label, ...d }))
    : (data?.byHour ?? []).map(d => ({ label: `${d.hour}h`, ...d }));

  if (!arr.length) return <Empty />;

  const maxWins = Math.max(...arr.map(d => d.wins + d.losses), 1);

  return (
    <div className={`grid gap-1.5 ${type === "dow" ? "grid-cols-7" : "grid-cols-8 sm:grid-cols-12"}`}>
      {arr.map((d, i) => {
        const total = d.wins + d.losses;
        const alpha = total / maxWins;
        const wr = d.winRate ?? 0;
        const bg = wr >= 60 ? `rgba(16,185,129,${0.15 + alpha * 0.6})`
                 : wr >= 40 ? `rgba(245,158,11,${0.15 + alpha * 0.6})`
                 : total === 0 ? "rgba(30,30,30,0.4)"
                 : `rgba(244,63,94,${0.15 + alpha * 0.6})`;
        return (
          <div
            key={i}
            title={`${d.label}: ${total} segnali, WR ${wr}%`}
            className="rounded-sm aspect-square flex flex-col items-center justify-center cursor-default"
            style={{ background: bg }}
          >
            <span className="text-[9px] text-white/80 font-mono font-bold">{d.label}</span>
            {total > 0 && <span className="text-[8px] text-white/60">{wr}%</span>}
          </div>
        );
      })}
    </div>
  );
}

function ScatterPlot({ xKey, xLabel }: { xKey: "score" | "confidence" | "confluence"; xLabel: string }) {
  const { data = [] } = useQuery<{ id: number; status: string; score: number; confidence: number; confluence: number; profit: number }[]>({
    queryKey: ["analytics-scatter"],
    queryFn: () => apiFetch("/api/analytics/scatter"),
    staleTime: 120_000,
  });
  if (!data.length) return <Empty />;
  const wins   = data.filter(d => d.status === "WIN");
  const losses = data.filter(d => d.status === "LOSS");
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey={xKey}    name={xLabel}    tick={{ fill: C.muted, fontSize: 10 }} />
        <YAxis dataKey="profit"  name="Profit %"  tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v}%`} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div className="bg-card border border-border rounded-sm px-3 py-2 text-xs font-mono">
              <p className="text-foreground">{d.asset} #{d.id}</p>
              <p className="text-muted-foreground">{xLabel}: {d[xKey]}</p>
              <p className={d.profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                Profit: {d.profit >= 0 ? "+" : ""}{d.profit.toFixed(2)}%
              </p>
            </div>
          );
        }} />
        <Legend />
        <Scatter name="WIN"  data={wins}   fill={C.win}  fillOpacity={0.7} />
        <Scatter name="LOSS" data={losses} fill={C.loss} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function DirectionChart() {
  const { data = [] } = useQuery<{ direction: string; total: number; wins: number; losses: number; winRate: number; avgReturn: number }[]>({
    queryKey: ["analytics-direction"],
    queryFn: () => apiFetch("/api/analytics/direction"),
    staleTime: 120_000,
  });
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis dataKey="direction" tick={{ fill: C.muted, fontSize: 11 }} />
        <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
        <Tooltip content={<CT />} />
        <Bar dataKey="wins"   name="WIN"  stackId="a" fill={C.win}  />
        <Bar dataKey="losses" name="LOSS" stackId="a" fill={C.loss} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Analytics
          </h1>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Equity & Rolling ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Equity Curve — P&L Cumulativo" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}>
            <EquityCurveChart />
          </ChartCard>
          <ChartCard title="Rolling Win Rate & Profit Factor (finestra 20)" icon={<Activity className="w-4 h-4 text-amber-400" />}>
            <RollingWinRateChart />
          </ChartCard>
        </div>

        {/* ── Score / Confidence / Confluence distributions ── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5" /> Distribuzioni
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChartCard title="Distribuzione Score" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />}>
              <DistributionChart endpoint="score"      xKey="label" title="Score"      color={C.blue}   />
            </ChartCard>
            <ChartCard title="Distribuzione Confidence" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />}>
              <DistributionChart endpoint="confidence" xKey="label" title="Confidence" color={C.purple} />
            </ChartCard>
            <ChartCard title="Distribuzione Confluenza" icon={<Layers className="w-3.5 h-3.5 text-primary" />}>
              <DistributionChart endpoint="confluence" xKey="label" title="Confluenza" color={C.cyan}   />
            </ChartCard>
          </div>
        </div>

        {/* ── Regime + Tier + Direction ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChartCard title="Distribuzione Regimi" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />}>
            <DistributionChart endpoint="regime" xKey="label" title="Regime" color={C.amber} />
          </ChartCard>
          <ChartCard title="Quality Tier" icon={<BarChart2 className="w-3.5 h-3.5 text-amber-400" />}>
            <DistributionChart endpoint="tier" xKey="label" title="Tier" color={C.amber} />
          </ChartCard>
          <ChartCard title="LONG vs SHORT" icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />}>
            <DirectionChart />
          </ChartCard>
        </div>

        {/* ── Performance per asset ── */}
        <ChartCard title="Win Rate per Asset (top 15 per volume)" icon={<BarChart2 className="w-4 h-4 text-primary" />}>
          <AssetPerformanceChart />
        </ChartCard>

        {/* ── Heatmaps ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Heatmap Giorni della Settimana" icon={<Activity className="w-4 h-4 text-primary" />}>
            <div className="pt-2">
              <HeatmapChart type="dow" />
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Verde = Win Rate alto · Rosso = basso · Intensità = volume</p>
            </div>
          </ChartCard>
          <ChartCard title="Heatmap Fasce Orarie (UTC)" icon={<Activity className="w-4 h-4 text-primary" />}>
            <div className="pt-2">
              <HeatmapChart type="hour" />
              <p className="text-[10px] text-muted-foreground mt-3 text-center">Verde = Win Rate alto · Rosso = basso · Intensità = volume</p>
            </div>
          </ChartCard>
        </div>

        {/* ── Scatter plots ── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5" /> Scatter — Fattori vs Profitto
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChartCard title="Score vs Profitto %" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />}>
              <ScatterPlot xKey="score"      xLabel="Score"      />
            </ChartCard>
            <ChartCard title="Confidence vs Profitto %" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />}>
              <ScatterPlot xKey="confidence" xLabel="Confidence" />
            </ChartCard>
            <ChartCard title="Confluenza vs Profitto %" icon={<Layers className="w-3.5 h-3.5 text-primary" />}>
              <ScatterPlot xKey="confluence" xLabel="Confluenza" />
            </ChartCard>
          </div>
        </div>

      </main>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/pages/home.tsx
```tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPortfolio, useUpdatePortfolio, getGetPortfolioQueryKey } from "@workspace/api-client-react";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { AddTradeForm } from "@/components/add-trade-form";
import { TradesTable } from "@/components/trades-table";
import { PerformanceMetrics } from "@/components/performance-metrics";
import { ClosedTradesTable } from "@/components/closed-trades-table";
import { SignalStats } from "@/components/signal-stats";
import { QualityFilter } from "@/components/quality-filter";
import { SignalList } from "@/components/signal-list";
import { Terminal, Activity, Bell, CheckCircle2, Database, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function TelegramCard() {
  const { data: portfolio } = useGetPortfolio();
  const updatePortfolio = useUpdatePortfolio();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState("");

  const handleSave = () => {
    updatePortfolio.mutate({ data: { telegramChatId: chatId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        setChatId("");
      }
    });
  };

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Notifiche Telegram
            {portfolio?.telegramChatId && (
              <span className="flex items-center text-xs text-green-500 font-normal bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attive
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Inserisci il tuo Telegram Chat ID per ricevere notifiche quando il bot raggiunge TP o SL.
            I segnali qualificati (ELITE / FORTE / NORMALE) vengono inviati automaticamente.
            <br />
            <span className="opacity-75">
              Per trovare il tuo Chat ID: scrivi <code className="bg-muted px-1 py-0.5 rounded">/start</code> al tuo bot,
              poi invia un messaggio a <code className="bg-muted px-1 py-0.5 rounded">@userinfobot</code>
            </span>
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2 mt-2 md:mt-0">
          <Input
            placeholder={portfolio?.telegramChatId || "Chat ID..."}
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="w-full md:w-48 h-9 text-sm rounded-sm bg-background"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!chatId || updatePortfolio.isPending}
            className="h-9 rounded-sm"
          >
            Salva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [investAmount, setInvestAmount] = useState(100);
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
            Advisor Bot Terminal
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          </h1>

          {/* ── Nav ── */}
          <nav className="ml-auto flex items-center gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
              <Terminal className="w-3 h-3" />Terminal
            </span>
            <button
              onClick={() => navigate("/analytics")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent"
            >
              <BarChart2 className="w-3 h-3" />Analytics
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        <PerformanceMetrics />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PortfolioSummary investAmount={investAmount} setInvestAmount={setInvestAmount} />
          </div>
          <div>
            <AddTradeForm investAmount={investAmount} />
          </div>
        </div>

        <TelegramCard />

        {/* ── Signal Intelligence ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
            <Database className="w-4 h-4" />
            <h2>Intelligence Segnali — Apprendimento Automatico</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SignalStats />
            </div>
            <div>
              <QualityFilter />
            </div>
          </div>
        </div>

        {/* ── Signal History ── */}
        <SignalList />

        {/* ── Monitored Assets ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
            <Activity className="w-4 h-4" />
            <h2>Asset Attualmente Sotto Monitoraggio</h2>
          </div>
          <TradesTable />
        </div>

        <ClosedTradesTable />
      </main>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/pages/not-found.tsx
```tsx
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/src/pages/signal-detail.tsx
```tsx
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, formatPrice } from "@/lib/api";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Target, ShieldAlert, BarChart2, Layers, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Signal {
  id: number; asset: string; direction: string; status: string;
  quality_tier?: string; score: number; confidence_score: number;
  confluence: number; market_regime?: string; verdict?: string;
  false_signal_risk?: string; entry_price: number; tp: number; sl: number;
  exit_price?: number; profit_pct?: number; max_profit_pct?: number;
  max_drawdown_pct?: number; rsi: number; macd_histogram: number;
  ema50: number; ema100: number; ema200: number; atr: number;
  volume_ratio: number; estimated_probability: number;
  duration_minutes?: number;
  score_breakdown?: { trend: number; momentum: number; volatility: number; volume: number; structure: number; multiTimeframe: number } | null;
  confluence_factors?: { trend: boolean; macd: boolean; volume: boolean; structure: boolean; mtf: boolean; momentum: boolean } | null;
  reason?: string | null;
  created_at: string; closed_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_CFG: Record<string, { color: string; bg: string; border: string }> = {
  ELITE:   { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/40"   },
  FORTE:   { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40" },
  NORMALE: { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/40"    },
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-amber-400", WIN: "text-emerald-400", LOSS: "text-rose-400", EXPIRED: "text-muted-foreground",
};

function ScoreBar({ label, value, max, color = "bg-primary" }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold text-foreground">{value}<span className="text-muted-foreground">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfluenceFactor({ label, active, description }: { label: string; active: boolean; description: string }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-sm border ${active ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20"}`}>
      {active
        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        : <XCircle     className="w-4 h-4 text-muted-foreground shrink-0" />}
      <div>
        <p className={`text-xs font-semibold ${active ? "text-emerald-400" : "text-muted-foreground"}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignalDetail() {
  const [, params] = useRoute("/signals/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id ?? "0", 10);

  const { data: sig, isLoading, error } = useQuery<Signal>({
    queryKey: ["signal", id],
    queryFn: () => apiFetch(`/api/signals/${id}`),
    enabled: id > 0,
    staleTime: 30_000,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-sm text-muted-foreground animate-pulse">Caricamento segnale...</p>
    </div>
  );

  if (error || !sig) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="text-sm text-rose-400">Segnale non trovato</p>
      <button onClick={() => navigate("/")} className="text-xs text-primary hover:underline">← Torna alla Dashboard</button>
    </div>
  );

  const direction = sig.direction;
  const isLong = direction === "LONG";
  const tier = sig.quality_tier;
  const tierCfg = tier ? TIER_CFG[tier] : null;
  const sb = sig.score_breakdown;
  const cf = sig.confluence_factors;

  const rr = sig.entry_price > 0
    ? ((isLong ? sig.tp - sig.entry_price : sig.entry_price - sig.tp) /
       (isLong ? sig.entry_price - sig.sl : sig.sl - sig.entry_price)).toFixed(2)
    : "N/D";

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">{sig.asset}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
              isLong ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                     : "text-rose-400 border-rose-500/30 bg-rose-500/10"
            }`}>{direction}</span>
            {tier && tierCfg && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>{tier}</span>
            )}
            <span className={`text-xs font-medium ${STATUS_COLOR[sig.status] ?? "text-foreground"}`}>{sig.status}</span>
          </div>
          <div className="ml-auto text-[11px] text-muted-foreground font-mono">
            #{sig.id} · {new Date(sig.created_at).toLocaleString("it-IT")}
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Score + P&L strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Score",        value: `${sig.score}/100`,              color: sig.score >= 85 ? "text-amber-400" : sig.score >= 75 ? "text-emerald-400" : "text-foreground" },
            { label: "Confidence",   value: `${sig.confidence_score}%`,      color: "text-foreground" },
            { label: "Prob. stimata",value: `${sig.estimated_probability}%`, color: "text-foreground" },
            { label: "R:R",          value: `1:${rr}`,                       color: "text-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-sm p-3 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Result strip (if closed) ── */}
        {sig.status !== "PENDING" && sig.profit_pct != null && (
          <div className={`flex items-center gap-4 px-4 py-3 rounded-sm border ${
            sig.status === "WIN" ? "border-emerald-500/30 bg-emerald-500/8" : "border-rose-500/30 bg-rose-500/8"
          }`}>
            {sig.status === "WIN"
              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
              : <TrendingDown className="w-5 h-5 text-rose-400" />}
            <div>
              <p className={`font-mono text-lg font-bold ${sig.status === "WIN" ? "text-emerald-400" : "text-rose-400"}`}>
                {sig.profit_pct >= 0 ? "+" : ""}{sig.profit_pct.toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                Uscita a {formatPrice(sig.exit_price)} · Durata {sig.duration_minutes ?? "—"} min
                {sig.max_profit_pct != null && ` · Max +${sig.max_profit_pct.toFixed(2)}%`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Entry / TP / SL ── */}
          <Card className="bg-card border-border rounded-sm shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Livelli di Prezzo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Entrata",     value: sig.entry_price,   color: "text-foreground"  },
                { label: "Take Profit", value: sig.tp,            color: "text-emerald-400" },
                { label: "Stop Loss",   value: sig.sl,            color: "text-rose-400"    },
                { label: "EMA 50",      value: sig.ema50,         color: "text-blue-400"    },
                { label: "EMA 200",     value: sig.ema200,        color: "text-purple-400"  },
              ].map(p => (
                <div key={p.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                  <span className={`font-mono text-sm font-bold ${p.color}`}>{formatPrice(p.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Technical indicators ── */}
          <Card className="bg-card border-border rounded-sm shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Indicatori Tecnici
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "RSI (14)",       value: `${sig.rsi.toFixed(1)}`, sub: sig.rsi > 70 ? "Ipercomprato" : sig.rsi < 30 ? "Ipervenduto" : sig.rsi > 55 ? "Momentum rialzista" : sig.rsi < 45 ? "Momentum ribassista" : "Neutrale" },
                { label: "MACD Histogram", value: sig.macd_histogram.toFixed(4), sub: sig.macd_histogram > 0 ? "Positivo" : "Negativo" },
                { label: "Volume Ratio",   value: `${sig.volume_ratio.toFixed(2)}x`, sub: sig.volume_ratio > 1.2 ? "Volumi elevati" : sig.volume_ratio < 0.8 ? "Volumi bassi" : "Nella norma" },
                { label: "ATR (14)",       value: formatPrice(sig.atr), sub: "Volatilità media" },
                { label: "Regime",         value: sig.market_regime ?? "—", sub: "" },
                { label: "Rischio falso",  value: sig.false_signal_risk ?? "—", sub: "" },
              ].map(p => (
                <div key={p.label} className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-foreground">{p.value}</p>
                    {p.sub && <p className="text-[9px] text-muted-foreground">{p.sub}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Score Breakdown ── */}
        {sb && (
          <Card className="bg-card border-border rounded-sm shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Score Breakdown — {sig.score}/100
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoreBar label="Trend (EMA stack)"       value={sb.trend}          max={30} color="bg-blue-500"    />
              <ScoreBar label="Momentum (RSI + MACD)"   value={sb.momentum}       max={20} color="bg-purple-500"  />
              <ScoreBar label="Struttura del prezzo"     value={sb.structure}      max={15} color="bg-amber-500"   />
              <ScoreBar label="Volume"                   value={sb.volume}         max={15} color="bg-emerald-500" />
              <ScoreBar label="Multi-Timeframe"          value={sb.multiTimeframe} max={10} color="bg-cyan-500"    />
              <ScoreBar label="Volatilità (ATR)"         value={sb.volatility}     max={10} color="bg-rose-500"    />
            </CardContent>
          </Card>
        )}

        {/* ── Confluence Factors ── */}
        <Card className="bg-card border-border rounded-sm shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Confluenza {sig.confluence}/6
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ConfluenceFactor
              label="Trend EMA200"
              active={cf?.trend ?? (sig.entry_price > sig.ema200) === isLong}
              description={isLong ? "Prezzo sopra EMA200 — trend principale rialzista" : "Prezzo sotto EMA200 — trend principale ribassista"}
            />
            <ConfluenceFactor
              label="MACD"
              active={cf?.macd ?? (sig.macd_histogram > 0) === isLong}
              description={isLong ? "MACD histogram positivo — momentum rialzista" : "MACD histogram negativo — momentum ribassista"}
            />
            <ConfluenceFactor
              label="Volume"
              active={cf?.volume ?? sig.volume_ratio > 1.1}
              description={`Volume ratio ${sig.volume_ratio.toFixed(2)}x — ${sig.volume_ratio > 1.2 ? "conferma forte" : sig.volume_ratio > 1.0 ? "conferma moderata" : "volumi insufficienti"}`}
            />
            <ConfluenceFactor
              label="Struttura del Prezzo"
              active={cf?.structure ?? false}
              description="Higher Highs + Higher Lows (LONG) o Lower Highs + Lower Lows (SHORT)"
            />
            <ConfluenceFactor
              label="Multi-Timeframe (MTF)"
              active={cf?.mtf ?? false}
              description="Almeno 3 dei 4 timeframe (15M/1H/4H/Daily) allineati con la direzione"
            />
            <ConfluenceFactor
              label="Momentum (RSI zona)"
              active={cf?.momentum ?? (isLong ? (sig.rsi > 50 && sig.rsi < 70) : (sig.rsi < 50 && sig.rsi > 30))}
              description={isLong ? "RSI tra 50 e 70 — zona momentum rialzista ottimale" : "RSI tra 30 e 50 — zona momentum ribassista ottimale"}
            />
          </CardContent>
        </Card>

        {/* ── Full analysis report ── */}
        {sig.reason && (
          <Card className="bg-card border-border rounded-sm shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                Analisi Completa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed bg-background/50 p-4 rounded-sm border border-border overflow-x-auto">
                {sig.reason}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* ── Invalidation note (if no reason) ── */}
        {!sig.reason && (
          <div className="flex items-start gap-3 px-4 py-3 border border-amber-500/20 bg-amber-500/5 rounded-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              L'analisi dettagliata è disponibile per i segnali generati dopo questo aggiornamento.
              I segnali precedenti non hanno il report completo memorizzato nel database.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
```

## PERCORSO: artifacts/trading-dashboard/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "dist", "**/*.test.ts"],
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["esnext", "dom", "dom.iterable"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "references": [
    {
      "path": "../../lib/api-client-react"
    }
  ]
}
```

## PERCORSO: artifacts/trading-dashboard/vite.config.ts
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
```

## PERCORSO: lib/api-client-react/package.json
```json
{
  "name": "@workspace/api-client-react",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@tanstack/react-query": "catalog:"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}
```

## PERCORSO: lib/api-client-react/src/custom-fetch.ts
```ts
export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input) };

  const response = await fetch(input, { ...init, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}
```

## PERCORSO: lib/api-client-react/src/generated/api.schemas.ts
```ts
/**
 * Generated by orval v8.9.1 🍺
 * Do not edit manually.
 * Api
 * API specification
 * OpenAPI spec version: 0.1.0
 */
export interface HealthStatus {
  status: string;
}

export type TradeDirection = typeof TradeDirection[keyof typeof TradeDirection];


export const TradeDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

export type TradeStatus = typeof TradeStatus[keyof typeof TradeStatus];


export const TradeStatus = {
  active: 'active',
  paused: 'paused',
} as const;

export interface Trade {
  ticker: string;
  entry: number;
  tp: number;
  sl: number;
  atr: number;
  direction: TradeDirection;
  reason: string;
  investAmount: number;
  addedAt: string;
  status?: TradeStatus;
}

export type ClosedTradeDirection = typeof ClosedTradeDirection[keyof typeof ClosedTradeDirection];


export const ClosedTradeDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

export type ClosedTradeCloseReason = typeof ClosedTradeCloseReason[keyof typeof ClosedTradeCloseReason];


export const ClosedTradeCloseReason = {
  TP_HIT: 'TP_HIT',
  SL_HIT: 'SL_HIT',
  MANUAL: 'MANUAL',
} as const;

export interface ClosedTrade {
  ticker: string;
  entry: number;
  tp: number;
  sl: number;
  atr: number;
  direction: ClosedTradeDirection;
  reason: string;
  investAmount: number;
  addedAt: string;
  closedAt: string;
  closeReason: ClosedTradeCloseReason;
  exitPrice: number;
  pnl: number;
}

export interface TradeInput {
  ticker: string;
  investAmount?: number;
}

export interface SymbolSearchMatch {
  symbol: string;
  instrumentName: string;
  /** @nullable */
  exchange?: string | null;
  /** @nullable */
  country?: string | null;
  /** @nullable */
  instrumentType?: string | null;
  /** @nullable */
  currency?: string | null;
}

export interface SymbolSearchResult {
  query: string;
  matches: SymbolSearchMatch[];
  providerLimited: boolean;
  /** @nullable */
  note?: string | null;
}

export interface TradeResult {
  success: boolean;
  message: string;
  signal?: string;
  /** @nullable */
  direction?: string | null;
  /** @nullable */
  score?: number | null;
  /** @nullable */
  verdict?: string | null;
  /** @nullable */
  confidenceScore?: number | null;
  /** @nullable */
  estimatedProbability?: number | null;
  /** @nullable */
  reason?: string | null;
  trade?: Trade;
}

export interface DeleteResult {
  success: boolean;
  message: string;
}

export interface Portfolio {
  balance: number;
  /** @nullable */
  telegramChatId?: string | null;
  trades: Trade[];
  closedTrades: ClosedTrade[];
}

export interface UpdatePortfolioBody {
  balance?: number;
  telegramChatId?: string;
}

export interface PortfolioSummary {
  totalTrades: number;
  buySignals: number;
  avgScore: number;
  /** @nullable */
  highestScoringTicker?: string | null;
}

export interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export type LiveTradeDirection = typeof LiveTradeDirection[keyof typeof LiveTradeDirection];


export const LiveTradeDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

export interface LiveTrade {
  ticker: string;
  direction: LiveTradeDirection;
  entry: number;
  tp: number;
  sl: number;
  atr: number;
  reason: string;
  investAmount: number;
  addedAt: string;
  /** @nullable */
  currentPrice: number | null;
  /** @nullable */
  unrealizedPnl: number | null;
  /** @nullable */
  priceChangePercent: number | null;
}

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  structure: number;
  multiTimeframe: number;
}

export interface MtfAnalysis {
  m15: string;
  h1: string;
  h4: string;
  daily: string;
}

export type AnalysisResultDirection = typeof AnalysisResultDirection[keyof typeof AnalysisResultDirection];


export const AnalysisResultDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  WAIT: 'WAIT',
} as const;

export type AnalysisResultVerdict = typeof AnalysisResultVerdict[keyof typeof AnalysisResultVerdict];


export const AnalysisResultVerdict = {
  FORTE_BUY: 'FORTE_BUY',
  BUY: 'BUY',
  NEUTRALE: 'NEUTRALE',
  SELL: 'SELL',
  FORTE_SELL: 'FORTE_SELL',
} as const;

export type AnalysisResultFalseSignalRisk = typeof AnalysisResultFalseSignalRisk[keyof typeof AnalysisResultFalseSignalRisk];


export const AnalysisResultFalseSignalRisk = {
  Basso: 'Basso',
  Medio: 'Medio',
  Alto: 'Alto',
} as const;

export interface AnalysisResult {
  ticker: string;
  price: number;
  score: number;
  signal: string;
  direction: AnalysisResultDirection;
  verdict: AnalysisResultVerdict;
  reason: string;
  tp: number;
  sl: number;
  atr: number;
  ema50: number;
  ema100: number;
  ema200: number;
  rsi: number;
  macdHistogram: number;
  volumeRatio: number;
  falseSignalRisk: AnalysisResultFalseSignalRisk;
  confidenceScore: number;
  estimatedProbability: number;
  scoreBreakdown: ScoreBreakdown;
  mtfAnalysis: MtfAnalysis;
  invalidationConditions: string[];
}

export interface ApiError {
  error: string;
}

export type UpdateTradeStatusBodyStatus = typeof UpdateTradeStatusBodyStatus[keyof typeof UpdateTradeStatusBodyStatus];


export const UpdateTradeStatusBodyStatus = {
  active: 'active',
  paused: 'paused',
} as const;

export type UpdateTradeStatusBody = {
  status: UpdateTradeStatusBodyStatus;
};

export type SearchSymbolsParams = {
q: string;
};
```

## PERCORSO: lib/api-client-react/src/generated/api.ts
```ts
/**
 * Generated by orval v8.9.1 🍺
 * Do not edit manually.
 * Api
 * API specification
 * OpenAPI spec version: 0.1.0
 */
import {
  useMutation,
  useQuery
} from '@tanstack/react-query';
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult
} from '@tanstack/react-query';

import type {
  AnalysisResult,
  ApiError,
  ClosedTrade,
  DeleteResult,
  HealthStatus,
  LiveTrade,
  PerformanceMetrics,
  Portfolio,
  PortfolioSummary,
  SearchSymbolsParams,
  SymbolSearchResult,
  Trade,
  TradeInput,
  TradeResult,
  UpdatePortfolioBody,
  UpdateTradeStatusBody
} from './api.schemas';

import { customFetch } from '../custom-fetch';
import type { ErrorType , BodyType } from '../custom-fetch';

type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;


type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];



export const getHealthCheckUrl = () => {




  return `/api/healthz`
}

/**
 * @summary Health check
 */
export const healthCheck = async ( options?: RequestInit): Promise<HealthStatus> => {

  return customFetch<HealthStatus>(getHealthCheckUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getHealthCheckQueryKey = () => {
    return [
    `/api/healthz`
    ] as const;
    }


export const getHealthCheckQueryOptions = <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getHealthCheckQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof healthCheck>>> = ({ signal }) => healthCheck({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & { queryKey: QueryKey }
}

export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>
export type HealthCheckQueryError = ErrorType<unknown>


/**
 * @summary Health check
 */

export function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getHealthCheckQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getGetPortfolioUrl = () => {




  return `/api/portfolio`
}

/**
 * @summary Get portfolio
 */
export const getPortfolio = async ( options?: RequestInit): Promise<Portfolio> => {

  return customFetch<Portfolio>(getGetPortfolioUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPortfolioQueryKey = () => {
    return [
    `/api/portfolio`
    ] as const;
    }


export const getGetPortfolioQueryOptions = <TData = Awaited<ReturnType<typeof getPortfolio>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolio>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPortfolioQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPortfolio>>> = ({ signal }) => getPortfolio({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPortfolio>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPortfolioQueryResult = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>
export type GetPortfolioQueryError = ErrorType<unknown>


/**
 * @summary Get portfolio
 */

export function useGetPortfolio<TData = Awaited<ReturnType<typeof getPortfolio>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolio>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPortfolioQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getUpdatePortfolioUrl = () => {




  return `/api/portfolio`
}

/**
 * @summary Update portfolio settings
 */
export const updatePortfolio = async (updatePortfolioBody: UpdatePortfolioBody, options?: RequestInit): Promise<Portfolio> => {

  return customFetch<Portfolio>(getUpdatePortfolioUrl(),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(
      updatePortfolioBody,)
  }
);}




export const getUpdatePortfolioMutationOptions = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updatePortfolio>>, TError,{data: BodyType<UpdatePortfolioBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updatePortfolio>>, TError,{data: BodyType<UpdatePortfolioBody>}, TContext> => {

const mutationKey = ['updatePortfolio'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updatePortfolio>>, {data: BodyType<UpdatePortfolioBody>}> = (props) => {
          const {data} = props ?? {};

          return  updatePortfolio(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdatePortfolioMutationResult = NonNullable<Awaited<ReturnType<typeof updatePortfolio>>>
    export type UpdatePortfolioMutationBody = BodyType<UpdatePortfolioBody>
    export type UpdatePortfolioMutationError = ErrorType<ApiError>

    /**
 * @summary Update portfolio settings
 */
export const useUpdatePortfolio = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updatePortfolio>>, TError,{data: BodyType<UpdatePortfolioBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updatePortfolio>>,
        TError,
        {data: BodyType<UpdatePortfolioBody>},
        TContext
      > => {
      return useMutation(getUpdatePortfolioMutationOptions(options));
    }

export const getGetPortfolioSummaryUrl = () => {




  return `/api/portfolio/summary`
}

/**
 * @summary Get portfolio summary stats
 */
export const getPortfolioSummary = async ( options?: RequestInit): Promise<PortfolioSummary> => {

  return customFetch<PortfolioSummary>(getGetPortfolioSummaryUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPortfolioSummaryQueryKey = () => {
    return [
    `/api/portfolio/summary`
    ] as const;
    }


export const getGetPortfolioSummaryQueryOptions = <TData = Awaited<ReturnType<typeof getPortfolioSummary>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPortfolioSummaryQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPortfolioSummary>>> = ({ signal }) => getPortfolioSummary({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPortfolioSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getPortfolioSummary>>>
export type GetPortfolioSummaryQueryError = ErrorType<unknown>


/**
 * @summary Get portfolio summary stats
 */

export function useGetPortfolioSummary<TData = Awaited<ReturnType<typeof getPortfolioSummary>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPortfolioSummaryQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getGetPortfolioMetricsUrl = () => {




  return `/api/portfolio/metrics`
}

/**
 * Win Rate, Profit Factor, Total PnL computed from closed trades
 * @summary Get performance metrics
 */
export const getPortfolioMetrics = async ( options?: RequestInit): Promise<PerformanceMetrics> => {

  return customFetch<PerformanceMetrics>(getGetPortfolioMetricsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPortfolioMetricsQueryKey = () => {
    return [
    `/api/portfolio/metrics`
    ] as const;
    }


export const getGetPortfolioMetricsQueryOptions = <TData = Awaited<ReturnType<typeof getPortfolioMetrics>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolioMetrics>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPortfolioMetricsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPortfolioMetrics>>> = ({ signal }) => getPortfolioMetrics({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPortfolioMetrics>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPortfolioMetricsQueryResult = NonNullable<Awaited<ReturnType<typeof getPortfolioMetrics>>>
export type GetPortfolioMetricsQueryError = ErrorType<unknown>


/**
 * @summary Get performance metrics
 */

export function useGetPortfolioMetrics<TData = Awaited<ReturnType<typeof getPortfolioMetrics>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPortfolioMetrics>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPortfolioMetricsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getGetTradesUrl = () => {




  return `/api/trades`
}

/**
 * @summary List open trades
 */
export const getTrades = async ( options?: RequestInit): Promise<Trade[]> => {

  return customFetch<Trade[]>(getGetTradesUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetTradesQueryKey = () => {
    return [
    `/api/trades`
    ] as const;
    }


export const getGetTradesQueryOptions = <TData = Awaited<ReturnType<typeof getTrades>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTrades>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetTradesQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getTrades>>> = ({ signal }) => getTrades({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getTrades>>, TError, TData> & { queryKey: QueryKey }
}

export type GetTradesQueryResult = NonNullable<Awaited<ReturnType<typeof getTrades>>>
export type GetTradesQueryError = ErrorType<unknown>


/**
 * @summary List open trades
 */

export function useGetTrades<TData = Awaited<ReturnType<typeof getTrades>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTrades>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetTradesQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getAddTradeUrl = () => {




  return `/api/trades`
}

/**
 * @summary Analyze and add a trade
 */
export const addTrade = async (tradeInput: TradeInput, options?: RequestInit): Promise<TradeResult> => {

  return customFetch<TradeResult>(getAddTradeUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(
      tradeInput,)
  }
);}




export const getAddTradeMutationOptions = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof addTrade>>, TError,{data: BodyType<TradeInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof addTrade>>, TError,{data: BodyType<TradeInput>}, TContext> => {

const mutationKey = ['addTrade'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof addTrade>>, {data: BodyType<TradeInput>}> = (props) => {
          const {data} = props ?? {};

          return  addTrade(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type AddTradeMutationResult = NonNullable<Awaited<ReturnType<typeof addTrade>>>
    export type AddTradeMutationBody = BodyType<TradeInput>
    export type AddTradeMutationError = ErrorType<ApiError>

    /**
 * @summary Analyze and add a trade
 */
export const useAddTrade = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof addTrade>>, TError,{data: BodyType<TradeInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof addTrade>>,
        TError,
        {data: BodyType<TradeInput>},
        TContext
      > => {
      return useMutation(getAddTradeMutationOptions(options));
    }

export const getGetClosedTradesUrl = () => {




  return `/api/trades/closed`
}

/**
 * @summary List closed trades history
 */
export const getClosedTrades = async ( options?: RequestInit): Promise<ClosedTrade[]> => {

  return customFetch<ClosedTrade[]>(getGetClosedTradesUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetClosedTradesQueryKey = () => {
    return [
    `/api/trades/closed`
    ] as const;
    }


export const getGetClosedTradesQueryOptions = <TData = Awaited<ReturnType<typeof getClosedTrades>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getClosedTrades>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetClosedTradesQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getClosedTrades>>> = ({ signal }) => getClosedTrades({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getClosedTrades>>, TError, TData> & { queryKey: QueryKey }
}

export type GetClosedTradesQueryResult = NonNullable<Awaited<ReturnType<typeof getClosedTrades>>>
export type GetClosedTradesQueryError = ErrorType<unknown>


/**
 * @summary List closed trades history
 */

export function useGetClosedTrades<TData = Awaited<ReturnType<typeof getClosedTrades>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getClosedTrades>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetClosedTradesQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getGetTradesLiveUrl = () => {




  return `/api/trades/live`
}

/**
 * @summary Get open trades with live price and unrealized PnL
 */
export const getTradesLive = async ( options?: RequestInit): Promise<LiveTrade[]> => {

  return customFetch<LiveTrade[]>(getGetTradesLiveUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetTradesLiveQueryKey = () => {
    return [
    `/api/trades/live`
    ] as const;
    }


export const getGetTradesLiveQueryOptions = <TData = Awaited<ReturnType<typeof getTradesLive>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTradesLive>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetTradesLiveQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getTradesLive>>> = ({ signal }) => getTradesLive({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getTradesLive>>, TError, TData> & { queryKey: QueryKey }
}

export type GetTradesLiveQueryResult = NonNullable<Awaited<ReturnType<typeof getTradesLive>>>
export type GetTradesLiveQueryError = ErrorType<unknown>


/**
 * @summary Get open trades with live price and unrealized PnL
 */

export function useGetTradesLive<TData = Awaited<ReturnType<typeof getTradesLive>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTradesLive>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetTradesLiveQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getDeleteTradeUrl = (ticker: string,) => {




  return `/api/trades/${ticker}`
}

/**
 * @summary Remove trade from tracking
 */
export const deleteTrade = async (ticker: string, options?: RequestInit): Promise<DeleteResult> => {

  return customFetch<DeleteResult>(getDeleteTradeUrl(ticker),
  {
    ...options,
    method: 'DELETE'


  }
);}




export const getDeleteTradeMutationOptions = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTrade>>, TError,{ticker: string}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteTrade>>, TError,{ticker: string}, TContext> => {

const mutationKey = ['deleteTrade'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteTrade>>, {ticker: string}> = (props) => {
          const {ticker} = props ?? {};

          return  deleteTrade(ticker,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeleteTradeMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTrade>>>

    export type DeleteTradeMutationError = ErrorType<ApiError>

    /**
 * @summary Remove trade from tracking
 */
export const useDeleteTrade = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTrade>>, TError,{ticker: string}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof deleteTrade>>,
        TError,
        {ticker: string},
        TContext
      > => {
      return useMutation(getDeleteTradeMutationOptions(options));
    }

export const getUpdateTradeStatusUrl = (ticker: string,) => {




  return `/api/trades/${ticker}/status`
}

/**
 * @summary Pause or resume monitoring for a tracked asset
 */
export const updateTradeStatus = async (ticker: string,
    updateTradeStatusBody: UpdateTradeStatusBody, options?: RequestInit): Promise<Trade> => {

  return customFetch<Trade>(getUpdateTradeStatusUrl(ticker),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(
      updateTradeStatusBody,)
  }
);}




export const getUpdateTradeStatusMutationOptions = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTradeStatus>>, TError,{ticker: string;data: BodyType<UpdateTradeStatusBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateTradeStatus>>, TError,{ticker: string;data: BodyType<UpdateTradeStatusBody>}, TContext> => {

const mutationKey = ['updateTradeStatus'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateTradeStatus>>, {ticker: string;data: BodyType<UpdateTradeStatusBody>}> = (props) => {
          const {ticker,data} = props ?? {};

          return  updateTradeStatus(ticker,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateTradeStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateTradeStatus>>>
    export type UpdateTradeStatusMutationBody = BodyType<UpdateTradeStatusBody>
    export type UpdateTradeStatusMutationError = ErrorType<ApiError>

    /**
 * @summary Pause or resume monitoring for a tracked asset
 */
export const useUpdateTradeStatus = <TError = ErrorType<ApiError>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTradeStatus>>, TError,{ticker: string;data: BodyType<UpdateTradeStatusBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateTradeStatus>>,
        TError,
        {ticker: string;data: BodyType<UpdateTradeStatusBody>},
        TContext
      > => {
      return useMutation(getUpdateTradeStatusMutationOptions(options));
    }

export const getSearchSymbolsUrl = (params: SearchSymbolsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : value.toString())
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/symbols/search?${stringifiedParams}` : `/api/symbols/search`
}

/**
 * @summary Search for a ticker by company name, ticker, ISIN, crypto or ETF name
 */
export const searchSymbols = async (params: SearchSymbolsParams, options?: RequestInit): Promise<SymbolSearchResult> => {

  return customFetch<SymbolSearchResult>(getSearchSymbolsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getSearchSymbolsQueryKey = (params?: SearchSymbolsParams,) => {
    return [
    `/api/symbols/search`, ...(params ? [params] : [])
    ] as const;
    }


export const getSearchSymbolsQueryOptions = <TData = Awaited<ReturnType<typeof searchSymbols>>, TError = ErrorType<ApiError>>(params: SearchSymbolsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchSymbols>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getSearchSymbolsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof searchSymbols>>> = ({ signal }) => searchSymbols(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof searchSymbols>>, TError, TData> & { queryKey: QueryKey }
}

export type SearchSymbolsQueryResult = NonNullable<Awaited<ReturnType<typeof searchSymbols>>>
export type SearchSymbolsQueryError = ErrorType<ApiError>


/**
 * @summary Search for a ticker by company name, ticker, ISIN, crypto or ETF name
 */

export function useSearchSymbols<TData = Awaited<ReturnType<typeof searchSymbols>>, TError = ErrorType<ApiError>>(
 params: SearchSymbolsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchSymbols>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getSearchSymbolsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}







export const getAnalyzeTickerUrl = (ticker: string,) => {




  return `/api/analysis/${ticker}`
}

/**
 * @summary Analyze a ticker
 */
export const analyzeTicker = async (ticker: string, options?: RequestInit): Promise<AnalysisResult> => {

  return customFetch<AnalysisResult>(getAnalyzeTickerUrl(ticker),
  {
    ...options,
    method: 'GET'


  }
);}





export const getAnalyzeTickerQueryKey = (ticker: string,) => {
    return [
    `/api/analysis/${ticker}`
    ] as const;
    }


export const getAnalyzeTickerQueryOptions = <TData = Awaited<ReturnType<typeof analyzeTicker>>, TError = ErrorType<ApiError>>(ticker: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof analyzeTicker>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getAnalyzeTickerQueryKey(ticker);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof analyzeTicker>>> = ({ signal }) => analyzeTicker(ticker, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: !!(ticker), ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof analyzeTicker>>, TError, TData> & { queryKey: QueryKey }
}

export type AnalyzeTickerQueryResult = NonNullable<Awaited<ReturnType<typeof analyzeTicker>>>
export type AnalyzeTickerQueryError = ErrorType<ApiError>


/**
 * @summary Analyze a ticker
 */

export function useAnalyzeTicker<TData = Awaited<ReturnType<typeof analyzeTicker>>, TError = ErrorType<ApiError>>(
 ticker: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof analyzeTicker>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getAnalyzeTickerQueryOptions(ticker,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return { ...query, queryKey: queryOptions.queryKey };
}
```

## PERCORSO: lib/api-client-react/src/index.ts
```ts
export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
```

## PERCORSO: lib/api-client-react/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["dom", "es2022"]
  },
  "include": ["src"]
}
```

## PERCORSO: lib/api-spec/openapi.yaml
```yaml
openapi: 3.1.0
info:
  # Do not change the title, if the title changes, the import paths will be broken
  title: Api
  version: 0.1.0
  description: API specification
servers:
  - url: /api
    description: Base API path
tags:
  - name: health
  - name: portfolio
  - name: trades
  - name: analysis
paths:
  /healthz:
    get:
      operationId: healthCheck
      tags: [health]
      summary: Health check
      responses:
        "200":
          description: Healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthStatus"

  /portfolio:
    get:
      operationId: getPortfolio
      tags: [portfolio]
      summary: Get portfolio
      responses:
        "200":
          description: Portfolio data
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Portfolio"
    patch:
      operationId: updatePortfolio
      tags: [portfolio]
      summary: Update portfolio settings
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UpdatePortfolioBody"
      responses:
        "200":
          description: Updated portfolio
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Portfolio"
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

  /portfolio/summary:
    get:
      operationId: getPortfolioSummary
      tags: [portfolio]
      summary: Get portfolio summary stats
      responses:
        "200":
          description: Portfolio summary
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PortfolioSummary"

  /portfolio/metrics:
    get:
      operationId: getPortfolioMetrics
      tags: [portfolio]
      summary: Get performance metrics
      description: Win Rate, Profit Factor, Total PnL computed from closed trades
      responses:
        "200":
          description: Performance metrics
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PerformanceMetrics"

  /trades:
    get:
      operationId: getTrades
      tags: [trades]
      summary: List open trades
      responses:
        "200":
          description: List of open trades
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Trade"
    post:
      operationId: addTrade
      tags: [trades]
      summary: Analyze and add a trade
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/TradeInput"
      responses:
        "200":
          description: Trade analysis result
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TradeResult"
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

  /trades/closed:
    get:
      operationId: getClosedTrades
      tags: [trades]
      summary: List closed trades history
      responses:
        "200":
          description: List of closed trades
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/ClosedTrade"

  /trades/live:
    get:
      operationId: getTradesLive
      tags: [trades]
      summary: Get open trades with live price and unrealized PnL
      responses:
        "200":
          description: List of live trade snapshots
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/LiveTrade"

  /trades/{ticker}:
    delete:
      operationId: deleteTrade
      tags: [trades]
      summary: Remove trade from tracking
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Trade removed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DeleteResult"
        "404":
          description: Trade not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

  /trades/{ticker}/status:
    patch:
      operationId: updateTradeStatus
      tags: [trades]
      summary: Pause or resume monitoring for a tracked asset
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  enum: [active, paused]
              required: [status]
      responses:
        "200":
          description: Trade status updated
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Trade"
        "404":
          description: Trade not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

  /symbols/search:
    get:
      operationId: searchSymbols
      tags: [analysis]
      summary: Search for a ticker by company name, ticker, ISIN, crypto or ETF name
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Matching symbols
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SymbolSearchResult"
        "400":
          description: Bad request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

  /analysis/{ticker}:
    get:
      operationId: analyzeTicker
      tags: [analysis]
      summary: Analyze a ticker
      parameters:
        - name: ticker
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Analysis result
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AnalysisResult"
        "400":
          description: Bad request or data fetch error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApiError"

components:
  schemas:
    HealthStatus:
      type: object
      properties:
        status:
          type: string
      required: [status]

    Trade:
      type: object
      properties:
        ticker:
          type: string
        entry:
          type: number
        tp:
          type: number
        sl:
          type: number
        atr:
          type: number
        direction:
          type: string
          enum: [LONG, SHORT]
        reason:
          type: string
        investAmount:
          type: number
        addedAt:
          type: string
        status:
          type: string
          enum: [active, paused]
      required: [ticker, entry, tp, sl, atr, direction, reason, investAmount, addedAt]

    ClosedTrade:
      type: object
      properties:
        ticker:
          type: string
        entry:
          type: number
        tp:
          type: number
        sl:
          type: number
        atr:
          type: number
        direction:
          type: string
          enum: [LONG, SHORT]
        reason:
          type: string
        investAmount:
          type: number
        addedAt:
          type: string
        closedAt:
          type: string
        closeReason:
          type: string
          enum: [TP_HIT, SL_HIT, MANUAL]
        exitPrice:
          type: number
        pnl:
          type: number
      required: [ticker, entry, tp, sl, atr, direction, reason, investAmount, addedAt, closedAt, closeReason, exitPrice, pnl]

    TradeInput:
      type: object
      properties:
        ticker:
          type: string
        investAmount:
          type: number
      required: [ticker]

    SymbolSearchMatch:
      type: object
      properties:
        symbol:
          type: string
        instrumentName:
          type: string
        exchange:
          type: ["string", "null"]
        country:
          type: ["string", "null"]
        instrumentType:
          type: ["string", "null"]
        currency:
          type: ["string", "null"]
      required: [symbol, instrumentName]

    SymbolSearchResult:
      type: object
      properties:
        query:
          type: string
        matches:
          type: array
          items:
            $ref: "#/components/schemas/SymbolSearchMatch"
        providerLimited:
          type: boolean
        note:
          type: ["string", "null"]
      required: [query, matches, providerLimited]

    TradeResult:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
        signal:
          type: string
        direction:
          type: ["string", "null"]
        score:
          type: ["number", "null"]
        verdict:
          type: ["string", "null"]
        confidenceScore:
          type: ["number", "null"]
        estimatedProbability:
          type: ["number", "null"]
        reason:
          type: ["string", "null"]
        trade:
          $ref: "#/components/schemas/Trade"
      required: [success, message]

    DeleteResult:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
      required: [success, message]

    Portfolio:
      type: object
      properties:
        balance:
          type: number
        telegramChatId:
          type: ["string", "null"]
        trades:
          type: array
          items:
            $ref: "#/components/schemas/Trade"
        closedTrades:
          type: array
          items:
            $ref: "#/components/schemas/ClosedTrade"
      required: [balance, trades, closedTrades]

    UpdatePortfolioBody:
      type: object
      properties:
        balance:
          type: number
        telegramChatId:
          type: string

    PortfolioSummary:
      type: object
      properties:
        totalTrades:
          type: number
        buySignals:
          type: number
        avgScore:
          type: number
        highestScoringTicker:
          type: ["string", "null"]
      required: [totalTrades, buySignals, avgScore]

    PerformanceMetrics:
      type: object
      properties:
        totalPnl:
          type: number
        winRate:
          type: number
        profitFactor:
          type: number
        totalClosedTrades:
          type: number
        winningTrades:
          type: number
        losingTrades:
          type: number
      required: [totalPnl, winRate, profitFactor, totalClosedTrades, winningTrades, losingTrades]

    LiveTrade:
      type: object
      properties:
        ticker:
          type: string
        direction:
          type: string
          enum: [LONG, SHORT]
        entry:
          type: number
        tp:
          type: number
        sl:
          type: number
        atr:
          type: number
        reason:
          type: string
        investAmount:
          type: number
        addedAt:
          type: string
        currentPrice:
          type: ["number", "null"]
        unrealizedPnl:
          type: ["number", "null"]
        priceChangePercent:
          type: ["number", "null"]
      required: [ticker, direction, entry, tp, sl, atr, reason, investAmount, addedAt, currentPrice, unrealizedPnl, priceChangePercent]

    ScoreBreakdown:
      type: object
      properties:
        trend:
          type: number
        momentum:
          type: number
        volatility:
          type: number
        volume:
          type: number
        structure:
          type: number
        multiTimeframe:
          type: number
      required: [trend, momentum, volatility, volume, structure, multiTimeframe]

    MtfAnalysis:
      type: object
      properties:
        m15:
          type: string
        h1:
          type: string
        h4:
          type: string
        daily:
          type: string
      required: [m15, h1, h4, daily]

    AnalysisResult:
      type: object
      properties:
        ticker:
          type: string
        price:
          type: number
        score:
          type: number
        signal:
          type: string
        direction:
          type: string
          enum: [LONG, SHORT, WAIT]
        verdict:
          type: string
          enum: [FORTE_BUY, BUY, NEUTRALE, SELL, FORTE_SELL]
        reason:
          type: string
        tp:
          type: number
        sl:
          type: number
        atr:
          type: number
        ema50:
          type: number
        ema100:
          type: number
        ema200:
          type: number
        rsi:
          type: number
        macdHistogram:
          type: number
        volumeRatio:
          type: number
        falseSignalRisk:
          type: string
          enum: [Basso, Medio, Alto]
        confidenceScore:
          type: number
        estimatedProbability:
          type: number
        scoreBreakdown:
          $ref: "#/components/schemas/ScoreBreakdown"
        mtfAnalysis:
          $ref: "#/components/schemas/MtfAnalysis"
        invalidationConditions:
          type: array
          items:
            type: string
      required: [ticker, price, score, signal, direction, verdict, reason, tp, sl, atr, ema50, ema100, ema200, rsi, macdHistogram, volumeRatio, falseSignalRisk, confidenceScore, estimatedProbability, scoreBreakdown, mtfAnalysis, invalidationConditions]

    ApiError:
      type: object
      properties:
        error:
          type: string
      required: [error]
```

## PERCORSO: lib/api-spec/orval.config.ts
```ts
import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
```

## PERCORSO: lib/api-spec/package.json
```json
{
  "name": "@workspace/api-spec",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "codegen": "orval --config ./orval.config.ts && sed -i \"/export \\* from '.\\/generated\\/types'/d\" ../../lib/api-zod/src/index.ts && pnpm -w run typecheck:libs"
  },
  "devDependencies": {
    "orval": "^8.9.1"
  }
}
```

## PERCORSO: lib/api-zod/package.json
```json
{
  "name": "@workspace/api-zod",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "catalog:"
  }
}
```

## PERCORSO: lib/api-zod/src/generated/api.ts
```ts
/**
 * Generated by orval v8.9.1 🍺
 * Do not edit manually.
 * Api
 * API specification
 * OpenAPI spec version: 0.1.0
 */
import * as zod from 'zod';


/**
 * @summary Health check
 */
export const HealthCheckResponse = zod.object({
  "status": zod.string()
})


/**
 * @summary Get portfolio
 */
export const GetPortfolioResponse = zod.object({
  "balance": zod.number(),
  "telegramChatId": zod.string().nullish(),
  "trades": zod.array(zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "status": zod.enum(['active', 'paused']).optional()
})),
  "closedTrades": zod.array(zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "closedAt": zod.string(),
  "closeReason": zod.enum(['TP_HIT', 'SL_HIT', 'MANUAL']),
  "exitPrice": zod.number(),
  "pnl": zod.number()
}))
})


/**
 * @summary Update portfolio settings
 */
export const UpdatePortfolioBody = zod.object({
  "balance": zod.number().optional(),
  "telegramChatId": zod.string().optional()
})

export const UpdatePortfolioResponse = zod.object({
  "balance": zod.number(),
  "telegramChatId": zod.string().nullish(),
  "trades": zod.array(zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "status": zod.enum(['active', 'paused']).optional()
})),
  "closedTrades": zod.array(zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "closedAt": zod.string(),
  "closeReason": zod.enum(['TP_HIT', 'SL_HIT', 'MANUAL']),
  "exitPrice": zod.number(),
  "pnl": zod.number()
}))
})


/**
 * @summary Get portfolio summary stats
 */
export const GetPortfolioSummaryResponse = zod.object({
  "totalTrades": zod.number(),
  "buySignals": zod.number(),
  "avgScore": zod.number(),
  "highestScoringTicker": zod.string().nullish()
})


/**
 * Win Rate, Profit Factor, Total PnL computed from closed trades
 * @summary Get performance metrics
 */
export const GetPortfolioMetricsResponse = zod.object({
  "totalPnl": zod.number(),
  "winRate": zod.number(),
  "profitFactor": zod.number(),
  "totalClosedTrades": zod.number(),
  "winningTrades": zod.number(),
  "losingTrades": zod.number()
})


/**
 * @summary List open trades
 */
export const GetTradesResponseItem = zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "status": zod.enum(['active', 'paused']).optional()
})
export const GetTradesResponse = zod.array(GetTradesResponseItem)


/**
 * @summary Analyze and add a trade
 */
export const AddTradeBody = zod.object({
  "ticker": zod.string(),
  "investAmount": zod.number().optional()
})

export const AddTradeResponse = zod.object({
  "success": zod.boolean(),
  "message": zod.string(),
  "signal": zod.string().optional(),
  "direction": zod.string().nullish(),
  "score": zod.number().nullish(),
  "verdict": zod.string().nullish(),
  "confidenceScore": zod.number().nullish(),
  "estimatedProbability": zod.number().nullish(),
  "reason": zod.string().nullish(),
  "trade": zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "status": zod.enum(['active', 'paused']).optional()
}).optional()
})


/**
 * @summary List closed trades history
 */
export const GetClosedTradesResponseItem = zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "closedAt": zod.string(),
  "closeReason": zod.enum(['TP_HIT', 'SL_HIT', 'MANUAL']),
  "exitPrice": zod.number(),
  "pnl": zod.number()
})
export const GetClosedTradesResponse = zod.array(GetClosedTradesResponseItem)


/**
 * @summary Get open trades with live price and unrealized PnL
 */
export const GetTradesLiveResponseItem = zod.object({
  "ticker": zod.string(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "currentPrice": zod.number().nullable(),
  "unrealizedPnl": zod.number().nullable(),
  "priceChangePercent": zod.number().nullable()
})
export const GetTradesLiveResponse = zod.array(GetTradesLiveResponseItem)


/**
 * @summary Remove trade from tracking
 */
export const DeleteTradeParams = zod.object({
  "ticker": zod.coerce.string()
})

export const DeleteTradeResponse = zod.object({
  "success": zod.boolean(),
  "message": zod.string()
})


/**
 * @summary Pause or resume monitoring for a tracked asset
 */
export const UpdateTradeStatusParams = zod.object({
  "ticker": zod.coerce.string()
})

export const UpdateTradeStatusBody = zod.object({
  "status": zod.enum(['active', 'paused'])
})

export const UpdateTradeStatusResponse = zod.object({
  "ticker": zod.string(),
  "entry": zod.number(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "direction": zod.enum(['LONG', 'SHORT']),
  "reason": zod.string(),
  "investAmount": zod.number(),
  "addedAt": zod.string(),
  "status": zod.enum(['active', 'paused']).optional()
})


/**
 * @summary Search for a ticker by company name, ticker, ISIN, crypto or ETF name
 */
export const SearchSymbolsQueryParams = zod.object({
  "q": zod.coerce.string()
})

export const SearchSymbolsResponse = zod.object({
  "query": zod.string(),
  "matches": zod.array(zod.object({
  "symbol": zod.string(),
  "instrumentName": zod.string(),
  "exchange": zod.string().nullish(),
  "country": zod.string().nullish(),
  "instrumentType": zod.string().nullish(),
  "currency": zod.string().nullish()
})),
  "providerLimited": zod.boolean(),
  "note": zod.string().nullish()
})


/**
 * @summary Analyze a ticker
 */
export const AnalyzeTickerParams = zod.object({
  "ticker": zod.coerce.string()
})

export const AnalyzeTickerResponse = zod.object({
  "ticker": zod.string(),
  "price": zod.number(),
  "score": zod.number(),
  "signal": zod.string(),
  "direction": zod.enum(['LONG', 'SHORT', 'WAIT']),
  "verdict": zod.enum(['FORTE_BUY', 'BUY', 'NEUTRALE', 'SELL', 'FORTE_SELL']),
  "reason": zod.string(),
  "tp": zod.number(),
  "sl": zod.number(),
  "atr": zod.number(),
  "ema50": zod.number(),
  "ema100": zod.number(),
  "ema200": zod.number(),
  "rsi": zod.number(),
  "macdHistogram": zod.number(),
  "volumeRatio": zod.number(),
  "falseSignalRisk": zod.enum(['Basso', 'Medio', 'Alto']),
  "confidenceScore": zod.number(),
  "estimatedProbability": zod.number(),
  "scoreBreakdown": zod.object({
  "trend": zod.number(),
  "momentum": zod.number(),
  "volatility": zod.number(),
  "volume": zod.number(),
  "structure": zod.number(),
  "multiTimeframe": zod.number()
}),
  "mtfAnalysis": zod.object({
  "m15": zod.string(),
  "h1": zod.string(),
  "h4": zod.string(),
  "daily": zod.string()
}),
  "invalidationConditions": zod.array(zod.string())
})
```

## PERCORSO: lib/api-zod/src/index.ts
```ts
export * from "./generated/api";
```

## PERCORSO: lib/api-zod/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## PERCORSO: lib/db/drizzle.config.ts
```ts
import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## PERCORSO: lib/db/package.json
```json
{
  "name": "@workspace/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "push": "drizzle-kit push --config ./drizzle.config.ts",
    "push-force": "drizzle-kit push --force --config ./drizzle.config.ts"
  },
  "dependencies": {
    "drizzle-orm": "catalog:",
    "drizzle-zod": "^0.8.3",
    "pg": "^8.20.0",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/pg": "^8.20.0",
    "drizzle-kit": "^0.31.10"
  }
}
```

## PERCORSO: lib/db/src/index.ts
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
```

## PERCORSO: lib/db/src/schema/index.ts
```ts
export * from "./signals";
```

## PERCORSO: lib/db/src/schema/signals.ts
```ts
import {
  pgTable, serial, varchar, integer, decimal, boolean, timestamp
} from "drizzle-orm/pg-core";

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  asset: varchar("asset", { length: 20 }).notNull(),
  timeframe: varchar("timeframe", { length: 10 }).notNull().default("1h"),
  direction: varchar("direction", { length: 10 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  tp: decimal("tp", { precision: 20, scale: 8 }),
  sl: decimal("sl", { precision: 20, scale: 8 }),
  score: integer("score").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  estimatedProbability: integer("estimated_probability").notNull().default(0),
  rsi: decimal("rsi", { precision: 8, scale: 4 }),
  macdHistogram: decimal("macd_histogram", { precision: 16, scale: 8 }),
  ema50: decimal("ema50", { precision: 20, scale: 8 }),
  ema100: decimal("ema100", { precision: 20, scale: 8 }),
  ema200: decimal("ema200", { precision: 20, scale: 8 }),
  atr: decimal("atr", { precision: 20, scale: 8 }),
  volumeRatio: decimal("volume_ratio", { precision: 8, scale: 4 }),
  trend: varchar("trend", { length: 50 }),
  momentum: varchar("momentum", { length: 50 }),
  volatility: varchar("volatility", { length: 50 }),
  confluence: integer("confluence").notNull().default(0),
  marketRegime: varchar("market_regime", { length: 50 }),
  verdict: varchar("verdict", { length: 20 }),
  falseSignalRisk: varchar("false_signal_risk", { length: 20 }),
  status: varchar("status", { length: 10 }).notNull().default("PENDING"),
  qualified: boolean("qualified").notNull().default(false),
  qualityTier: varchar("quality_tier", { length: 10 }),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
  profitPct: decimal("profit_pct", { precision: 10, scale: 4 }),
  maxProfitPct: decimal("max_profit_pct", { precision: 10, scale: 4 }),
  maxDrawdownPct: decimal("max_drawdown_pct", { precision: 10, scale: 4 }),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const qualityFilterSettings = pgTable("quality_filter_settings", {
  id: integer("id").primaryKey().default(1),
  minScore: integer("min_score").notNull().default(70),
  minConfidence: integer("min_confidence").notNull().default(60),
  minConfluence: integer("min_confluence").notNull().default(4),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;
export type QualityFilter = typeof qualityFilterSettings.$inferSelect;
```

## PERCORSO: lib/db/tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

## PERCORSO: package.json
```json
{
  "name": "workspace",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {
    "preinstall": "sh -c 'rm -f package-lock.json yarn.lock; case \"$npm_config_user_agent\" in pnpm/*) ;; *) echo \"Use pnpm instead\" >&2; exit 1 ;; esac'",
    "build": "pnpm run typecheck && pnpm -r --if-present run build",
    "typecheck:libs": "tsc --build",
    "typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
  },
  "private": true,
  "pnpm": {
    "overrides": {
      "js-yaml": "^4.1.0"
    }
  },
  "devDependencies": {
    "prettier": "^3.8.3",
    "typescript": "~5.9.3"
  }
}
```

## PERCORSO: pnpm-workspace.yaml
```yaml
packages:
  - artifacts/*
  - lib/*
  - lib/integrations/*
  - scripts

autoInstallPeers: false

catalog:
  '@replit/vite-plugin-cartographer': ^0.5.1
  '@replit/vite-plugin-dev-banner': ^0.1.1
  '@replit/vite-plugin-runtime-error-modal': ^0.0.6
  '@tailwindcss/vite': ^4.1.14
  '@tanstack/react-query': ^5.90.21
  '@types/node': ^25.3.3
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@vitejs/plugin-react': ^5.0.4
  class-variance-authority: ^0.7.1
  clsx: ^2.1.1
  drizzle-orm: ^0.45.2
  framer-motion: ^12.23.24
  lucide-react: ^0.545.0
  react: 19.1.0
  react-dom: 19.1.0
  tailwind-merge: ^3.3.1
  tailwindcss: ^4.1.14
  tsx: ^4.21.0
  vite: ^7.3.5
  wouter: ^3.3.5
  zod: 3.25.76

minimumReleaseAge: 1440

minimumReleaseAgeExclude:
  - '@replit/*'
  - stripe-replit-sync

onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - unrs-resolver

overrides:
  '@babel/core': '>=7.29.7'
  '@esbuild-kit/esm-loader': npm:tsx@^4.21.0
  '@expo/ngrok-bin>@expo/ngrok-bin-darwin-arm64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-darwin-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-freebsd-ia32': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-freebsd-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-arm': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-arm64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-ia32': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-sunos-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-win32-ia32': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-win32-x64': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-android-arm64': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-darwin-arm64': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-darwin-x64': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-freebsd-x64': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-linux-arm-gnueabihf': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-linux-arm64-gnu': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-linux-arm64-musl': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-linux-x64-musl': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-win32-arm64-msvc': '-'
  '@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc': '-'
  esbuild: 0.28.1
  esbuild>@esbuild/aix-ppc64: '-'
  esbuild>@esbuild/android-arm: '-'
  esbuild>@esbuild/android-arm64: '-'
  esbuild>@esbuild/android-x64: '-'
  esbuild>@esbuild/darwin-arm64: '-'
  esbuild>@esbuild/darwin-x64: '-'
  esbuild>@esbuild/freebsd-arm64: '-'
  esbuild>@esbuild/freebsd-x64: '-'
  esbuild>@esbuild/linux-arm: '-'
  esbuild>@esbuild/linux-arm64: '-'
  esbuild>@esbuild/linux-ia32: '-'
  esbuild>@esbuild/linux-loong64: '-'
  esbuild>@esbuild/linux-mips64el: '-'
  esbuild>@esbuild/linux-ppc64: '-'
  esbuild>@esbuild/linux-riscv64: '-'
  esbuild>@esbuild/linux-s390x: '-'
  esbuild>@esbuild/netbsd-arm64: '-'
  esbuild>@esbuild/netbsd-x64: '-'
  esbuild>@esbuild/openbsd-arm64: '-'
  esbuild>@esbuild/openbsd-x64: '-'
  esbuild>@esbuild/openharmony-arm64: '-'
  esbuild>@esbuild/sunos-x64: '-'
  esbuild>@esbuild/win32-arm64: '-'
  esbuild>@esbuild/win32-ia32: '-'
  esbuild>@esbuild/win32-x64: '-'
  form-data: '>=4.0.6'
  js-yaml: '>=4.3.0'
  lightningcss>lightningcss-android-arm64: '-'
  lightningcss>lightningcss-darwin-arm64: '-'
  lightningcss>lightningcss-darwin-x64: '-'
  lightningcss>lightningcss-freebsd-x64: '-'
  lightningcss>lightningcss-linux-arm-gnueabihf: '-'
  lightningcss>lightningcss-linux-arm64-gnu: '-'
  lightningcss>lightningcss-linux-arm64-musl: '-'
  lightningcss>lightningcss-linux-x64-musl: '-'
  lightningcss>lightningcss-win32-arm64-msvc: '-'
  lightningcss>lightningcss-win32-x64-msvc: '-'
  linkify-it: '>=5.0.2'
  markdown-it: '>=14.3.0'
  qs: '>=6.15.2'
  rollup>@rollup/rollup-android-arm-eabi: '-'
  rollup>@rollup/rollup-android-arm64: '-'
  rollup>@rollup/rollup-darwin-arm64: '-'
  rollup>@rollup/rollup-darwin-x64: '-'
  rollup>@rollup/rollup-freebsd-arm64: '-'
  rollup>@rollup/rollup-freebsd-x64: '-'
  rollup>@rollup/rollup-linux-arm-gnueabihf: '-'
  rollup>@rollup/rollup-linux-arm-musleabihf: '-'
  rollup>@rollup/rollup-linux-arm64-gnu: '-'
  rollup>@rollup/rollup-linux-arm64-musl: '-'
  rollup>@rollup/rollup-linux-loong64-gnu: '-'
  rollup>@rollup/rollup-linux-loong64-musl: '-'
  rollup>@rollup/rollup-linux-ppc64-gnu: '-'
  rollup>@rollup/rollup-linux-ppc64-musl: '-'
  rollup>@rollup/rollup-linux-riscv64-gnu: '-'
  rollup>@rollup/rollup-linux-riscv64-musl: '-'
  rollup>@rollup/rollup-linux-s390x-gnu: '-'
  rollup>@rollup/rollup-linux-x64-musl: '-'
  rollup>@rollup/rollup-openbsd-x64: '-'
  rollup>@rollup/rollup-openharmony-arm64: '-'
  rollup>@rollup/rollup-win32-arm64-msvc: '-'
  rollup>@rollup/rollup-win32-ia32-msvc: '-'
  rollup>@rollup/rollup-win32-x64-gnu: '-'
  rollup>@rollup/rollup-win32-x64-msvc: '-'
```

## PERCORSO: scripts/package.json
```json
{
  "name": "@workspace/scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "hello": "tsx ./src/hello.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "tsx": "catalog:"
  }
}
```

## PERCORSO: scripts/src/hello.ts
```ts
console.log("Hello from @workspace/scripts");
```

## PERCORSO: scripts/tsconfig.json
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

## PERCORSO: tsconfig.base.json
```json
{
  "compilerOptions": {
    "isolatedModules": true,
    "lib": ["es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmitOnError": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": false,
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": false,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "skipLibCheck": true,
    "target": "es2022",
    "types": [],
    "customConditions": ["workspace"]
  }
}
```

## PERCORSO: tsconfig.json
```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    {
      "path": "./lib/db"
    },
    {
      "path": "./lib/api-client-react"
    },
    {
      "path": "./lib/api-zod"
    }
  ]
}
```

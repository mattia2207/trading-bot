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

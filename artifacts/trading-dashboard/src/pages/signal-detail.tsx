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
  volume_ratio: number; heuristic_confidence: number;
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
            { label: "Heuristic confidence",value: `${sig.heuristic_confidence}%`, color: "text-foreground" },
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
              description="Higher Highs + Higher Lows: la piattaforma opera solo in direzione LONG"
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

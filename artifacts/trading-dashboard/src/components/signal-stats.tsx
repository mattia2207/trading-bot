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

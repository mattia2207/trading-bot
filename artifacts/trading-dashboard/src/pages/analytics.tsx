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
    ? (data?.byDow ?? [])
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
          <ChartCard title="LONG vs chiusure" icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />}>
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

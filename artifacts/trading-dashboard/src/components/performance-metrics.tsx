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

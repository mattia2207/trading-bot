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

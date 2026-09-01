import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPositions,
  useDeleteTrade,
  getGetPortfolioQueryKey,
  getGetTradesQueryKey,
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
  const { data: positions, isLoading, dataUpdatedAt, refetch } = useGetPositions({
    query: { queryKey: ["platform-positions"], refetchInterval: REFRESH_INTERVAL_MS },
  });
  const trades = positions?.map((position) => ({
    ticker: position.symbol,
    direction: position.side,
    investAmount: position.quantity * position.entryPrice,
    entry: position.entryPrice,
    tp: position.takeProfit,
    sl: position.stopLoss,
    reason: "Posizione persistita su PostgreSQL.",
    currentPrice: null as number | null,
    unrealizedPnl: null as number | null,
    priceChangePercent: null as number | null,
  })) ?? [];
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
            {trades.length} posizioni aperte
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
                    Prezzo corrente
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
                      <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">LONG</Badge>
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

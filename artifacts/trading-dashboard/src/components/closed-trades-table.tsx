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
                          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 rounded-sm font-mono text-[10px] px-1.5 h-5">LONG</Badge>
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

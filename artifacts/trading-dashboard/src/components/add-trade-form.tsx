import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddTrade,
  useSearchSymbols,
  getSearchSymbolsQueryKey,
  getGetPortfolioQueryKey,
  getGetTradesQueryKey,
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
    {
      query: {
        queryKey: getSearchSymbolsQueryKey({ q: debouncedTerm }),
        enabled: debouncedTerm.trim().length >= 2,
      },
    }
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
            {(result.confidenceScore != null || result.heuristicConfidence != null) && (
              <div className={`grid grid-cols-2 divide-x ${cfg.border} border-b ${cfg.border}`}>
                <div className="px-4 py-2 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Confidence</p>
                  <p className={`font-mono text-base font-bold ${cfg.color}`}>
                    {result.confidenceScore ?? "—"}%
                  </p>
                </div>
                <div className="px-4 py-2 text-center">
                   <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Heuristic confidence</p>
                  <p className={`font-mono text-base font-bold ${cfg.color}`}>
                     {result.heuristicConfidence ?? "—"}%
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

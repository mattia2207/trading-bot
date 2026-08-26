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

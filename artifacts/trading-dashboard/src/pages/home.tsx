import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPortfolio, useUpdatePortfolio, getGetPortfolioQueryKey,
  useGetPlatformStatus, useGetPlatformSettings, useUpdateKillSwitch,
} from "@workspace/api-client-react";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { AddTradeForm } from "@/components/add-trade-form";
import { TradesTable } from "@/components/trades-table";
import { PerformanceMetrics } from "@/components/performance-metrics";
import { ClosedTradesTable } from "@/components/closed-trades-table";
import { SignalStats } from "@/components/signal-stats";
import { QualityFilter } from "@/components/quality-filter";
import { SignalList } from "@/components/signal-list";
import { Terminal, Activity, Bell, CheckCircle2, Database, BarChart2, ShieldCheck, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function TelegramCard() {
  const { data: portfolio } = useGetPortfolio();
  const updatePortfolio = useUpdatePortfolio();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState("");

  const handleSave = () => {
    updatePortfolio.mutate({ data: { telegramChatId: chatId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        setChatId("");
      }
    });
  };

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Notifiche Telegram
            {portfolio?.telegramChatId && (
              <span className="flex items-center text-xs text-green-500 font-normal bg-green-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attive
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Inserisci il tuo Telegram Chat ID per ricevere notifiche quando il bot raggiunge TP o SL.
            I segnali qualificati (ELITE / FORTE / NORMALE) vengono inviati automaticamente.
            <br />
            <span className="opacity-75">
              Per trovare il tuo Chat ID: scrivi <code className="bg-muted px-1 py-0.5 rounded">/start</code> al tuo bot,
              poi invia un messaggio a <code className="bg-muted px-1 py-0.5 rounded">@userinfobot</code>
            </span>
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2 mt-2 md:mt-0">
          <Input
            placeholder={portfolio?.telegramChatId || "Chat ID..."}
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="w-full md:w-48 h-9 text-sm rounded-sm bg-background"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!chatId || updatePortfolio.isPending}
            className="h-9 rounded-sm"
          >
            Salva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformStatusCard() {
  const { data: status } = useGetPlatformStatus({
    query: { queryKey: ["platform-status"], refetchInterval: 30_000 },
  });
  const { data: settings } = useGetPlatformSettings({
    query: { queryKey: ["platform-settings"] },
  });
  const killSwitch = useUpdateKillSwitch();

  const toggleKillSwitch = () => killSwitch.mutate({
    data: {
      active: !status?.killSwitchActive,
      reason: status?.killSwitchActive ? null : "Arresto manuale dal terminale",
    },
  });

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Guardrail operativi</h2>
              <p className="text-xs text-muted-foreground">Paper trading · Spot · LONG only · approvazione manuale</p>
            </div>
          </div>
          <Button
            size="sm"
            variant={status?.killSwitchActive ? "default" : "outline"}
            className="rounded-sm gap-2"
            onClick={toggleKillSwitch}
            disabled={!status || killSwitch.isPending}
          >
            <Power className="w-3.5 h-3.5" />
            {status?.killSwitchActive ? "Riattiva esecuzione" : "Arresto di emergenza"}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <StatusPill label="Modalità" value={status?.executionMode === "testnet" ? "TESTNET" : "PAPER"} tone={status?.executionMode === "testnet" ? "amber" : "green"} />
          <StatusPill label="API" value={status?.apiStatus?.toUpperCase() ?? "—"} tone="green" />
          <StatusPill label="Database" value={status?.databaseStatus?.toUpperCase() ?? "—"} tone="green" />
          <StatusPill label="Rischio / trade" value={settings ? `${settings.riskPerTradePct}%` : "—"} />
          <StatusPill label="R:R minimo" value={settings ? `${settings.minRewardRisk}x` : "—"} />
        </div>
        {status?.killSwitchActive && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
            {status.killSwitchActive ? "Esecuzione bloccata dal kill switch." : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPill({ label, value, tone = "muted" }: { label: string; value: string; tone?: "green" | "amber" | "muted" }) {
  const toneClass = tone === "green"
    ? "text-emerald-400"
    : tone === "amber" ? "text-amber-400" : "text-foreground";
  return (
    <div className="bg-background border border-border rounded-sm px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-mono font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function Home() {
  const [investAmount, setInvestAmount] = useState(100);
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
            Advisor Bot Terminal
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          </h1>

          {/* ── Nav ── */}
          <nav className="ml-auto flex items-center gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
              <Terminal className="w-3 h-3" />Terminal
            </span>
            <button
              onClick={() => navigate("/analytics")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-transparent"
            >
              <BarChart2 className="w-3 h-3" />Analytics
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        <PerformanceMetrics />
        <PlatformStatusCard />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PortfolioSummary investAmount={investAmount} setInvestAmount={setInvestAmount} />
          </div>
          <div>
            <AddTradeForm investAmount={investAmount} />
          </div>
        </div>

        <TelegramCard />

        {/* ── Signal Intelligence ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
            <Database className="w-4 h-4" />
            <h2>Intelligence Segnali — Apprendimento Automatico</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SignalStats />
            </div>
            <div>
              <QualityFilter />
            </div>
          </div>
        </div>

        {/* ── Signal History ── */}
        <SignalList />

        {/* ── Monitored Assets ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
            <Activity className="w-4 h-4" />
            <h2>Asset Attualmente Sotto Monitoraggio</h2>
          </div>
          <TradesTable />
        </div>

        <ClosedTradesTable />
      </main>
    </div>
  );
}

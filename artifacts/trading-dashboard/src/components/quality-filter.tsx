import { useState, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FilterSettings {
  minScore: number;
  minConfidence: number;
  minConfluence: number;
}

const TIER_INFO = [
  { tier: "ELITE",   icon: "🏆", color: "text-amber-400",  border: "border-amber-500/30",  bg: "bg-amber-500/10",  req: "Score ≥85 · Confidence ≥70% · Confluenza ≥5/6" },
  { tier: "FORTE",   icon: "⭐", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", req: "Score ≥75 · Confidence ≥65%"                    },
  { tier: "NORMALE", icon: "📊", color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-500/10",   req: "Score ≥70 · Confidence ≥60%"                    },
] as const;

// ─── Slider field ─────────────────────────────────────────────────────────────

const SliderField = memo(function SliderField({
  label, value, min, max, description, onChange,
}: {
  label: string; value: number; min: number; max: number;
  description: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="font-mono text-sm font-bold text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
        }}
      />
      <p className="text-[9px] text-muted-foreground">{description}</p>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export const QualityFilter = memo(function QualityFilter() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<FilterSettings>({
    queryKey: ["quality-filter"],
    queryFn: () => apiFetch("/api/signals/quality-filter"),
    staleTime: 60_000,
  });

  const [minScore,      setMinScore]      = useState(70);
  const [minConfidence, setMinConfidence] = useState(60);
  const [minConfluence, setMinConfluence] = useState(4);
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    if (data) {
      setMinScore(data.minScore ?? 70);
      setMinConfidence(data.minConfidence ?? 60);
      setMinConfluence(data.minConfluence ?? 4);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: Partial<FilterSettings>) =>
      apiFetch("/api/signals/quality-filter", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality-filter"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border rounded-sm shadow-none">
        <CardContent className="py-6 text-center text-xs text-muted-foreground animate-pulse">Caricamento...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border rounded-sm shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          Filtro Qualità Segnali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-5">
          <SliderField
            label="Score Minimo"
            value={minScore} min={50} max={100}
            description="Solo segnali con score ≥ questa soglia vengono inviati su Telegram"
            onChange={setMinScore}
          />
          <SliderField
            label="Confidence Minima"
            value={minConfidence} min={40} max={95}
            description="Filtra per livello di confidence del modello"
            onChange={setMinConfidence}
          />
          <SliderField
            label="Confluenza Minima (fattori/6)"
            value={minConfluence} min={1} max={6}
            description="Quanti dei 6 fattori (Trend, Momentum, Volume, Struttura, MTF, Volatilità) devono essere allineati"
            onChange={setMinConfluence}
          />
        </div>

        <Button
          onClick={() => mutation.mutate({ minScore, minConfidence, minConfluence })}
          disabled={mutation.isPending}
          className="w-full h-9 rounded-sm"
          size="sm"
        >
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Salvataggio...</>
          ) : saved ? (
            <><CheckCircle2 className="mr-2 h-3 w-3 text-emerald-400" />Salvato</>
          ) : (
            "Salva Impostazioni"
          )}
        </Button>

        <div className="space-y-2 pt-1">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Livelli di Qualità</p>
          {TIER_INFO.map(t => (
            <div key={t.tier} className={`rounded-sm border ${t.border} ${t.bg} px-3 py-2`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{t.icon}</span>
                <span className={`text-xs font-bold font-mono ${t.color}`}>{t.tier}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">{t.req}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

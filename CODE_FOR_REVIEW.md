# Trading Bot — codice per revisione

Questo documento è il bundle di orientamento per la revisione del progetto.
Il codice sorgente completo è organizzato nei percorsi indicati sotto.

## Vincoli di sicurezza

- Default `EXECUTION_MODE=paper`.
- Binance consentito solo Spot Testnet.
- Testnet attivo soltanto con `EXECUTION_MODE=testnet`, `TESTNET_ENABLED=true` e entrambe le credenziali configurate.
- LONG only; nessun Futures, Margin, leva, live trading, prelievo o trasferimento.
- Clerk obbligatorio; il primo utente autenticato reclama il terminale, gli altri ricevono 403.
- L’analisi crea un segnale pendente; solo l’approvazione manuale può aprire una posizione.
- Stato operativo esclusivamente in PostgreSQL; nessun `portfolio.json` nel flusso runtime.

## Punti principali

### Backend

- `artifacts/api-server/src/app.ts` — Express, Clerk proxy, cookie session, rate limit e CORS.
- `artifacts/api-server/src/middlewares/auth.ts` — autenticazione e single-owner guard.
- `artifacts/api-server/src/routes/index.ts` — health pubblico e protezione delle route operative.
- `artifacts/api-server/src/routes/platform.ts` — status, settings, kill switch, posizioni, ordini, fill, audit e approvazione.
- `artifacts/api-server/src/routes/trading.ts` — analisi senza apertura automatica, portfolio derivato dal DB e chiusura posizione.
- `artifacts/api-server/src/lib/platform.ts` — persistenza PostgreSQL e audit trail.
- `artifacts/api-server/src/lib/risk-engine.ts` — sizing da stop, esposizione, cap giornalieri, cooldown e R:R.
- `artifacts/api-server/src/lib/broker.ts` — `PaperBroker` e `BinanceTestnetBroker` fail-closed.
- `artifacts/api-server/src/lib/analysis.ts` — analisi su candele e segnali LONG/WAIT.
- `artifacts/api-server/src/lib/signals.ts` — persistenza e statistiche segnali, senza DDL runtime.

### Frontend

- `artifacts/trading-dashboard/src/App.tsx` — Clerk, routing e cache isolata per utente.
- `artifacts/trading-dashboard/src/pages/home.tsx` — terminale autenticato con stato operativo e kill switch.
- `artifacts/trading-dashboard/src/components/add-trade-form.tsx` — analisi e messaggio di approvazione manuale.
- `artifacts/trading-dashboard/src/components/trades-table.tsx` — posizioni persistite.
- `artifacts/trading-dashboard/src/pages/signal-detail.tsx` — dettaglio e heuristic confidence.

### Contratti e database

- `lib/api-spec/openapi.yaml` — contratto API.
- `lib/api-client-react/src/generated/` — client React rigenerato.
- `lib/api-zod/src/generated/` — schemi runtime rigenerati.
- `lib/db/src/schema/platform.ts` — settings, trade, ordini, fill, risk events e audit.
- `lib/db/src/schema/signals.ts` — segnali e colonne legacy mantenute senza perdita dati.
- `lib/db/drizzle/` — migrazioni generate.

## Verifiche eseguite

```text
pnpm run typecheck
pnpm --filter @workspace/api-server run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/trading-dashboard run build
pnpm --filter @workspace/db push
```

Il warning sourcemap di Vite su `tooltip.tsx` e `label.tsx` non blocca la build.
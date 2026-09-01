# Trading platform safety model

## Execution boundary

- The default execution mode is `paper`.
- The only exchange mode is Binance Spot Testnet.
- Testnet requires both `EXECUTION_MODE=testnet` and `TESTNET_ENABLED=true`.
- Missing Binance Testnet credentials fail closed before any exchange request.
- There is no live, futures, margin, leverage, withdrawal, or transfer flow.

## Approval and persistence

Analysis creates a pending signal only. A position can be opened only by the authenticated single owner through the manual signal approval endpoint.

Operational state is stored in PostgreSQL: platform settings, positions, orders, fills, risk events, and audit events. The former JSON portfolio is not part of the runtime path.

## Risk controls

Approval checks the kill switch, LONG-only qualification, open-position cap, daily trade cap, daily loss cap, cooldown, minimum reward/risk, risk-per-trade sizing, and maximum exposure. Every accepted order is recorded with its broker response and audit metadata.

## Authentication

Clerk session cookies protect every non-health API route. The first authenticated user claims the private terminal; subsequent users receive a 403 response.
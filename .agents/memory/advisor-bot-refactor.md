---
name: Advisor Bot Terminal — refactor decisions
description: Hard-won lessons from the backend security refactor and frontend optimisation pass
---

## zod dependency
`zod` must be listed in `artifacts/api-server/package.json` directly (not just root).
esbuild bundles from the workspace package's own `node_modules`, so a root-only install causes "Could not resolve 'zod'" at build time.
**Why:** Monorepo isolation — esbuild doesn't hoist from the root automatically.
**How to apply:** Always `pnpm add <pkg>` from inside `artifacts/api-server/` if it's used by the API server.

## expireOldSignals placement
`expireOldSignals()` must NOT be called on every HTTP request (removed from `GET /api/signals/stats/global`).
It is called once per monitor cycle (every 60 s) inside `startMonitor()` in `telegram.ts`, fire-and-forget with `.catch()`.
**Why:** Calling it per-request added DB write latency to every stats poll.
**How to apply:** Any future maintenance on expiry logic — edit the monitor interval, not the route handlers.

## React memo + ReactNode import pattern
When using `memo` and the `ReactNode` type in the same file (e.g. for TABS arrays), import both from `"react"`:
```ts
import { useState, memo, type ReactNode } from "react";
```
Using `React.ReactNode` without importing `React` will cause a TypeScript error with the new JSX transform.
**Why:** New JSX transform no longer auto-imports React, so namespace access fails at compile time.

## Frontend QueryClient settings
`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` in the global QueryClient default.
Stats endpoints use `refetchInterval: 60_000`, list uses `refetchInterval: 30_000`.
Range stats (score/confidence/confluence/regime) use `refetchInterval: 120_000, staleTime: 60_000` (slow-changing data).
**Why:** The previous default caused a burst of 10+ requests per tab switch.

## Shared api utility
All frontend components must use `apiFetch` from `@/lib/api` — centralises BASE_URL resolution and error handling.
`formatPrice` adaptive decimal formatter also lives there.
**Why:** Previously each component had its own `fetch(BASE + path)` with different BASE_URL handling, causing inconsistent paths.

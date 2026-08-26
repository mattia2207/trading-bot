/**
 * Shared API fetch utility for the trading dashboard.
 * Centralises BASE_URL resolution and error handling.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Adaptive decimal formatter — consistent across all components. */
export function formatPrice(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  if (val === 0) return "0.00";
  const abs = Math.abs(val);
  const dec =
    abs >= 10_000 ? 2 :
    abs >= 1_000  ? 2 :
    abs >= 100    ? 3 :
    abs >= 1      ? 4 :
    abs >= 0.01   ? 6 : 8;
  return val.toFixed(dec);
}

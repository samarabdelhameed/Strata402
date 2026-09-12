/**
 * Strata402 api-gateway — keyless SaucerSwap FINANCE public data adapter (gateway side).
 *
 * Mirrors the exact discipline of `mirror.ts` in this same gateway:
 * - Keyless, read-only GETs against SaucerSwap Testnet REST API
 *   (https://test-api.saucerswap.finance). No API key required.
 * - Return only typed facts published on the wire; never a partial guess.
 * - **APY is ALWAYS UNAVAILABLE.** The public pools endpoint exposes fee tiers,
 *   reserves, prices, and identity facts — but NO historical volume or fee-earnings
 *   history. A trustworthy pool APY cannot be derived from public daily data and is
 *   therefore ALWAYS reported `null`; it is NEVER invented, blended, or inherited
 *   from a pool that was not the one actually read.
 * - Fail-closed: any non-200 body or malformed shape raises a machine-readable
 *   `SaucerReadError`; no fabricated pool fact is ever returned.
 */

export const SAUCER_BASE_URL =
  (typeof process !== "undefined" &&
    (process.env.SAUCERSWAP_API_URL || process.env.SAUCERSWAP_BASE_URL)?.trim()) ||
  "https://test-api.saucerswap.finance";
export const SAUCER_TOKENS_PATH = "/tokens";
export const SAUCER_POOLS_FULL_PATH = "/v2/pools/full";
export const SAUCER_TIMEOUT_SECONDS = 20;

export type SaucerReadErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "MALFORMED_JSON"
  | "UNREADABLE_FIELD";

export class SaucerReadError extends Error {
  readonly code: SaucerReadErrorCode;

  constructor(code: SaucerReadErrorCode, message: string) {
    super(message);
    this.name = "SaucerReadError";
    this.code = code;
  }
}

export type SaucerFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface SaucerPoolToken {
  id: string;
  symbol: string;
  name: string | null;
  decimals: number;
  priceUsd: number | null;
}

export interface SaucerPool {
  /** Generated id — the facts that /v2/pools/full actually publishes. */
  id: number;
  contractId: string | null;
  tokenA: SaucerPoolToken | null;
  tokenB: SaucerPoolToken | null;
  amountA: string;
  amountB: string;
  fee: number | null;
  sqrtRatioX96: string;
  tickCurrent: number | null;
  liquidity: string;
  /** ALWAYS null — a pools/full pool has no trustworthy on-wire APY. */
  poolApy: null;
}

export interface SaucerTokensRead {
  tokenCount: number;
  sampleSymbols: string[];
  topPoolSymbols: string[];
}

export interface SaucerPoolsRead {
  poolCount: number;
  feeTiersSeen: number[];
  pools: SaucerPool[];
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SaucerReadError("MALFORMED_JSON", `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function toStr(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s === "" ? null : s;
  }
  if (typeof value === "number") return String(value);
  return null;
}

function toInt(value: unknown, label: string): number | null {
  if (value === undefined || value === null || typeof value === "boolean") return null;
  if (typeof value === "number") return Math.trunc(value);
  const s = String(value).trim();
  if (s === "" || !/^-?\d+$/.test(s)) {
    throw new SaucerReadError("UNREADABLE_FIELD", `${label} must be an integer`);
  }
  return Number(s);
}

function parsePoolToken(value: unknown): SaucerPoolToken | null {
  const rec = asRecord(value, "pool.tokenA");
  const id = toStr(rec.id, "token.id");
  if (id === null) return null;
  return {
    id,
    symbol: toStr(rec.symbol, "token.symbol") ?? id,
    name: toStr(rec.name, "token.name"),
    decimals: toInt(rec.decimals, "token.decimals") ?? 0,
    priceUsd:
      toInt(rec.priceUsd, "token.priceUsd") === null
        ? null
        : Number(toStr(String(rec.priceUsd), "token.priceUsd")),
  };
}

export function parseTokensJson(payload: unknown): SaucerTokensRead {
  if (!Array.isArray(payload)) {
    throw new SaucerReadError("MALFORMED_JSON", "tokens payload must be an array");
  }
  const symbols: string[] = [];
  const topPoolSymbols: string[] = [];
  for (const raw of payload) {
    const rec = asRecord(raw, "token");
    const id = toStr(rec.id, "token.id");
    const symbol = toStr(rec.symbol, "token.symbol");
    if (id === null || symbol === null) continue;
    symbols.push(symbol);
    if (rec.inTopPools === true) topPoolSymbols.push(symbol);
  }
  return {
    tokenCount: symbols.length,
    sampleSymbols: symbols.slice(0, 8),
    topPoolSymbols: topPoolSymbols.slice(0, 8),
  };
}

export function parsePoolsJson(payload: unknown): SaucerPoolsRead {
  if (!Array.isArray(payload)) {
    throw new SaucerReadError("MALFORMED_JSON", "pools payload must be an array");
  }
  const pools: SaucerPool[] = [];
  const feeTiers: number[] = [];
  for (const raw of payload) {
    const rec = asRecord(raw, "pool");
    const id = toInt(rec.id, "pool.id");
    if (id === null) continue;
    const fee = toInt(rec.fee, "pool.fee");
    if (fee !== null && !feeTiers.includes(fee)) feeTiers.push(fee);
    pools.push({
      id,
      contractId: toStr(rec.contractId, "pool.contractId"),
      tokenA: parsePoolToken(rec.tokenA),
      tokenB: parsePoolToken(rec.tokenB),
      amountA: toStr(rec.amountA, "pool.amountA") ?? "0",
      amountB: toStr(rec.amountB, "pool.amountB") ?? "0",
      fee,
      sqrtRatioX96: toStr(rec.sqrtRatioX96, "pool.sqrtRatioX96") ?? "0",
      tickCurrent: toInt(rec.tickCurrent, "pool.tickCurrent"),
      liquidity: toStr(rec.liquidity, "pool.liquidity") ?? "0",
      poolApy: null,
    });
  }
  return {
    poolCount: pools.length,
    feeTiersSeen: feeTiers.sort((a, b) => a - b),
    pools,
  };
}

/** Reads `/tokens` (count + sample symbols). Top-level JSON array on the wire. */
export async function readSaucerTokens(
  saucerBaseUrl: string,
  fetchFn: SaucerFetch = fetch,
): Promise<SaucerTokensRead> {
  const res = await rawGet(`${saucerBaseUrl}${SAUCER_TOKENS_PATH}`, fetchFn);
  return parseTokensJson(res);
}

/** Reads `/v2/pools/full` (count + fee tiers + pools). APY always null. */
export async function readSaucerPools(
  saucerBaseUrl: string,
  fetchFn: SaucerFetch = fetch,
): Promise<SaucerPoolsRead> {
  const res = await rawGet(`${saucerBaseUrl}${SAUCER_POOLS_FULL_PATH}`, fetchFn);
  return parsePoolsJson(res);
}

async function rawGet(target: string, fetchFn: SaucerFetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new SaucerReadError("REQUEST_FAILED", `SaucerSwap request failed: ${String(cause)}`);
  }
  if (res.status !== 200) {
    throw new SaucerReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new SaucerReadError("MALFORMED_JSON", "SaucerSwap response is not valid JSON");
  }
  return payload;
}

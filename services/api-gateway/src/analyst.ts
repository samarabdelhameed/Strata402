/**
 * Mirror-Node-based account analysis for the paid `/v1/strategy/yield-risk`
 * endpoint (Phase 7A — hardened contract + explicit metadata).
 *
 * Honesty contract (approved scope):
 * - Only on-chain facts published by the Hedera Mirror Node are used.
 * - Protocol-specific claims (live pool APY, SaucerSwap/Bonzo liquidity, smart
 *   contract risk) are explicitly NOT made; they appear in `unavailable` and
 *   `limitations`. No `riskScore` / `confidence` numbers are invented.
 * - The request body is validated against the shared yield-risk contract:
 *   `accountId` (required, valid Hedera id), `riskTolerance`
 *   (conservative | balanced | aggressive), `amountHbar` (positive, safe
 *   precision). A malformed body is rejected with HTTP 400 BEFORE any mirror
 *   read — no paid caller is charged for an invalid contract.
 * - If mirror reads fail, the response degrades to `dataUnavailable: true`
 *   with neutral indications — never fabricated numbers, never 200-with-fake.
 */

import type { Request, Response } from "express";
import {
  ANALYSIS_LIMITATIONS,
  DEFAULT_ASSET,
  DEFAULT_NETWORK,
  DEFAULT_PRICE_TINYBARS,
  DISCLAIMER,
  TINYBARS_PER_HBAR,
  parseYieldRiskContract,
  type YieldRiskContract,
  type YieldRiskContractIssue,
} from "@strata402/x402-sdk";

import {
  MirrorReadError,
  readMirrorAccountSnapshot,
  type MirrorAccountRead,
} from "./mirror";

export const ANALYSIS_SOURCE = "hedera-mirror-node";
export const ANALYSIS_SCOPE = "account-level on-chain risk";
export const SERVICE_NAME = "strata402-api-gateway";
export const X402_PROTOCOL = "x402";
export const DEFAULT_STALE_AFTER_SECONDS = 24 * 60 * 60;

export const UNVAILABLE_FEATURES = [
  "live pool APY",
  "protocol liquidity",
  "smart-contract risk",
  "SaucerSwap data",
  "Bonzo data",
] as const;

export interface YieldRiskObserved {
  account: {
    accountId: string;
    exists: boolean;
    deleted: boolean;
    createdTimestamp: string | null;
  };
  balance: {
    tinybars: string;
    hbar: string;
    timestamp: string | null;
    tokenBalancesCount: number;
  };
  recent30d: {
    transactionCount: number;
    hbarInTinybars: string;
    hbarOutTinybars: string;
    latestTimestamp: string | null;
  };
}

export interface YieldRiskAnalysisSuccess {
  status: "success";
  service: typeof SERVICE_NAME;
  request: YieldRiskContract;
  analysis: {
    scope: typeof ANALYSIS_SCOPE;
    source: typeof ANALYSIS_SOURCE;
    network: string;
    dataTimestamp: string | null;
    freshnessHealth: "fresh" | "stale" | "unknown";
    freshness: {
      balanceTimestamp: string | null;
      latestActivityTimestamp: string | null;
      ageSeconds: number | null;
      staleAfterSeconds: number;
    };
    observed: YieldRiskObserved;
    derivedMetrics: {
      net30dTinybars: string;
    };
    unavailable: readonly string[];
    limitations: readonly string[];
  };
  payment: {
    protocol: typeof X402_PROTOCOL;
    version: 2;
    network: string;
    asset: typeof DEFAULT_ASSET;
    amountTinybars: string;
  };
  disclaimer: typeof DISCLAIMER;
}

export interface YieldRiskAnalysisDegraded {
  status: "success";
  service: typeof SERVICE_NAME;
  request: YieldRiskContract;
  analysis: {
    scope: typeof ANALYSIS_SCOPE;
    source: typeof ANALYSIS_SOURCE;
    network: string;
    dataTimestamp: null;
    dataUnavailable: true;
    indications: {
      accountNotReadable: boolean;
      reason: string;
    };
    unavailable: readonly string[];
    limitations: readonly string[];
  };
  payment: {
    protocol: typeof X402_PROTOCOL;
    version: 2;
    network: string;
    asset: typeof DEFAULT_ASSET;
    amountTinybars: string;
  };
  disclaimer: typeof DISCLAIMER;
}

export interface YieldRiskInvalidRequest {
  status: "error";
  code: "invalid_request_contract";
  message: string;
  issues: readonly string[];
}

export type YieldRiskAnalysisResponse =
  | YieldRiskAnalysisSuccess
  | YieldRiskAnalysisDegraded
  | YieldRiskInvalidRequest;

function paymentBlock(network: string): YieldRiskAnalysisSuccess["payment"] {
  return {
    protocol: X402_PROTOCOL,
    version: 2 as const,
    network,
    asset: DEFAULT_ASSET,
    amountTinybars: String(DEFAULT_PRICE_TINYBARS),
  };
}

export function formatHbarFromTinybars(totalTinybars: bigint): string {
  const perHbar = BigInt(TINYBARS_PER_HBAR);
  const whole = totalTinybars / perHbar;
  const remainder = totalTinybars % perHbar;
  if (remainder === 0n) return whole.toString();
  const fractional = String(Number(remainder) / TINYBARS_PER_HBAR)
    .slice(2)
    .padEnd(8, "0")
    .replace(/0+$/, "");
  return `${whole}.${fractional}`;
}

/** Newest of two `seconds.nanoseconds` mirror timestamps (or null). */
function newestTimestamp(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

function freshnessOf(
  balanceTimestamp: string | null,
  latestActivityTimestamp: string | null,
  nowSeconds: number,
  staleAfterSeconds: number,
): { dataTimestamp: string | null; health: "fresh" | "stale" | "unknown"; ageSeconds: number | null } {
  const dataTimestamp = newestTimestamp(balanceTimestamp, latestActivityTimestamp);
  if (dataTimestamp === null) {
    return { dataTimestamp: null, health: "unknown", ageSeconds: null };
  }
  const [secText] = dataTimestamp.split(".");
  const sec = Number(secText);
  if (!Number.isFinite(sec)) {
    return { dataTimestamp, health: "unknown", ageSeconds: null };
  }
  const ageSeconds = Math.max(0, nowSeconds - sec);
  return {
    dataTimestamp,
    health: ageSeconds > staleAfterSeconds ? "stale" : "fresh",
    ageSeconds,
  };
}

function observedFromRead(read: MirrorAccountRead): YieldRiskObserved {
  const { accountState, recentActivity } = read;
  return {
    account: {
      accountId: accountState.account,
      exists: accountState.exists,
      deleted: accountState.deleted,
      createdTimestamp: accountState.createdTimestamp,
    },
    balance: {
      tinybars: String(accountState.balanceTinybars),
      hbar: formatHbarFromTinybars(accountState.balanceTinybars),
      timestamp: accountState.balanceTimestamp,
      tokenBalancesCount: accountState.tokenBalancesCount,
    },
    recent30d: {
      transactionCount: recentActivity.transactions30d,
      hbarInTinybars: String(recentActivity.hbarInTinybars),
      hbarOutTinybars: String(recentActivity.hbarOutTinybars),
      latestTimestamp: recentActivity.latestConsensusTimestamp,
    },
  };
}

/** Builds the honest analysis response for a healthy mirror read. */
export function analyzeMirrorRead(
  read: MirrorAccountRead,
  request: YieldRiskContract,
  network: string = DEFAULT_NETWORK,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  staleAfterSeconds: number = DEFAULT_STALE_AFTER_SECONDS,
): YieldRiskAnalysisSuccess {
  const observed = observedFromRead(read);
  const freshness = freshnessOf(
    observed.balance.timestamp,
    observed.recent30d.latestTimestamp,
    nowSeconds,
    staleAfterSeconds,
  );

  return {
    status: "success",
    service: SERVICE_NAME,
    request,
    analysis: {
      scope: ANALYSIS_SCOPE,
      source: ANALYSIS_SOURCE,
      network,
      dataTimestamp: freshness.dataTimestamp,
      freshnessHealth: freshness.health,
      freshness: {
        balanceTimestamp: observed.balance.timestamp,
        latestActivityTimestamp: observed.recent30d.latestTimestamp,
        ageSeconds: freshness.ageSeconds,
        staleAfterSeconds,
      },
      observed,
      derivedMetrics: {
        net30dTinybars: String(
          read.recentActivity.hbarInTinybars - read.recentActivity.hbarOutTinybars,
        ),
      },
      unavailable: [...UNVAILABLE_FEATURES],
      limitations: [...ANALYSIS_LIMITATIONS],
    },
    payment: paymentBlock(network),
    disclaimer: DISCLAIMER,
  };
}

/** Degraded-but-honest response when mirror data cannot be read. */
export function analyzeDegraded(
  account: string,
  error: unknown,
  request: YieldRiskContract,
  network: string = DEFAULT_NETWORK,
): YieldRiskAnalysisDegraded {
  const reason =
    error instanceof MirrorReadError
      ? `mirror read failed (${error.code})`
      : `mirror read failed (${String(error)})`;
  return {
    status: "success",
    service: SERVICE_NAME,
    request,
    analysis: {
      scope: ANALYSIS_SCOPE,
      source: ANALYSIS_SOURCE,
      network,
      dataTimestamp: null,
      dataUnavailable: true,
      indications: { accountNotReadable: true, reason },
      unavailable: [...UNVAILABLE_FEATURES],
      limitations: [...ANALYSIS_LIMITATIONS],
    },
    payment: paymentBlock(network),
    disclaimer: DISCLAIMER,
  };
}

/** HTTP 400 body for a request that violates the shared contract. */
export function invalidYieldRiskContract(
  issues: readonly YieldRiskContractIssue[],
): YieldRiskInvalidRequest {
  return {
    status: "error",
    code: "invalid_request_contract",
    message: `Request does not satisfy the yield-risk contract: ${issues.join(", ")}`,
    issues: [...issues],
  };
}

export interface YieldRiskHandlerDeps {
  mirrorBaseUrl: string;
  fetchFn?: typeof fetch;
  network?: string;
  windowSeconds?: number;
  nowSeconds?: number;
  limit?: number;
  staleAfterSeconds?: number;
}

/**
 * Mountable Express handler for `POST /v1/strategy/yield-risk`.
 *
 * Runs AFTER the x402 payment middleware has verified+settled the request.
 * Validates the shared request contract first (400 on violation, before any
 * mirror read), then reads real Hedera Mirror Node data and returns a response
 * that explicitly bounds analysis to account-level on-chain risk.
 */
export function createYieldRiskHandler(deps: YieldRiskHandlerDeps) {
  const network = deps.network ?? DEFAULT_NETWORK;
  const staleAfterSeconds = deps.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const nowSeconds = deps.nowSeconds ?? Math.floor(Date.now() / 1000);

  return async function yieldRiskHandler(req: Request, res: Response): Promise<void> {
    const parsed = parseYieldRiskContract(req.body);
    if (!parsed.ok) {
      res.setHeader("Content-Type", "application/json");
      res.status(400).json(invalidYieldRiskContract(parsed.issues));
      return;
    }
    const request = parsed.contract;
    const account = request.accountId;

    try {
      const read = await readMirrorAccountSnapshot(account, deps.mirrorBaseUrl, {
        fetchFn: deps.fetchFn,
        windowSeconds: deps.windowSeconds,
        nowSeconds,
        limit: deps.limit,
      });
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(analyzeMirrorRead(read, request, network, nowSeconds, staleAfterSeconds));
    } catch (error) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(analyzeDegraded(account, error, request, network));
    }
  };
}
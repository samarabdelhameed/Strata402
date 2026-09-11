/**
 * Limited Mirror-Node-based account analysis for the paid `/v1/strategy/yield-risk`
 * endpoint.
 *
 * Honesty contract (approved scope):
 * - Only on-chain facts published by the Hedera Mirror Node are used.
 * - Protocol-specific claims (live pool APY, SaucerSwap/Bonzo liquidity, smart
 *   contract risk) are explicitly NOT made. Those appear in `unavailable`.
 * - Default analysis target is the service account (payTo) used as the x402
 *   payment recipient; an explicit `{ accountId }` body is honored.
 * - If mirror reads fail, the response degrades to `dataUnavailable: true`
 *   with neutral indications — never fabricated numbers, never 200-with-fake.
 */

import type { Request, Response } from "express";

import { DEFAULT_NETWORK, serviceAccountFromEnv } from "@strata402/x402-sdk";

import {
  MirrorReadError,
  readMirrorAccountSnapshot,
  type MirrorAccountRead,
} from "./mirror";

export const TINYBARS_PER_HBAR = 100_000_000n;

export const ANALYSIS_SOURCE = "hedera-mirror-node";
export const UNVAILABLE_FEATURES = [
  "live pool APY",
  "protocol liquidity",
  "smart-contract risk",
  "SaucerSwap data",
  "Bonzo data",
] as const;

export interface MirrorAnalysisIndicators {
  account: string;
  exists: boolean;
  deleted: boolean;
  createdTimestamp: string | null;
  balanceTinybars: string;
  balanceHbar: string;
  balanceTimestamp: string | null;
  tokenBalancesCount: number;
  recent30d: {
    transactions: number;
    hbarInTinybars: string;
    hbarOutTinybars: string;
    latestTimestamp: string | null;
  };
}

export interface MirrorAnalysisResult {
  status: "ok";
  analysisSource: typeof ANALYSIS_SOURCE;
  network: string;
  account: string;
  dataFreshness: {
    balanceTimestamp: string | null;
    latestActivityTimestamp: string | null;
  };
  scope: "account-level on-chain risk";
  protocolAdapters: never[];
  unavailable: readonly string[];
  indicators: MirrorAnalysisIndicators;
}

export interface MirrorAnalysisDegraded {
  status: "ok";
  analysisSource: typeof ANALYSIS_SOURCE;
  network: string;
  account: string;
  scope: "account-level on-chain risk";
  protocolAdapters: never[];
  unavailable: readonly string[];
  dataUnavailable: true;
  indications: {
    accountNotReadable: boolean;
    reason: string;
  };
  indicators: null;
}

export type MirrorAnalysisResponse = MirrorAnalysisResult | MirrorAnalysisDegraded;

export function formatHbarFromTinybars(totalTinybars: bigint): string {
  const whole = totalTinybars / TINYBARS_PER_HBAR;
  const remainder = totalTinybars % TINYBARS_PER_HBAR;
  return String(Number(whole) + Number(remainder) / Number(TINYBARS_PER_HBAR));
}

/** Derives the account to analyze: explicit body `accountId` else the service payTo account. */
export function resolveAnalysisAccount(
  body: unknown,
  serviceAccountId: string = serviceAccountFromEnv(),
): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    const requested = record.accountId;
    if (typeof requested === "string" && /^0\.0\.\d{1,19}$/.test(requested.trim())) {
      return requested.trim();
    }
  }
  return serviceAccountId;
}

/** Builds the honest analysis response for a healthy mirror read. */
export function analyzeMirrorRead(
  read: MirrorAccountRead,
  network: string = DEFAULT_NETWORK,
): MirrorAnalysisResult {
  const { accountState, recentActivity } = read;

  const indicators: MirrorAnalysisIndicators = {
    account: accountState.account,
    exists: accountState.exists,
    deleted: accountState.deleted,
    createdTimestamp: accountState.createdTimestamp,
    balanceTinybars: String(accountState.balanceTinybars),
    balanceHbar: formatHbarFromTinybars(accountState.balanceTinybars),
    balanceTimestamp: accountState.balanceTimestamp,
    tokenBalancesCount: accountState.tokenBalancesCount,
    recent30d: {
      transactions: recentActivity.transactions30d,
      hbarInTinybars: String(recentActivity.hbarInTinybars),
      hbarOutTinybars: String(recentActivity.hbarOutTinybars),
      latestTimestamp: recentActivity.latestConsensusTimestamp,
    },
  };

  return {
    status: "ok",
    analysisSource: ANALYSIS_SOURCE,
    network,
    account: accountState.account,
    dataFreshness: {
      balanceTimestamp: accountState.balanceTimestamp,
      latestActivityTimestamp: recentActivity.latestConsensusTimestamp,
    },
    scope: "account-level on-chain risk",
    protocolAdapters: [],
    unavailable: [...UNVAILABLE_FEATURES],
    indicators,
  };
}

/** Degraded-but-honest response when mirror data cannot be read. */
export function analyzeDegraded(account: string, error: unknown, network: string = DEFAULT_NETWORK): MirrorAnalysisDegraded {
  const reason =
    error instanceof MirrorReadError
      ? `mirror read failed (${error.code})`
      : `mirror read failed (${String(error)})`;
  return {
    status: "ok",
    analysisSource: ANALYSIS_SOURCE,
    network,
    account,
    scope: "account-level on-chain risk",
    protocolAdapters: [],
    unavailable: [...UNVAILABLE_FEATURES],
    dataUnavailable: true,
    indications: { accountNotReadable: true, reason },
    indicators: null,
  };
}

export interface YieldRiskHandlerDeps {
  mirrorBaseUrl: string;
  serviceAccountId?: string;
  fetchFn?: typeof fetch;
  network?: string;
  windowSeconds?: number;
  nowSeconds?: number;
  limit?: number;
}

/**
 * Mountable Express handler for `POST /v1/strategy/yield-risk`.
 *
 * Runs AFTER the x402 payment middleware has verified+settled the request.
 * Reads real Hedera Mirror Node data, returns a 200 response that explicitly
 * bounds analysis to account-level on-chain risk.
 */
export function createYieldRiskHandler(deps: YieldRiskHandlerDeps) {
  const serviceAccountId = deps.serviceAccountId ?? serviceAccountFromEnv();
  const network = deps.network ?? DEFAULT_NETWORK;

  return async function yieldRiskHandler(req: Request, res: Response): Promise<void> {
    const account = resolveAnalysisAccount(req.body, serviceAccountId);

    try {
      const read = await readMirrorAccountSnapshot(account, deps.mirrorBaseUrl, {
        fetchFn: deps.fetchFn,
        windowSeconds: deps.windowSeconds,
        nowSeconds: deps.nowSeconds,
        limit: deps.limit,
      });
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(analyzeMirrorRead(read, network));
    } catch (error) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(analyzeDegraded(account, error, network));
    }
  };
}
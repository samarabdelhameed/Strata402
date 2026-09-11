import {
  DEFAULT_RISK_TOLERANCE,
  parseYieldRiskContract,
  type RiskTolerance,
} from "@strata402/x402-sdk";
import type { EnvLike } from "./config";

/**
 * Phase 7A — consume the hardened `/v1/strategy/yield-risk` request contract.
 *
 * The gateway rejects bodies that do not satisfy
 * `{ accountId, riskTolerance, amountHbar }` (HTTP 400). This builder lets the
 * agent validate the same contract BEFORE any priced request is sent, so a
 * malformed body never reaches the payment wall (fail closed, no spend).
 *
 * Defaults (env-driven, never secrets):
 * - `accountId`: the caller must provide it (for the approved flow this is the
 *   payTo service account, matching the proven run's semantics).
 * - `riskTolerance`: `STRATA402_RISK_TOLERANCE` or `balanced`.
 * - `amountHbar`: `STRATA402_ANALYSIS_AMOUNT_HBAR` or `1` (analysis input only;
 *   the gateway performs no financial math on it).
 */

export const ENV_RISK_TOLERANCE = "STRATA402_RISK_TOLERANCE";
export const ENV_ANALYSIS_AMOUNT_HBAR = "STRATA402_ANALYSIS_AMOUNT_HBAR";
export const DEFAULT_ANALYSIS_AMOUNT_HBAR = 1;

export class YieldRiskRequestError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid yield-risk request contract: ${issues.join(", ")}`);
    this.name = "YieldRiskRequestError";
    this.issues = issues;
  }
}

export interface YieldRiskRequestBodyOptions {
  accountId: string;
  riskTolerance?: string;
  amountHbar?: number;
  env?: EnvLike;
}

function resolveRiskToleranceValue(env: EnvLike): string {
  const raw = env[ENV_RISK_TOLERANCE]?.trim();
  return raw === undefined || raw === "" ? DEFAULT_RISK_TOLERANCE : raw;
}

function resolveAmountHbarValue(env: EnvLike): number {
  const raw = env[ENV_ANALYSIS_AMOUNT_HBAR]?.trim();
  if (raw === undefined || raw === "") return DEFAULT_ANALYSIS_AMOUNT_HBAR;
  const value = Number(raw);
  return Number.isFinite(value) ? value : DEFAULT_ANALYSIS_AMOUNT_HBAR;
}

export function buildYieldRiskRequestBody(
  options: YieldRiskRequestBodyOptions,
): string {
  const env = options.env ?? process.env;
  const candidate = {
    accountId: options.accountId,
    riskTolerance: options.riskTolerance ?? resolveRiskToleranceValue(env),
    amountHbar: options.amountHbar ?? resolveAmountHbarValue(env),
  };
  const parsed = parseYieldRiskContract(candidate);
  if (!parsed.ok) {
    throw new YieldRiskRequestError(parsed.issues);
  }
  return JSON.stringify(parsed.contract);
}

export function supportedRiskTolerance(env: EnvLike = process.env): RiskTolerance {
  const parsed = parseYieldRiskContract({
    accountId: "0.0.1",
    riskTolerance: resolveRiskToleranceValue(env),
    amountHbar: DEFAULT_ANALYSIS_AMOUNT_HBAR,
  });
  if (!parsed.ok) {
    throw new YieldRiskRequestError(parsed.issues);
  }
  return parsed.contract.riskTolerance;
}
/**
 * Strata402 — `/v1/strategy/yield-risk` request contract.
 *
 * The paid yield-risk endpoint accepts a strict request body:
 *   { "accountId": "0.0.xxxxx", "riskTolerance": "conservative", "amountHbar": 100 }
 *
 * Only validation lives here — no financial math and no trading logic.
 * The rule set is shared by the gateway (server-side rejection) and the
 * consuming agent (fail-closed pre-send validation) so one authority
 * defines the contract and both sides behave identically.
 */

export const RISK_TOLERANCE_VALUES = ["conservative", "balanced", "aggressive"] as const;
export type RiskTolerance = (typeof RISK_TOLERANCE_VALUES)[number];

export const DEFAULT_RISK_TOLERANCE: RiskTolerance = "balanced";

export const ACCOUNT_ID_PATTERN = /^0\.0\.\d{1,19}$/;
export const ASSET_ID = "0.0.0";
export const TINYBARS_PER_HBAR = 100_000_000;

/** Upper bound for `amountHbar` — an analysis input, never a price or a trade. */
export const MAX_ANALYSIS_AMOUNT_HBAR = 1_000_000;

export const DISCLAIMER =
  "This information is not financial advice. Strata402 reports account-level on-chain facts " +
  "as published by the Hedera Mirror Node and does not provide investment advice, price " +
  "predictions, yield guarantees, or any promise of return.";

export const ANALYSIS_LIMITATIONS = [
  "No protocol-specific APY data",
  "No SaucerSwap adapter",
  "No Bonzo adapter",
  "No automatic fund movement",
] as const;

export type YieldRiskContractIssue =
  | "invalid_request_body"
  | "missing_accountId"
  | "invalid_accountId"
  | "missing_riskTolerance"
  | "unsupported_riskTolerance"
  | "non_numeric_amountHbar"
  | "non_finite_amountHbar"
  | "non_positive_amountHbar"
  | "unsafe_precision_amountHbar"
  | "amountHbar_too_large";

export interface YieldRiskContract {
  accountId: string;
  riskTolerance: RiskTolerance;
  amountHbar: number;
}

export type YieldRiskParseResult =
  | { ok: true; contract: YieldRiskContract }
  | { ok: false; issues: YieldRiskContractIssue[] };

export function isRiskTolerance(value: unknown): value is RiskTolerance {
  return (
    typeof value === "string" &&
    (RISK_TOLERANCE_VALUES as readonly string[]).includes(value)
  );
}

export function parseYieldRiskContract(input: unknown): YieldRiskParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: ["invalid_request_body"] };
  }
  const record = input as Record<string, unknown>;
  const issues: YieldRiskContractIssue[] = [];

  const rawAccountId = record.accountId;
  if (typeof rawAccountId !== "string" || rawAccountId.trim() === "") {
    issues.push("missing_accountId");
  } else {
    const accountId = rawAccountId.trim();
    if (accountId === ASSET_ID || !ACCOUNT_ID_PATTERN.test(accountId)) {
      issues.push("invalid_accountId");
    }
  }

  const rawRisk = record.riskTolerance;
  if (typeof rawRisk !== "string" || rawRisk.trim() === "") {
    issues.push("missing_riskTolerance");
  } else if (!isRiskTolerance(rawRisk.trim())) {
    issues.push("unsupported_riskTolerance");
  }

  const rawAmount = record.amountHbar;
  if (typeof rawAmount !== "number") {
    issues.push("non_numeric_amountHbar");
  } else if (!Number.isFinite(rawAmount)) {
    issues.push("non_finite_amountHbar");
  } else if (rawAmount <= 0) {
    issues.push("non_positive_amountHbar");
  } else if (rawAmount > MAX_ANALYSIS_AMOUNT_HBAR) {
    issues.push("amountHbar_too_large");
  } else {
    const scaled = rawAmount * TINYBARS_PER_HBAR;
    const rounded = Math.round(scaled);
    const precisionLoss = Math.abs(scaled - rounded);
    if (!Number.isFinite(scaled) || rounded <= 0 || precisionLoss > 1e-6) {
      issues.push("unsafe_precision_amountHbar");
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    contract: {
      accountId: String(record.accountId).trim(),
      riskTolerance: String(record.riskTolerance).trim() as RiskTolerance,
      amountHbar: rawAmount as number,
    },
  };
}
import { ALLOWED_ASSET, ALLOWED_NETWORK } from "./types";

export const ENV_NETWORK = "STRATA402_NETWORK";
export const ENV_MAX_PER_REQUEST = "STRATA402_MAX_PER_REQUEST_TINYBARS";
export const ENV_MAX_TOTAL_BUDGET = "STRATA402_MAX_TOTAL_BUDGET_TINYBARS";
export const ENV_PAYER_ACCOUNT_ID = "STRATA402_PAYER_ACCOUNT_ID";

export const DEFAULT_NETWORK = ALLOWED_NETWORK;
export const DEFAULT_MAX_PER_REQUEST_TINYBARS = 1_000_000;
export const DEFAULT_MAX_TOTAL_BUDGET_TINYBARS = 100_000_000;
export const MAX_SUPPORTED_PER_REQUEST_TINYBARS = 10_000_000;
export const MAX_SUPPORTED_TOTAL_BUDGET_TINYBARS = 100_000_000;

export type SafetyConfigErrorCode =
  | "NETWORK"
  | "PAYER_REQUIRED"
  | "INVALID_ACCOUNT"
  | "INVALID_CAP"
  | "CAP_TOO_LARGE"
  | "CAP_EXCEEDS_BUDGET";

export class SafetyConfigError extends Error {
  readonly code: SafetyConfigErrorCode;

  constructor(code: SafetyConfigErrorCode, message: string) {
    super(message);
    this.name = "SafetyConfigError";
    this.code = code;
  }
}

export interface SafetyConfig {
  network: string;
  maxPerRequestTinybars: number;
  maxTotalBudgetTinybars: number;
  payerAccountId: string | null;
}

export type EnvLike = Record<string, string | undefined>;

export interface LoadConfigOptions {
  env?: EnvLike;
  requirePayer?: boolean;
}

const ACCOUNT_ID_PATTERN = /^\d{1,20}\.\d{1,20}\.\d{1,20}$/;

function parseCap(
  env: EnvLike,
  key: string,
  fallback: number,
  name: string,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new SafetyConfigError("INVALID_CAP", `${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(options: LoadConfigOptions = {}): SafetyConfig {
  const env = options.env ?? process.env;

  const rawNetwork = env[ENV_NETWORK]?.trim();
  const network = rawNetwork === undefined || rawNetwork === "" ? DEFAULT_NETWORK : rawNetwork;
  if (network !== ALLOWED_NETWORK) {
    throw new SafetyConfigError(
      "NETWORK",
      `Only ${ALLOWED_NETWORK} is allowed (testnet-only guard), got ${String(network)}`,
    );
  }

  const maxPerRequestTinybars = parseCap(
    env,
    ENV_MAX_PER_REQUEST,
    DEFAULT_MAX_PER_REQUEST_TINYBARS,
    ENV_MAX_PER_REQUEST,
  );
  const maxTotalBudgetTinybars = parseCap(
    env,
    ENV_MAX_TOTAL_BUDGET,
    DEFAULT_MAX_TOTAL_BUDGET_TINYBARS,
    ENV_MAX_TOTAL_BUDGET,
  );

  if (maxPerRequestTinybars > MAX_SUPPORTED_PER_REQUEST_TINYBARS) {
    throw new SafetyConfigError(
      "CAP_TOO_LARGE",
      `${ENV_MAX_PER_REQUEST} must not exceed ${MAX_SUPPORTED_PER_REQUEST_TINYBARS}`,
    );
  }
  if (maxTotalBudgetTinybars > MAX_SUPPORTED_TOTAL_BUDGET_TINYBARS) {
    throw new SafetyConfigError(
      "CAP_TOO_LARGE",
      `${ENV_MAX_TOTAL_BUDGET} must not exceed ${MAX_SUPPORTED_TOTAL_BUDGET_TINYBARS}`,
    );
  }
  if (maxPerRequestTinybars > maxTotalBudgetTinybars) {
    throw new SafetyConfigError(
      "CAP_EXCEEDS_BUDGET",
      `${ENV_MAX_PER_REQUEST} must not exceed ${ENV_MAX_TOTAL_BUDGET}`,
    );
  }

  const rawPayer = env[ENV_PAYER_ACCOUNT_ID]?.trim();
  const payerAccountId = rawPayer === undefined || rawPayer === "" ? null : rawPayer;

  if (options.requirePayer === true && payerAccountId === null) {
    throw new SafetyConfigError(
      "PAYER_REQUIRED",
      `${ENV_PAYER_ACCOUNT_ID} is required in payer-readiness mode`,
    );
  }

  if (payerAccountId !== null) {
    if (!ACCOUNT_ID_PATTERN.test(payerAccountId) || payerAccountId === ALLOWED_ASSET) {
      throw new SafetyConfigError(
        "INVALID_ACCOUNT",
        `Invalid Hedera account id: ${payerAccountId}`,
      );
    }
  }

  return { network, maxPerRequestTinybars, maxTotalBudgetTinybars, payerAccountId };
}
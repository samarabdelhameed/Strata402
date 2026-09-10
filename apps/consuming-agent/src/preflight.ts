import { discoverApprovedService } from "./discover";
import { requestUnpaidChallenge } from "./challenge";
import { fetchFacilitatorSupported } from "./facilitator";
import { fetchPayerAccount } from "./payer-mirror";
import { loadConfig, type EnvLike, type SafetyConfig } from "./config";
import { SpendLedger } from "./spend-ledger";
import { DEFAULT_SERVICE_URL, ENV_SERVICE_URL } from "./types";

/**
 * Phase 4.4-C0 — Controlled Live x402 Payment Preflight.
 *
 * Verifies the real chain WITHOUT spending anything: discovery, the unpaid
 * 402 challenge, facilitator `/supported` (read-only), mirror-node payer
 * readability, and payTo certification. It never builds a payload, never uses
 * the payer private key, never sends a PAYMENT-SIGNATURE, and never calls
 * verify/settle or submits any Hedera transaction.
 *
 * Gate (approved): all steps must pass before C1 can be considered. The payer
 * balance, when readable, is a preflight check only — never approval to pay.
 */

export const ENV_FACILITATOR_URL = "X402_FACILITATOR_URL";
export const ENV_MIRROR_BASE_URL = "STRATA402_MIRROR_BASE_URL";
export const ENV_ALLOWED_PAYTO = "STRATA402_ALLOWED_PAYTO";
export const ENV_RUN_C0 = "STRATA402_RUN_C0";

export const PLACEHOLDER_PAYTO = "0.0.1234";

export type PreflightErrorCode =
  | "CONFIG"
  | "PAYTO_MISMATCH"
  | "PAYTO_PLACEHOLDER"
  | "PAYTO_NOT_CERTIFIED"
  | "FACILITATOR_URL_MISSING"
  | "MIRROR_URL_MISSING"
  | "BUDGET";

export class PreflightError extends Error {
  readonly code: PreflightErrorCode;

  constructor(code: PreflightErrorCode, message: string) {
    super(message);
    this.name = "PreflightError";
    this.code = code;
  }
}

export type PreflightFetch = typeof fetch;

export interface PreflightOptions {
  serviceUrl?: string;
  facilitatorUrl?: string;
  mirrorBaseUrl?: string;
  allowedPayTos?: readonly string[];
  env?: EnvLike;
  fetchFn?: PreflightFetch;
}

export interface PreflightReport {
  phase: "C0-preflight";
  status: "ok";
  network: string;
  payerAccountId: string;
  payerExists: boolean;
  payerBalanceTinybars: string;
  serviceId: string;
  priceTinybars: number;
  payTo: string;
  payToCertified: boolean;
  facilitatorUrl: string;
  facilitatorKindMatched: boolean;
  budgetRemainingTinybars: string;
  traffic: {
    signaturesSent: 0;
    verifyCalls: 0;
    settleCalls: 0;
    spendHbar: 0;
  };
}

export function parseAllowedPayTos(env: EnvLike = process.env): string[] {
  const raw = env[ENV_ALLOWED_PAYTO];
  if (raw === undefined || raw.trim() === "") {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightReport> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn;

  let config: SafetyConfig;
  try {
    config = loadConfig({ env, requirePayer: true });
  } catch (error) {
    throw new PreflightError(
      "CONFIG",
      `Preflight config rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Fail-closed configuration gates: every required explicit value is checked
  // BEFORE any network request. There is no silent fallback for any of these.
  const facilitatorUrl = (options.facilitatorUrl ?? env[ENV_FACILITATOR_URL]?.trim()) ?? "";
  if (facilitatorUrl === "") {
    throw new PreflightError(
      "FACILITATOR_URL_MISSING",
      `${ENV_FACILITATOR_URL} is required for C0 preflight (read-only /supported)`,
    );
  }

  const mirrorBaseUrl = (options.mirrorBaseUrl ?? env[ENV_MIRROR_BASE_URL]?.trim()) ?? "";
  if (mirrorBaseUrl === "") {
    throw new PreflightError(
      "MIRROR_URL_MISSING",
      `${ENV_MIRROR_BASE_URL} is required for C0 preflight (read-only payer check)`,
    );
  }

  const allowedPayTos = options.allowedPayTos ?? parseAllowedPayTos(env);
  if (allowedPayTos.length === 0) {
    throw new PreflightError(
      "PAYTO_NOT_CERTIFIED",
      `${ENV_ALLOWED_PAYTO} allow-list is empty; no certified service account is available for preflight`,
    );
  }

  if (config.payerAccountId === null) {
    throw new PreflightError("CONFIG", "Payer account is required for C0 preflight");
  }

  const serviceUrl = (options.serviceUrl ?? env[ENV_SERVICE_URL]?.trim()) || DEFAULT_SERVICE_URL;

  const offer = await discoverApprovedService(serviceUrl, fetchFn);
  const unpaid = await requestUnpaidChallenge(serviceUrl, fetchFn);
  const challenge = unpaid.challenge;

  if (challenge.payTo !== offer.payTo) {
    throw new PreflightError(
      "PAYTO_MISMATCH",
      `payTo from 402 challenge (${challenge.payTo}) does not match service catalog (${offer.payTo})`,
    );
  }

  const payTo = offer.payTo;
  if (payTo === PLACEHOLDER_PAYTO) {
    throw new PreflightError(
      "PAYTO_PLACEHOLDER",
      `payTo ${payTo} is the default placeholder account, not a certified service account`,
    );
  }

  if (!allowedPayTos.includes(payTo)) {
    throw new PreflightError(
      "PAYTO_NOT_CERTIFIED",
      `payTo ${payTo} is not in the certified allow-list (${ENV_ALLOWED_PAYTO})`,
    );
  }

  const facilitator = await fetchFacilitatorSupported(facilitatorUrl, fetchFn);
  const payer = await fetchPayerAccount(config.payerAccountId, mirrorBaseUrl, fetchFn);

  const ledger = new SpendLedger(config.maxTotalBudgetTinybars);
  if (ledger.remainingTinybars() < BigInt(offer.service.priceTinybars)) {
    throw new PreflightError(
      "BUDGET",
      "Total budget is below the approved per-request price; C0 cannot pass",
    );
  }

  return {
    phase: "C0-preflight",
    status: "ok",
    network: config.network,
    payerAccountId: config.payerAccountId,
    payerExists: payer.exists,
    payerBalanceTinybars: payer.balanceTinybars.toString(),
    serviceId: offer.service.id,
    priceTinybars: offer.service.priceTinybars,
    payTo,
    payToCertified: true,
    facilitatorUrl,
    facilitatorKindMatched: true,
    budgetRemainingTinybars: ledger.remainingTinybars().toString(),
    traffic: { signaturesSent: 0, verifyCalls: 0, settleCalls: 0, spendHbar: 0 },
  };
}
import type { PaymentRequirements } from "@x402/core/types";
import { CHALLENGE_SCHEME, X402_VERSION } from "./challenge";
import type { ValidatedChallenge } from "./challenge";
import { ALLOWED_NETWORK } from "./types";
import {
  DEFAULT_MAX_PER_REQUEST_TINYBARS,
  DEFAULT_MAX_TOTAL_BUDGET_TINYBARS,
  loadConfig,
} from "./config";

/**
 * Phase 4.4-B0 — Payment Requirements API Binding.
 *
 * This module binds an already-validated challenge (see validateChallenge)
 * into the official x402 v2 PaymentRequirements shape and applies the approved
 * per-request spend cap. It does NOT create a payment payload, sign anything,
 * or touch the network. Actual payload construction arrives in a later
 * approved phase.
 *
 * Spend-safety scope (approved for B0):
 * - Enforced here: per-request cap (caps.maxPerRequestTinybars).
 * - Deferred safety control: cumulative total-budget enforcement
 *   (caps.maxTotalBudgetTinybars) is NOT enforced by a single binding; it will
 *   be enforced by a spend tracker once one exists. Until then it is config
 *   only, not a runtime guarantee of this module.
 */

export type PaymentRequirementsErrorCode =
  | "REQUIREMENTS_MISMATCH"
  | "AMOUNT"
  | "CAP_PER_REQUEST";

export class PaymentRequirementsError extends Error {
  readonly code: PaymentRequirementsErrorCode;

  constructor(code: PaymentRequirementsErrorCode, message: string) {
    super(message);
    this.name = "PaymentRequirementsError";
    this.code = code;
  }
}

export interface PaymentRequirementsBinding {
  x402Version: number;
  requirements: PaymentRequirements;
}

function tinybars(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new PaymentRequirementsError("AMOUNT", `Invalid tinybar amount: ${String(value)}`);
  }
  return parsed;
}

/**
 * Binds a validated challenge into the official x402 v2 PaymentRequirements
 * shape, enforcing the approved spend caps. No payload is created.
 */
export function bindPaymentRequirements(
  challenge: ValidatedChallenge,
): PaymentRequirementsBinding {
  if (challenge.x402Version !== X402_VERSION) {
    throw new PaymentRequirementsError(
      "REQUIREMENTS_MISMATCH",
      `Unsupported x402Version: ${String(challenge.x402Version)}`,
    );
  }

  const caps = loadConfig();
  const amountTinybars = tinybars(challenge.amount);

  if (amountTinybars > caps.maxPerRequestTinybars) {
    throw new PaymentRequirementsError(
      "CAP_PER_REQUEST",
      `Amount ${challenge.amount} tinybars exceeds per-request cap ${caps.maxPerRequestTinybars}`,
    );
  }

  return {
    x402Version: X402_VERSION,
    requirements: {
      scheme: CHALLENGE_SCHEME,
      network: challenge.network as typeof ALLOWED_NETWORK,
      asset: challenge.asset,
      amount: challenge.amount,
      payTo: challenge.payTo,
      maxTimeoutSeconds: challenge.maxTimeoutSeconds,
      extra: { feePayer: challenge.feePayer },
    },
  };
}

/**
 * Approved default caps, re-exported as a single reference for callers.
 */
export const BINDING_DEFAULT_MAX_PER_REQUEST_TINYBARS = DEFAULT_MAX_PER_REQUEST_TINYBARS;
export const BINDING_DEFAULT_MAX_TOTAL_BUDGET_TINYBARS = DEFAULT_MAX_TOTAL_BUDGET_TINYBARS;

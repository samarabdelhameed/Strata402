import type { PaymentPayload } from "@x402/core/types";
import { PrivateKey } from "@x402/hedera";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { CHALLENGE_SCHEME, X402_VERSION } from "./challenge";
import type { ValidatedChallenge } from "./challenge";
import { bindPaymentRequirements, type PaymentRequirementsBinding } from "./payment-payload";
import {
  ENV_PAYER_ACCOUNT_ID,
  SafetyConfigError,
  loadConfig,
  type EnvLike,
  type SafetyConfig,
} from "./config";

/**
 * Phase 4.4-B1 — Local Payment Payload Construction.
 *
 * Builds an x402 v2 exact-Hedera payment payload locally using the official
 * @x402/hedera SDK plus matched local payer credentials from `.env`.
 *
 * Scope (approved for B1):
 * - Uses the local `.env` payer credentials only.
 * - Uses createClientHederaSigner + ExactHederaScheme.createPaymentPayload.
 * - Uses the PaymentRequirements binding from B0 (enforces spend caps).
 * - Verified network is `hedera:testnet`.
 * - No HTTP, no Blocky402, no PAYMENT-SIGNATURE, no transaction submission,
 *   no Hedera network call (the SDK only freezes and signs locally).
 * - Never prints/returns the private key or the raw payload — this module
 *   returns a boolean-like construction report only.
 */

export const ENV_PAYER_PRIVATE_KEY = "STRATA402_PAYER_PRIVATE_KEY";

export type PayerKeyType = "ED25519" | "ECDSA_SECP256K1";

export type PaymentConstructorErrorCode =
  | "CREDENTIALS_MISSING"
  | "KEY_PARSE"
  | "PAYER_MISMATCH"
  | "CAP_PER_REQUEST"
  | "EMPTY_PAYLOAD"
  | "VERSION_MISMATCH"
  | "NETWORK";

export class PaymentConstructorError extends Error {
  readonly code: PaymentConstructorErrorCode;

  constructor(code: PaymentConstructorErrorCode, message: string) {
    super(message);
    this.name = "PaymentConstructorError";
    this.code = code;
  }
}

export interface PaymentPayloadConstructionInfo {
  created: true;
  x402Version: number;
  scheme: "exact";
  keyType: PayerKeyType;
  payerAccountId: string;
  payloadKeys: readonly string[];
}

export interface ConstructPaymentPayloadOptions {
  env?: EnvLike;
}

function parseTinybars(value: string): bigint {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new PaymentConstructorError("CAP_PER_REQUEST", `Invalid tinybar amount: ${String(value)}`);
  }
  return BigInt(parsed);
}

function keyTypeOf(key: PrivateKey): PayerKeyType {
  return key.type === "ED25519" ? "ED25519" : "ECDSA_SECP256K1";
}

function parsePayerPrivateKey(raw: string): { key: PrivateKey; keyType: PayerKeyType } {
  const value = raw.trim();
  if (value === "") {
    throw new PaymentConstructorError("CREDENTIALS_MISSING", `${ENV_PAYER_PRIVATE_KEY} is empty`);
  }
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;

  // DER-encoded keys are unambiguous (longer than a raw 32-byte key). Try them
  // first so a real local credential always resolves to its true type.
  if (hex.length > 66) {
    try {
      const key = PrivateKey.fromStringDer(hex);
      return { key, keyType: keyTypeOf(key) };
    } catch {
      // Fall through to the explicit raw parsers.
    }
  }

  // Raw 32-byte hex is ambiguous to the SDK (both "ECDSA" and "ED25519"
  // parsers accept it). Prefer the ECDSA parser, which matches the primary
  // testnet payer; for ED25519 credentials prefer DER encoding.
  try {
    const key = PrivateKey.fromStringECDSA(hex);
    return { key, keyType: keyTypeOf(key) };
  } catch {
    try {
      const key = PrivateKey.fromStringED25519(hex);
      return { key, keyType: keyTypeOf(key) };
    } catch {
      throw new PaymentConstructorError("KEY_PARSE", "Unable to parse payer private key");
    }
  }
}

/**
 * Phase 4.4-B1/B2 shared payer-signing context.
 *
 * Loads the matched `.env` payer credential, parses the key, and builds the
 * local Hedera signer plus the exact-Hedera client scheme. This is local-only
 * (no HTTP, no transaction submission) and is the single source for both the
 * B1 report and the B2 signed-payload consumer.
 */
export interface PayerSigningContext {
  config: SafetyConfig;
  scheme: ExactHederaScheme;
  keyType: PayerKeyType;
  payerAccountId: string;
}

/**
 * Builds the local payer signing context from `.env`. Never resolves a payload.
 */
export async function createPaymentSigning(
  options: ConstructPaymentPayloadOptions = {},
): Promise<PayerSigningContext> {
  const env = options.env ?? process.env;
  let config: SafetyConfig;
  try {
    config = loadConfig({ env, requirePayer: true });
  } catch (error) {
    if (error instanceof SafetyConfigError) {
      throw new PaymentConstructorError(
        "NETWORK",
        `Config rejected: ${error.message}`,
      );
    }
    throw error;
  }

  if (config.payerAccountId === null) {
    throw new PaymentConstructorError(
      "CREDENTIALS_MISSING",
      `${ENV_PAYER_ACCOUNT_ID} is required in payer-readiness mode`,
    );
  }

  const rawKey = env[ENV_PAYER_PRIVATE_KEY]?.trim() ?? "";
  if (rawKey === "") {
    throw new PaymentConstructorError(
      "CREDENTIALS_MISSING",
      `${ENV_PAYER_PRIVATE_KEY} is required to construct a payment payload`,
    );
  }

  const { key, keyType } = parsePayerPrivateKey(rawKey);

  const signer = createClientHederaSigner(config.payerAccountId, key, {
    network: config.network,
  });
  if (signer.accountId !== config.payerAccountId) {
    throw new PaymentConstructorError(
      "PAYER_MISMATCH",
      `Signer payer ${signer.accountId} does not match configured ${config.payerAccountId}`,
    );
  }

  const scheme = new ExactHederaScheme(signer);

  return {
    config,
    scheme,
    keyType,
    payerAccountId: signer.accountId,
  };
}

export interface SignedPaymentPayload {
  paymentPayload: PaymentPayload;
  info: PaymentPayloadConstructionInfo;
}

/**
 * Creates the signed payment payload in memory and returns both the official
 * x402 v2 `PaymentPayload` object (used by the B2 consumer to encode the
 * PAYMENT-SIGNATURE header) and a boolean-like construction report. The raw
 * payload and private key are never exposed by this module's public helpers.
 */
export async function createSignedPaymentPayload(
  challenge: ValidatedChallenge,
  options: ConstructPaymentPayloadOptions = {},
): Promise<SignedPaymentPayload> {
  const { config, scheme, keyType, payerAccountId } = await createPaymentSigning(options);

  const amountTinybars = parseTinybars(challenge.amount);
  if (amountTinybars > BigInt(config.maxPerRequestTinybars)) {
    throw new PaymentConstructorError(
      "CAP_PER_REQUEST",
      `Amount ${challenge.amount} tinybars exceeds per-request cap ${config.maxPerRequestTinybars}`,
    );
  }

  const binding: PaymentRequirementsBinding = bindPaymentRequirements(challenge);
  if (binding.requirements.scheme !== CHALLENGE_SCHEME) {
    throw new PaymentConstructorError(
      "PAYER_MISMATCH",
      `Unexpected payment scheme: ${String(binding.requirements.scheme)}`,
    );
  }

  const result = await scheme.createPaymentPayload(
    X402_VERSION,
    binding.requirements,
  );

  if (result.x402Version !== X402_VERSION) {
    throw new PaymentConstructorError(
      "VERSION_MISMATCH",
      `PaymentPayload returned x402Version ${String(result.x402Version)}, expected ${X402_VERSION}`,
    );
  }

  const payload = result.payload as Record<string, unknown>;
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 0) {
    throw new PaymentConstructorError("EMPTY_PAYLOAD", "PaymentPayload returned no keys");
  }
  if (typeof payload.transaction !== "string" || payload.transaction.length === 0) {
    throw new PaymentConstructorError(
      "EMPTY_PAYLOAD",
      "PaymentPayload.transaction is not a non-empty base64 string",
    );
  }

  const paymentPayload: PaymentPayload = {
    x402Version: result.x402Version,
    accepted: binding.requirements,
    payload,
  };

  return {
    paymentPayload,
    info: {
      created: true,
      x402Version: result.x402Version,
      scheme: CHALLENGE_SCHEME,
      keyType,
      payerAccountId,
      payloadKeys,
    },
  };
}

/**
 * Constructs a local x402 v2 exact-Hedera payment payload and returns a
 * boolean-like construction report. The raw payload and private key are
 * never exposed by this function.
 */
export async function constructPaymentPayload(
  challenge: ValidatedChallenge,
  options: ConstructPaymentPayloadOptions = {},
): Promise<PaymentPayloadConstructionInfo> {
  const { info } = await createSignedPaymentPayload(challenge, options);
  return info;
}

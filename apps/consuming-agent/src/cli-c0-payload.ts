import { encodePaymentSignatureHeader } from "@x402/core/http";
import { requestUnpaidChallenge, type ValidatedChallenge } from "./challenge";
import { createSignedPaymentPayload } from "./payment-constructor";
import { SafetyConfigError, loadConfig, type EnvLike } from "./config";
import { ENV_SERVICE_URL, ALLOWED_NETWORK, APPROVED_ROUTE, DEFAULT_SERVICE_URL } from "./types";

/**
 * Phase 4.4-C0-PAYLOAD — Construct PaymentPayload and PAYMENT-SIGNATURE in
 * memory only (no send).
 *
 * Performs the single approved read-only 402 challenge from the real Gateway,
 * then builds the signed x402 v2 exact-Hedera payment payload and encodes the
 * PAYMENT-SIGNATURE header entirely in memory. Nothing is transmitted: no paid
 * request, no PAYMENT-SIGNATURE, no verify, no settle, no Blocky402 call, no
 * Hedera transaction, no provider key read, and nothing is written to disk or
 * printed (payload, header, or key).
 *
 * Closed by default: unless `STRATA402_RUN_C0_PAYLOAD=true` the CLI prints a
 * closed message and exits 0 without touching the network. The online count is
 * exactly one network call: the unpaid POST that yields the 402.
 *
 * Exit codes:
 * - 0: payload constructed in memory (or CLI is closed — nothing attempted).
 * - 1: an approved construction step failed.
 * - 2: misconfiguration (invalid config, or the required payer account is missing).
 */

export const ENV_RUN_C0_PAYLOAD = "STRATA402_RUN_C0_PAYLOAD";
export const ENV_ALLOWED_PAYTO = "STRATA402_ALLOWED_PAYTO";
export const PLACEHOLDER_PAYTO = "0.0.1234";
export const ALLOWED_SCHEME = "exact";
export const ALLOWED_AMOUNT_TINYBARS = "1000000";

export const EXIT_OK = 0;
export const EXIT_PAYLOAD_FAILED = 1;
export const EXIT_MISCONFIG = 2;

export type C0PayloadErrorCode =
  | "CLOSED_REQUIRED"
  | "CONFIG"
  | "CHALLENGE"
  | "PAYTO_PLACEHOLDER"
  | "PAYTO_NOT_CERTIFIED"
  | "NETWORK_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "SCHEME_MISMATCH";

export class C0PayloadError extends Error {
  readonly code: C0PayloadErrorCode;

  constructor(code: C0PayloadErrorCode, message: string) {
    super(message);
    this.name = "C0PayloadError";
    this.code = code;
  }
}

export interface C0PayloadOptions {
  serviceUrl?: string;
  allowedPayTos?: readonly string[];
  env?: EnvLike;
  fetchFn?: typeof fetch;
}

export interface C0PayloadReport {
  phase: "C0-payload";
  status: "ok";
  created: true;
  x402Version: number;
  scheme: string;
  keyType: "ED25519" | "ECDSA_SECP256K1";
  payerAccountId: string;
  headerBytes: number;
  noSend: true;
}

export function isC0PayloadEnabled(env: EnvLike = process.env): boolean {
  return env[ENV_RUN_C0_PAYLOAD] === "true";
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

/**
 * Single approved construction step. Returns only safe metadata: never the
 * raw payload, the encoded header, or any credential.
 */
export async function runC0Payload(options: C0PayloadOptions = {}): Promise<C0PayloadReport> {
  const env = options.env ?? process.env;

  if (!isC0PayloadEnabled(env)) {
    throw new C0PayloadError(
      "CLOSED_REQUIRED",
      `${ENV_RUN_C0_PAYLOAD} must be "true" to run the in-memory payload construction`,
    );
  }

  let config;
  try {
    config = loadConfig({ env, requirePayer: true });
  } catch (error) {
    throw new C0PayloadError(
      "CONFIG",
      `Payload config rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (config.payerAccountId === null) {
    throw new C0PayloadError("CONFIG", "Payer account is required for payload construction");
  }

  const allowedPayTos = options.allowedPayTos ?? parseAllowedPayTos(env);

  const serviceUrl = (options.serviceUrl ?? env[ENV_SERVICE_URL]?.trim()) || DEFAULT_SERVICE_URL;

  const unpaid = await requestUnpaidChallenge(serviceUrl, options.fetchFn);
  const challenge: ValidatedChallenge = unpaid.challenge;

  if (challenge.scheme !== ALLOWED_SCHEME) {
    throw new C0PayloadError("SCHEME_MISMATCH", `Unexpected scheme: ${String(challenge.scheme)}`);
  }
  if (challenge.network !== ALLOWED_NETWORK) {
    throw new C0PayloadError(
      "NETWORK_MISMATCH",
      `Unexpected network: ${String(challenge.network)}`,
    );
  }
  if (challenge.amount !== ALLOWED_AMOUNT_TINYBARS) {
    throw new C0PayloadError(
      "AMOUNT_MISMATCH",
      `Unexpected amount: ${String(challenge.amount)}`,
    );
  }
  if (challenge.payTo === PLACEHOLDER_PAYTO) {
    throw new C0PayloadError(
      "PAYTO_PLACEHOLDER",
      `payTo ${challenge.payTo} is the default placeholder account, not a certified service account`,
    );
  }
  if (allowedPayTos.length > 0 && !allowedPayTos.includes(challenge.payTo)) {
    throw new C0PayloadError(
      "PAYTO_NOT_CERTIFIED",
      `payTo ${challenge.payTo} is not in the certified allow-list`,
    );
  }

  const signed = await createSignedPaymentPayload(challenge, { env });

  const encodedHeader = encodePaymentSignatureHeader(signed.paymentPayload);
  const headerBytes = new TextEncoder().encode(encodedHeader).length;

  return {
    phase: "C0-payload",
    status: "ok",
    created: true,
    x402Version: signed.info.x402Version,
    scheme: signed.info.scheme,
    keyType: signed.info.keyType,
    payerAccountId: signed.info.payerAccountId,
    headerBytes,
    noSend: true,
  };
}

export function isMisconfig(error: unknown): boolean {
  if (error instanceof C0PayloadError) {
    return error.code === "CONFIG" || error.code === "CLOSED_REQUIRED";
  }
  return error instanceof SafetyConfigError;
}

export async function runCliC0Payload(env: EnvLike = process.env): Promise<number> {
  if (!isC0PayloadEnabled(env)) {
    console.log(
      `C0-payload is closed by default. Set ${ENV_RUN_C0_PAYLOAD}=true to construct the payload in memory (no send).`,
    );
    return EXIT_OK;
  }

  try {
    const report = await runC0Payload({ env });
    console.log(JSON.stringify(report, null, 2));
    return EXIT_OK;
  } catch (error) {
    const exitCode = isMisconfig(error) ? EXIT_MISCONFIG : EXIT_PAYLOAD_FAILED;
    const name = error instanceof Error ? error.name : "UnknownError";
    const code = error instanceof Error ? ((error as { code?: string }).code ?? null) : null;
    console.error(
      JSON.stringify({
        phase: "C0-payload",
        status: "failed",
        name,
        code,
        message: String(error instanceof Error ? error.message : error),
      }),
    );
    return exitCode;
  }
}

if (import.meta.main) {
  runCliC0Payload().then((code) => process.exit(code));
}
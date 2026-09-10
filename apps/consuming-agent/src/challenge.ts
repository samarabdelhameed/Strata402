import { decodePaymentRequiredHeader } from "@x402/core/http";
import { APPROVED_ROUTE, ALLOWED_ASSET, ALLOWED_NETWORK, ALLOWED_PRICE_TINYBARS } from "./types";

export const X402_VERSION = 2;
export const CHALLENGE_SCHEME = "exact";
export const PAYMENT_REQUIRED_HEADER = "payment-required";
export const PAYMENT_SIGNATURE_HEADER = "payment-signature";

export type ChallengeErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "HEADER_MISSING"
  | "MALFORMED_HEADER"
  | "X402_VERSION"
  | "ACCEPTS_EMPTY"
  | "SCHEME"
  | "NETWORK"
  | "ASSET"
  | "AMOUNT"
  | "PAYTO"
  | "TIMEOUT"
  | "FEEPAYER"
  | "UNEXPECTED_SIGNATURE";

export class ChallengeError extends Error {
  readonly code: ChallengeErrorCode;

  constructor(code: ChallengeErrorCode, message: string) {
    super(message);
    this.name = "ChallengeError";
    this.code = code;
  }
}

export interface ValidatedChallenge {
  x402Version: number;
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  feePayer: string;
}

export function decodeChallengeHeader(headerValue: string): unknown {
  try {
    return decodePaymentRequiredHeader(headerValue);
  } catch (cause) {
    throw new ChallengeError("MALFORMED_HEADER", `Invalid payment-required header: ${String(cause)}`);
  }
}

export function validateChallenge(raw: unknown): ValidatedChallenge {
  if (typeof raw !== "object" || raw === null) {
    throw new ChallengeError("MALFORMED_HEADER", "PAYMENT-REQUIRED header must decode to a JSON object");
  }
  const record = raw as Record<string, unknown>;

  const version = record.x402Version;
  if (version !== X402_VERSION) {
    throw new ChallengeError("X402_VERSION", `Unsupported x402Version: ${String(version)}`);
  }

  const accepts = Array.isArray(record.accepts) ? record.accepts : [];
  if (accepts.length === 0) {
    throw new ChallengeError("ACCEPTS_EMPTY", "accepts must contain a payment requirement");
  }

  const rawRequirement = accepts[0];
  if (typeof rawRequirement !== "object" || rawRequirement === null) {
    throw new ChallengeError("MALFORMED_HEADER", "accepts[0] must be an object");
  }
  const requirement = rawRequirement as Record<string, unknown>;

  if (requirement.scheme !== CHALLENGE_SCHEME) {
    throw new ChallengeError("SCHEME", `Unexpected scheme: ${String(requirement.scheme)}`);
  }
  if (requirement.network !== ALLOWED_NETWORK) {
    throw new ChallengeError("NETWORK", `Unexpected network: ${String(requirement.network)}`);
  }
  if (requirement.asset !== ALLOWED_ASSET) {
    throw new ChallengeError("ASSET", `Unexpected asset: ${String(requirement.asset)}`);
  }

  const amount = requirement.amount;
  if (typeof amount !== "string" || amount !== String(ALLOWED_PRICE_TINYBARS)) {
    throw new ChallengeError("AMOUNT", `Unexpected amount: ${String(amount)}`);
  }

  const payTo = requirement.payTo;
  if (typeof payTo !== "string" || payTo.length === 0) {
    throw new ChallengeError("PAYTO", "payTo is missing");
  }
  if (payTo === ALLOWED_ASSET) {
    throw new ChallengeError("PAYTO", "payTo must not be the HBAR asset id 0.0.0");
  }

  const maxTimeoutSeconds = requirement.maxTimeoutSeconds;
  if (
    typeof maxTimeoutSeconds !== "number" ||
    !Number.isInteger(maxTimeoutSeconds) ||
    maxTimeoutSeconds <= 0
  ) {
    throw new ChallengeError("TIMEOUT", "maxTimeoutSeconds must be a positive integer");
  }

  const extra = requirement.extra;
  if (typeof extra !== "object" || extra === null) {
    throw new ChallengeError("FEEPAYER", "extra must be an object");
  }
  const feePayer = (extra as Record<string, unknown>).feePayer;
  if (typeof feePayer !== "string" || feePayer.length === 0) {
    throw new ChallengeError("FEEPAYER", "extra.feePayer must be a non-empty string");
  }

  return {
    x402Version: version,
    scheme: requirement.scheme as string,
    network: requirement.network as string,
    asset: requirement.asset as string,
    amount,
    payTo,
    maxTimeoutSeconds,
    feePayer,
  };
}

export type ChallengeFetch = typeof fetch;

export interface UnpaidChallengeResult {
  status: number;
  header: string;
  challenge: ValidatedChallenge;
}

export async function requestUnpaidChallenge(
  serviceUrl: string,
  fetchFn: ChallengeFetch = fetch,
): Promise<UnpaidChallengeResult> {
  const target = `${serviceUrl}${APPROVED_ROUTE.endpoint}`;

  let res: Response;
  try {
    res = await fetchFn(target, {
      method: APPROVED_ROUTE.method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
    });
  } catch (cause) {
    throw new ChallengeError("REQUEST_FAILED", `Challenge request failed: ${String(cause)}`);
  }

  if (res.status !== 402) {
    throw new ChallengeError("HTTP_STATUS", `Expected 402, got ${res.status}`);
  }

  const signature = res.headers.get(PAYMENT_SIGNATURE_HEADER);
  if (signature !== null && signature.trim() !== "") {
    throw new ChallengeError(
      "UNEXPECTED_SIGNATURE",
      "Unpaid challenge server returned an unexpected payment signature",
    );
  }

  const header = res.headers.get(PAYMENT_REQUIRED_HEADER);
  if (header === null || header.trim() === "") {
    throw new ChallengeError("HEADER_MISSING", "PAYMENT-REQUIRED header is missing");
  }

  const raw = decodeChallengeHeader(header);
  const challenge = validateChallenge(raw);
  return { status: res.status, header, challenge };
}
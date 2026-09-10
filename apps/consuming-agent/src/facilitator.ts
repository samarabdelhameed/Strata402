import type { SupportedKind, SupportedResponse } from "@x402/core/types";
import { CHALLENGE_SCHEME, X402_VERSION } from "./challenge";
import { ALLOWED_NETWORK } from "./types";

/**
 * Phase 4.4-C0 — Facilitator Read-Only /supported Check.
 *
 * Performs a single read-only GET against `{facilitatorUrl}/supported` and
 * verifies that the facilitator advertises the exact-Hedera x402 v2 kind used
 * by Strata402 (scheme="exact", network="hedera:testnet").
 *
 * Scope (approved for C0):
 * - GET /supported only. Never verify, never settle, never sends a payment
 *   signature, payload, or any payer credential.
 * - The facilitator URL is always explicit; there is no silent fallback.
 */

export const FACILITATOR_SUPPORTED_PATH = "/supported";

export type FacilitatorReadErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "MALFORMED_JSON"
  | "KINDS_MISSING"
  | "KIND_UNSUPPORTED";

export class FacilitatorReadError extends Error {
  readonly code: FacilitatorReadErrorCode;

  constructor(code: FacilitatorReadErrorCode, message: string) {
    super(message);
    this.name = "FacilitatorReadError";
    this.code = code;
  }
}

export type FacilitatorFetch = typeof fetch;

export interface MatchedSupportedKind {
  x402Version: number;
  scheme: string;
  network: string;
}

export interface FacilitatorSupported {
  facilitatorUrl: string;
  matchedKind: MatchedSupportedKind;
  kindCount: number;
  extensionCount: number;
  signerCount: number;
}

export function parseSupportedJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FacilitatorReadError(
      "MALFORMED_JSON",
      "Facilitator /supported response is not valid JSON",
    );
  }
}

export function selectSupportedKind(raw: unknown): MatchedSupportedKind {
  if (typeof raw !== "object" || raw === null) {
    throw new FacilitatorReadError("MALFORMED_JSON", "Facilitator /supported must be a JSON object");
  }

  const kinds = (raw as Record<string, unknown>).kinds;
  if (!Array.isArray(kinds) || kinds.length === 0) {
    throw new FacilitatorReadError("KINDS_MISSING", "supported.kinds must be a non-empty array");
  }

  const match = kinds.find(
    (entry): entry is SupportedKind =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as Record<string, unknown>).x402Version === X402_VERSION &&
      (entry as Record<string, unknown>).scheme === CHALLENGE_SCHEME &&
      (entry as Record<string, unknown>).network === ALLOWED_NETWORK,
  );
  if (match === undefined) {
    throw new FacilitatorReadError(
      "KIND_UNSUPPORTED",
      `No supported kind for x402 v${X402_VERSION} ${CHALLENGE_SCHEME}/${String(ALLOWED_NETWORK)}`,
    );
  }

  return {
    x402Version: match.x402Version as number,
    scheme: match.scheme,
    network: match.network,
  };
}

/**
 * Read-only `/supported` check. Returns counts only — no killer detail, no
 * credentials, no verification/settlement.
 */
export async function fetchFacilitatorSupported(
  facilitatorUrl: string,
  fetchFn: FacilitatorFetch = fetch,
): Promise<FacilitatorSupported> {
  const target = `${facilitatorUrl}${FACILITATOR_SUPPORTED_PATH}`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new FacilitatorReadError(
      "REQUEST_FAILED",
      `Facilitator /supported request failed: ${String(cause)}`,
    );
  }

  if (res.status !== 200) {
    throw new FacilitatorReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  const raw = parseSupportedJson(text);
  const matchedKind = selectSupportedKind(raw);

  const record = raw as SupportedResponse;
  const kinds = Array.isArray(record.kinds) ? (record.kinds as SupportedKind[]) : [];
  const extensions = Array.isArray(record.extensions) ? record.extensions : [];
  const signers =
    typeof record.signers === "object" && record.signers !== null
      ? Object.keys(record.signers)
      : [];

  return {
    facilitatorUrl,
    matchedKind,
    kindCount: kinds.length,
    extensionCount: extensions.length,
    signerCount: signers.length,
  };
}
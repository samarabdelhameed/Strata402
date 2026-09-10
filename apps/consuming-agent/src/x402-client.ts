import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ALLOWED_NETWORK } from "./types";
import {
  createPaymentSigning,
  type PayerSigningContext,
  type ConstructPaymentPayloadOptions,
} from "./payment-constructor";

/**
 * Phase 4.4-B2 — Official x402 Client Factory.
 *
 * Wires the local payer credential into the official @x402 SDK: an `x402Client`
 * registered for the allowed testnet network plus the HTTP transport wrapper
 * used to encode PAYMENT-SIGNATURE headers and parse payment responses.
 *
 * Scope (approved for B2):
 * - Local-only construction (no HTTP, no PAYMENT-SIGNATURE, no transaction
 *   submission, no network call) — same guarantees as B1.
 * - Spend-control inference is intentionally NOT used here: our spend caps are
 *   tinybar-exact and enforced by B0/B1 plus SpendLedger, not by SDK USD caps.
 * - Never prints or returns the private key or any signed bytes.
 */

export interface X402PaymentClient extends PayerSigningContext {
  client: x402Client;
  http: x402HTTPClient;
}

/**
 * Builds the official x402 client + HTTP wrapper for the allowed network using
 * the local `.env` payer credentials. Local-only: never touches the network.
 */
export async function createX402PaymentClient(
  options: ConstructPaymentPayloadOptions = {},
): Promise<X402PaymentClient> {
  const signing = await createPaymentSigning(options);
  const client = new x402Client().register(ALLOWED_NETWORK, signing.scheme);
  const http = new x402HTTPClient(client);
  return { ...signing, client, http };
}

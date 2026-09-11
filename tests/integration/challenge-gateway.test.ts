import { test, expect } from "bun:test";
import {
  APPROVED_ROUTE,
  CHALLENGE_SCHEME,
  DEFAULT_SERVICE_URL,
  PAYMENT_SIGNATURE_HEADER,
  X402_VERSION,
  requestUnpaidChallenge,
} from "@strata402/consuming-agent";
import { ALLOWED_ASSET, ALLOWED_NETWORK, ALLOWED_PRICE_TINYBARS } from "@strata402/consuming-agent";

const RUN_GATEWAY_INTEGRATION = process.env.RUN_GATEWAY_INTEGRATION === "true";
const SERVICE_URL = process.env.STRATA402_SERVICE_URL ?? DEFAULT_SERVICE_URL;
const EXPECTED_PAYTO = process.env.HEDERA_SERVICE_ACCOUNT_ID ?? "0.0.10464194";

const run = RUN_GATEWAY_INTEGRATION ? test : test.skip;

run("real unpaid 402 challenge against the running local Gateway", async () => {
  const raw = await fetch(`${SERVICE_URL}${APPROVED_ROUTE.endpoint}`, {
    method: APPROVED_ROUTE.method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: "{}",
  });

  expect(raw.status).toBe(402);
  const signature = raw.headers.get(PAYMENT_SIGNATURE_HEADER);
  expect(signature === null || signature.trim() === "").toBe(true);

  const result = await requestUnpaidChallenge(SERVICE_URL);

  expect(result.status).toBe(402);
  expect(result.challenge.x402Version).toBe(X402_VERSION);
  expect(result.challenge.scheme).toBe(CHALLENGE_SCHEME);
  expect(result.challenge.network).toBe(ALLOWED_NETWORK);
  expect(result.challenge.asset).toBe(ALLOWED_ASSET);
  expect(result.challenge.amount).toBe(String(ALLOWED_PRICE_TINYBARS));
  expect(result.challenge.payTo).toBe("0.0.1234");
  expect(result.challenge.maxTimeoutSeconds).toBe(300);
  expect(result.challenge.feePayer).toBe("0.0.9185802");
  expect(result.challenge.payTo).toBe(EXPECTED_PAYTO);
});
import { test, expect } from "bun:test";
import { createRequire } from "node:module";
import { x402Version } from "@x402/core";
import * as hedera from "@x402/hedera";
import * as fetch from "@x402/fetch";
import * as express from "@x402/express";

test("@hiero-ledger/sdk is a single hoisted instance (no duplicate SDK installs)", () => {
  const require = createRequire(import.meta.url);
  const sdkPath = require.resolve("@hiero-ledger/sdk");
  expect(sdkPath).toContain("/node_modules/@hiero-ledger/sdk/");
});

test("@x402/core exposes x402Version = 2", () => {
  expect(x402Version).toBe(2);
});

test("@x402/hedera exports the x402 v2 Hedera building blocks", () => {
  expect(typeof hedera.TransferTransaction).toBe("function");
  expect(typeof hedera.Transaction).toBe("function");
  expect(typeof hedera.TransactionId).toBe("function");
  expect(typeof hedera.extractTransactionFromPayload).toBe("function");
  expect(typeof hedera.createHederaVerifyPayerSignature).toBe("function");
  expect(typeof hedera.createHederaSignAndSubmitTransaction).toBe("function");
  expect(typeof hedera.createHederaClient).toBe("function");
  expect(typeof hedera.ExactHederaScheme).toBe("function");
  expect(typeof hedera.mirrorNodeUrlForNetwork).toBe("function");
  expect(hedera.HEDERA_TESTNET_CAIP2).toBeTruthy();
  expect(Boolean(hedera.DEFAULT_ASSETS)).toBe(true);
});

test("@x402/fetch exports the payment wiring helpers", () => {
  expect(typeof fetch.wrapFetchWithPayment).toBe("function");
  expect(typeof fetch.x402Client).toBe("function");
  expect(typeof fetch.x402HTTPClient).toBe("function");
  expect(typeof fetch.decodePaymentResponseHeader).toBe("function");
});

test("@x402/express exports the gateway middleware", () => {
  expect(typeof express.paymentMiddleware).toBe("function");
  expect(typeof express.paymentMiddlewareFromConfig).toBe("function");
  expect(typeof express.x402ResourceServer).toBe("function");
  expect(typeof express.ExpressAdapter).toBe("function");
  expect(typeof express.SETTLEMENT_OVERRIDES_HEADER).toBe("string");
});
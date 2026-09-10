import { test, expect } from "bun:test";
import {
  ALLOWED_ASSET,
  BINDING_DEFAULT_MAX_PER_REQUEST_TINYBARS,
  BINDING_DEFAULT_MAX_TOTAL_BUDGET_TINYBARS,
  CHALLENGE_SCHEME,
  PaymentRequirementsError,
  X402_VERSION,
  bindPaymentRequirements,
} from "@strata402/consuming-agent";
import type {
  PaymentRequirementsBinding,
  PaymentRequirementsErrorCode,
  ValidatedChallenge,
} from "@strata402/consuming-agent";

const realGatewayFixture: ValidatedChallenge = {
  x402Version: 2,
  scheme: "exact",
  network: "hedera:testnet",
  asset: "0.0.0",
  amount: "1000000",
  payTo: "0.0.1234",
  maxTimeoutSeconds: 300,
  feePayer: "0.0.9185802",
};

function rejectsWith(
  runner: () => unknown,
  code: PaymentRequirementsErrorCode,
): void {
  try {
    runner();
  } catch (err) {
    expect(err).toBeInstanceOf(PaymentRequirementsError);
    expect((err as PaymentRequirementsError).code).toBe(code);
    return;
  }
  throw new Error(`expected PaymentRequirementsError code=${code}, but no error was thrown`);
}

test("bindPaymentRequirements binds an approved gateway challenge", () => {
  const binding = bindPaymentRequirements(realGatewayFixture);

  expect(binding.x402Version).toBe(X402_VERSION);
  expect(binding.x402Version).toBe(2);

  const requirements = binding.requirements;
  expect(requirements.scheme).toBe(CHALLENGE_SCHEME);
  expect(requirements.scheme).toBe("exact");
  expect(requirements.network).toBe("hedera:testnet");
  expect(requirements.asset).toBe(ALLOWED_ASSET);
  expect(requirements.amount).toBe("1000000");
  expect(requirements.payTo).toBe("0.0.1234");
  expect(requirements.maxTimeoutSeconds).toBe(300);
  expect(requirements.extra).toEqual({ feePayer: "0.0.9185802" });
});

test("binding carries the official PaymentRequirements shape", () => {
  const binding: PaymentRequirementsBinding = bindPaymentRequirements(realGatewayFixture);

  expect(binding.x402Version).toBe(2);
  expect(binding.requirements).not.toBe(realGatewayFixture);
  expect(binding.requirements.extra).toEqual({ feePayer: "0.0.9185802" });
  expect(Object.keys(binding.requirements).sort()).toEqual([
    "amount",
    "asset",
    "extra",
    "maxTimeoutSeconds",
    "network",
    "payTo",
    "scheme",
  ]);
});

test("binding rejects an unsupported x402Version", () => {
  rejectsWith(
    () => bindPaymentRequirements({ ...realGatewayFixture, x402Version: 1 }),
    "REQUIREMENTS_MISMATCH",
  );
});

test("binding rejects a non-numeric amount", () => {
  rejectsWith(
    () => bindPaymentRequirements({ ...realGatewayFixture, amount: "abc" }),
    "AMOUNT",
  );
});

test("binding rejects a zero amount", () => {
  rejectsWith(
    () => bindPaymentRequirements({ ...realGatewayFixture, amount: "0" }),
    "AMOUNT",
  );
});

test("binding rejects an amount above the per-request cap", () => {
  const over = String(BINDING_DEFAULT_MAX_PER_REQUEST_TINYBARS + 1);
  rejectsWith(
    () => bindPaymentRequirements({ ...realGatewayFixture, amount: over }),
    "CAP_PER_REQUEST",
  );
});

test("per-request cap is the only binding constraint for a single request", () => {
  // Cumulative total-budget (100M) is a DEFERRED safety control: it is config
  // only and is not enforced by this binding. It will be enforced by a spend
  // tracker once one exists. A single binding is always constrained by the
  // per-request cap, so a 100M amount is rejected via CAP_PER_REQUEST.
  const atTotalBudget = String(BINDING_DEFAULT_MAX_TOTAL_BUDGET_TINYBARS);
  rejectsWith(
    () => bindPaymentRequirements({ ...realGatewayFixture, amount: atTotalBudget }),
    "CAP_PER_REQUEST",
  );
});

test("binding applies caps as the default re-exported ceiling", () => {
  expect(BINDING_DEFAULT_MAX_PER_REQUEST_TINYBARS).toBe(1_000_000);
  expect(BINDING_DEFAULT_MAX_TOTAL_BUDGET_TINYBARS).toBe(100_000_000);
});

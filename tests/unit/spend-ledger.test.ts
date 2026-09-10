import { test, expect } from "bun:test";
import {
  SpendLedger,
  SpendLedgerError,
  createDefaultSpendLedger,
  createSpendLedger,
} from "@strata402/consuming-agent";
import type { SpendLedgerErrorCode } from "@strata402/consuming-agent";
import { loadConfig } from "@strata402/consuming-agent";

function expectsLedgerError(
  run: () => unknown,
  code: SpendLedgerErrorCode,
): void {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(SpendLedgerError);
    expect((err as SpendLedgerError).code).toBe(code);
    return;
  }
  throw new Error(`expected SpendLedgerError code=${code}, but no error was thrown`);
}

test("SpendLedger accumulates spends and reports spent/remaining as tinybar strings", () => {
  const ledger = new SpendLedger(10_000_000);
  const first = ledger.record("0.0.10329902", "1500000");
  const second = ledger.record("0.0.10329902", "2500000");

  expect(first).toEqual({
    payerAccountId: "0.0.10329902",
    amountTinybars: "1500000",
    spentTinybars: "1500000",
    remainingTinybars: "8500000",
    at: expect.any(Number),
  });
  expect(second.spentTinybars).toBe("4000000");
  expect(second.remainingTinybars).toBe("6000000");
  expect(ledger.spentTinybars()).toBe(4_000_000n);
  expect(ledger.remainingTinybars()).toBe(6_000_000n);
});

test("SpendLedger rejects an empty payer account", () => {
  const ledger = new SpendLedger(10_000_000);
  expectsLedgerError(() => ledger.record("", "1000"), "INVALID_AMOUNT");
});

test("SpendLedger rejects non-positive amounts", () => {
  const ledger = new SpendLedger(10_000_000);
  expectsLedgerError(() => ledger.record("0.0.10329902", "0"), "INVALID_AMOUNT");
  expectsLedgerError(() => ledger.record("0.0.10329902", "-5"), "INVALID_AMOUNT");
  expectsLedgerError(() => ledger.record("0.0.10329902", "abc"), "INVALID_AMOUNT");
  expectsLedgerError(() => ledger.record("0.0.10329902", 0n), "INVALID_AMOUNT");
});

test("SpendLedger throws TOTAL_BUDGET before exceeding the cap and leaves state unchanged", () => {
  const ledger = new SpendLedger(2_000_000);
  ledger.record("0.0.10329902", "1_000_000".replaceAll("_", ""));

  expectsLedgerError(
    () => ledger.record("0.0.10329902", "1_000_001".replaceAll("_", "")),
    "TOTAL_BUDGET",
  );

  expect(ledger.spentTinybars()).toBe(1_000_000n);
  expect(ledger.remainingTinybars()).toBe(1_000_000n);
});

test("SpendLedger rejects a different payer on the same ledger", () => {
  const ledger = new SpendLedger(10_000_000);
  ledger.record("0.0.10329902", "100");
  expectsLedgerError(
    () => ledger.record("0.0.10271523", "100"),
    "PAYER_MISMATCH",
  );
});

test("SpendLedger always enters the allowed amount exactly at the cap", () => {
  const ledger = new SpendLedger(1_000_000);
  const entry = ledger.record("0.0.10329902", "1000000");
  expect(entry.remainingTinybars).toBe("0");
  expect(ledger.remainingTinybars()).toBe(0n);
});

test("SpendLedger reset clears the balance and payer scope", () => {
  const ledger = new SpendLedger(10_000_000);
  ledger.record("0.0.10329902", "3000000");
  ledger.reset();
  expect(ledger.spentTinybars()).toBe(0n);
  const entry = ledger.record("0.0.10271523", "100");
  expect(entry.payerAccountId).toBe("0.0.10271523");
});

test("SpendLedger constructor rejects invalid budgets", () => {
  expectsLedgerError(() => new SpendLedger(0), "INVALID_AMOUNT");
  expectsLedgerError(() => new SpendLedger(-1), "INVALID_AMOUNT");
  expectsLedgerError(() => new SpendLedger(1.5), "INVALID_AMOUNT");
});

test("createSpendLedger uses the config total budget", () => {
  const config = loadConfig();
  const ledger = createSpendLedger(config);
  expect(ledger.remainingTinybars()).toBe(BigInt(config.maxTotalBudgetTinybars));
  expect(createDefaultSpendLedger().remainingTinybars()).toBe(
    BigInt(config.maxTotalBudgetTinybars),
  );
});

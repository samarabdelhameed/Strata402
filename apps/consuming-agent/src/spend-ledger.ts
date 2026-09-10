import { loadConfig, type SafetyConfig } from "./config";

/**
 * Phase 4.4-B2 — Cumulative Spend Ledger.
 *
 * Enforces the approved total-budget cap (default 100,000,000 tinybars) across
 * paid requests. B0 deferred total-budget enforcement; this ledger closes that
 * gap. It is deliberately conservative: an entry is recorded BEFORE a network
 * send is attempted, so unknown-outcome attempts still count toward the budget
 * and cannot be replayed.
 */

export type SpendLedgerErrorCode =
  | "INVALID_AMOUNT"
  | "PAYER_MISMATCH"
  | "TOTAL_BUDGET";

export class SpendLedgerError extends Error {
  readonly code: SpendLedgerErrorCode;

  constructor(code: SpendLedgerErrorCode, message: string) {
    super(message);
    this.name = "SpendLedgerError";
    this.code = code;
  }
}

export interface SpendEntry {
  payerAccountId: string;
  amountTinybars: string;
  spentTinybars: string;
  remainingTinybars: string;
  at: number;
}

function parseAmount(value: string | bigint): bigint {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new SpendLedgerError("INVALID_AMOUNT", `Amount must be positive: ${String(value)}`);
    }
    return value;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new SpendLedgerError("INVALID_AMOUNT", `Invalid tinybar amount: ${String(value)}`);
  }
  return BigInt(parsed);
}

export class SpendLedger {
  private readonly maxTotalBudgetTinybars: bigint;
  private spent = 0n;
  private payerAccountId: string | null = null;

  constructor(maxTotalBudgetTinybars: number) {
    if (!Number.isSafeInteger(maxTotalBudgetTinybars) || maxTotalBudgetTinybars <= 0) {
      throw new SpendLedgerError(
        "INVALID_AMOUNT",
        `Total budget must be a positive integer: ${String(maxTotalBudgetTinybars)}`,
      );
    }
    this.maxTotalBudgetTinybars = BigInt(maxTotalBudgetTinybars);
  }

  /**
   * Records a spend. Throws TOTAL_BUDGET if the cumulative total would exceed
   * the configured budget. The ledger is scoped to a single payer: recording a
   * different payer later throws PAYER_MISMATCH.
   */
  record(payerAccountId: string, amountTinybars: string | bigint, at = Date.now()): SpendEntry {
    if (payerAccountId === "") {
      throw new SpendLedgerError("INVALID_AMOUNT", "payerAccountId must not be empty");
    }
    if (this.payerAccountId === null) {
      this.payerAccountId = payerAccountId;
    } else if (this.payerAccountId !== payerAccountId) {
      throw new SpendLedgerError(
        "PAYER_MISMATCH",
        `Ledger is scoped to ${this.payerAccountId}, got ${payerAccountId}`,
      );
    }

    const amount = parseAmount(amountTinybars);
    const next = this.spent + amount;
    if (next > this.maxTotalBudgetTinybars) {
      throw new SpendLedgerError(
        "TOTAL_BUDGET",
        `Spend of ${String(next)} tinybars would exceed total budget ${String(this.maxTotalBudgetTinybars)}`,
      );
    }

    this.spent = next;
    return {
      payerAccountId,
      amountTinybars: String(amount),
      spentTinybars: String(this.spent),
      remainingTinybars: String(this.maxTotalBudgetTinybars - this.spent),
      at,
    };
  }

  spentTinybars(): bigint {
    return this.spent;
  }

  remainingTinybars(): bigint {
    return this.maxTotalBudgetTinybars - this.spent;
  }

  reset(): void {
    this.spent = 0n;
    this.payerAccountId = null;
  }
}

/**
 * Builds a ledger from the approved safety config.
 */
export function createSpendLedger(config: SafetyConfig): SpendLedger {
  return new SpendLedger(config.maxTotalBudgetTinybars);
}

/**
 * Builds a default ledger from the current environment config (100,000,000
 * tinybars unless STRATA402_MAX_TOTAL_BUDGET_TINYBARS overrides it).
 */
export function createDefaultSpendLedger(): SpendLedger {
  return createSpendLedger(loadConfig());
}

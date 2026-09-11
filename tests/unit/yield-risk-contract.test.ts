import { test, expect } from "bun:test";
import {
  DEFAULT_RISK_TOLERANCE,
  MAX_ANALYSIS_AMOUNT_HBAR,
  parseYieldRiskContract,
  type YieldRiskContractIssue,
} from "@strata402/x402-sdk";

// Unit-only tests of the shared yield-risk request contract. These use plain
// literal inputs to isolate parsing logic; they never touch the network and
// never claim any live outcome. Live behavior is covered by the gated
// integration suites (RUN_MIRROR_INTEGRATION / RUN_GATEWAY_INTEGRATION).

test("accepts a well-formed contract for each supported risk tolerance", () => {
  for (const riskTolerance of ["conservative", "balanced", "aggressive"]) {
    const result = parseYieldRiskContract({
      accountId: "0.0.10464194",
      riskTolerance,
      amountHbar: 100,
    });
    expect(result.ok).toBe(true);
  }
});

test("0.01, 1, 100 and the upper bound parse to exact tinybar values", () => {
  for (const amountHbar of [0.01, 1, 100, MAX_ANALYSIS_AMOUNT_HBAR]) {
    const result = parseYieldRiskContract({
      accountId: "0.0.1",
      riskTolerance: "balanced",
      amountHbar,
    });
    expect(result.ok).toBe(true);
  }
});

test("accountId is required and must be a valid Hedera id", () => {
  const cases: Array<{ body: unknown; issue: YieldRiskContractIssue }> = [
    { body: {}, issue: "missing_accountId" },
    { body: { accountId: "" }, issue: "missing_accountId" },
    { body: { accountId: "   " }, issue: "missing_accountId" },
    { body: { accountId: 5 }, issue: "missing_accountId" },
    { body: { accountId: "not-an-account" }, issue: "invalid_accountId" },
    { body: { accountId: "0.0.0" }, issue: "invalid_accountId" },
    { body: { accountId: "0.0" }, issue: "invalid_accountId" },
    { body: { accountId: "00.0.1" }, issue: "invalid_accountId" },
    { body: { accountId: "0.0.12345678901234567890" }, issue: "invalid_accountId" },
  ];
  for (const { body, issue } of cases) {
    const result = parseYieldRiskContract(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toContain(issue);
  }
});

test("riskTolerance is required and restricted to the enum", () => {
  const cases: Array<{ body: unknown; issue: YieldRiskContractIssue }> = [
    { body: { accountId: "0.0.1", amountHbar: 1 }, issue: "missing_riskTolerance" },
    { body: { accountId: "0.0.1", riskTolerance: "", amountHbar: 1 }, issue: "missing_riskTolerance" },
    { body: { accountId: "0.0.1", riskTolerance: "high-risk", amountHbar: 1 }, issue: "unsupported_riskTolerance" },
    { body: { accountId: "0.0.1", riskTolerance: 1, amountHbar: 1 }, issue: "missing_riskTolerance" },
  ];
  for (const { body, issue } of cases) {
    const result = parseYieldRiskContract(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toContain(issue);
  }
});

test("amountHbar must be a finite positive number with safe precision", () => {
  const cases: Array<{ body: unknown; issue: YieldRiskContractIssue }> = [
    { body: { accountId: "0.0.1", riskTolerance: "balanced" }, issue: "non_numeric_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: "100" }, issue: "non_numeric_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: NaN }, issue: "non_finite_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: Infinity }, issue: "non_finite_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: -Infinity }, issue: "non_finite_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: 0 }, issue: "non_positive_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: -1 }, issue: "non_positive_amountHbar" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: MAX_ANALYSIS_AMOUNT_HBAR + 1 }, issue: "amountHbar_too_large" },
    { body: { accountId: "0.0.1", riskTolerance: "balanced", amountHbar: 0.123456789 }, issue: "unsafe_precision_amountHbar" },
  ];
  for (const { body, issue } of cases) {
    const result = parseYieldRiskContract(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toContain(issue);
  }
});

test("the gateway must reject a malformed body with 400 BEFORE any mirror call", () => {
  for (const body of [null, undefined, 5, "x", []]) {
    const result = parseYieldRiskContract(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toEqual(["invalid_request_body"]);
  }
});

test("returns the normalized contract on success", () => {
  const result = parseYieldRiskContract({
    accountId: "  0.0.10464194  ",
    riskTolerance: "conservative",
    amountHbar: 0.5,
  });
  expect(result).toEqual({
    ok: true,
    contract: { accountId: "0.0.10464194", riskTolerance: "conservative", amountHbar: 0.5 },
  });
});

test("DEFAULT_RISK_TOLERANCE is a supported value", () => {
  expect(["conservative", "balanced", "aggressive"]).toContain(DEFAULT_RISK_TOLERANCE);
});
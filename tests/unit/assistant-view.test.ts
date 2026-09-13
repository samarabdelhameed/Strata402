import { describe, expect, test } from "bun:test";
import {
  EXECUTION_STATUS,
  STATUS,
  UNAVAILABLE_TEXT,
  assertHasNoExecutionClaim,
  buildStudioAnalysisView,
  requestIdConsistency,
  sanitizeNarrativePoints,
  type AnalysisRow,
  type StudioInput,
} from "../../apps/web/src/lib/assistant";

describe("assistant display-model sanitizer", () => {
  test("assertHasNoExecutionClaim rejects positive execution claims", () => {
    expect(assertHasNoExecutionClaim("Executed.")).toBe(false);
    expect(assertHasNoExecutionClaim("Order placed on-chain.")).toBe(false);
    expect(assertHasNoExecutionClaim("Stop-loss deployed.")).toBe(false);
    expect(assertHasNoExecutionClaim("Swap completed on SaucerSwap.")).toBe(false);
    expect(assertHasNoExecutionClaim("Strategy executed and funds transferred.")).toBe(false);
    expect(assertHasNoExecutionClaim("Funds were moved to the vault.")).toBe(false);
  });

  test("assertHasNoExecutionClaim accepts required gated/not-executed wording", () => {
    expect(assertHasNoExecutionClaim("Execution status: Not executed.")).toBe(true);
    expect(assertHasNoExecutionClaim("No funds were moved.")).toBe(true);
    expect(assertHasNoExecutionClaim("The strategy execution layer is gated.")).toBe(true);
    expect(
      assertHasNoExecutionClaim("The strategy execution layer is gated and no funds were moved."),
    ).toBe(true);
  });

  test("sanitizeNarrativePoints strips fabricated execution claims but keeps honest wording", () => {
    const out = sanitizeNarrativePoints([
      "Executed.",
      "Order placed: stop-loss at 5%.",
      "Stop-loss deployed.",
      "Swap completed on SaucerSwap.",
      "Strategy executed and funds transferred.",
      "Execution status: Not executed.",
      "The strategy execution layer is gated and no funds were moved.",
      "Live account balance 12.3456789 HBAR verified from mirror.",
      "   ",
    ]);
    expect(out).toEqual([
      "Execution status: Not executed.",
      "The strategy execution layer is gated and no funds were moved.",
      "Live account balance 12.3456789 HBAR verified from mirror.",
    ]);
  });
});

describe("buildStudioAnalysisView", () => {
  const settledInput: StudioInput = {
    accountId: "0.0.10329902",
    network: "hedera:testnet",
    analyzedAt: "2026-09-13T00:00:00.000Z",
    topicId: "0.0.10483725",
    balanceHbar: "12.34567890",
    balanceExists: true,
    activity: {
      ok: true,
      total: 42,
      inflowHbar: "2.5",
      outflowHbar: "1.2",
      netHbar: "1.3",
      fromTs: 1720000000,
      toTs: 1722592000,
    },
    saucer: {
      ok: true,
      readOnly: true,
      poolCount: 3,
      tokenCount: 10,
      apyStatus: "UNAVAILABLE",
    },
    hcsOnline: true,
    hcsLastSeq: 17,
    settlement: {
      verified: true,
      transactionId: "0.0.10329902-1722592000-000000001",
      payerAccountId: "0.0.10329902",
      recipientAccountId: "0.0.10483725",
      amountTinybars: "1000000",
      consensusTimestamp: "1722592000.123456789",
    },
    narrativePoints: [
      "Live account balance 12.3456789 HBAR verified from mirror.",
      "Executed.",
    ],
  };

  test("payment succeeded but strategy execution stays GATED / NOT EXECUTED", () => {
    const view = buildStudioAnalysisView(settledInput);

    // Two separate statuses — payment success and execution are never merged.
    expect(view.paymentStatus).toBe(STATUS.SUCCESS);
    expect(view.paymentText).toBe("Payment status: 0.01 HBAR settled successfully through Blocky402.");
    expect(view.executionStatus).toBe(EXECUTION_STATUS.GATED);
    expect(view.executionText).toContain("Not executed");
    expect(view.executionText).toContain("gated");

    const execCard = view.sections.find((s) => s.kind === "execution");
    expect(execCard).toBeDefined();
    const execText = execCard!.rows.map((r) => r.value).join(" | ");
    expect(execText).toContain("GATED · Not executed");
    expect(execText).toContain("No funds were moved");

    const paymentCard = view.sections.find((s) => s.kind === "payment");
    expect(paymentCard).toBeDefined();
    expect(paymentCard!.rows[0]?.value).toContain(STATUS.SUCCESS);

    // fabricated engine claim was stripped from the facts card
    const facts = view.sections.find((s) => s.kind === "facts");
    expect(facts!.bullets).toEqual([
      "Live account balance 12.3456789 HBAR verified from mirror.",
    ]);

    // APY is never invented
    const risk = view.sections.find((s) => s.kind === "risk");
    const riskRows = Object.fromEntries(risk!.rows.map((r) => [r.label, r.value]));
    expect(riskRows["APY / yield data"]).toBe(UNAVAILABLE_TEXT);

    // renderable text carries no positive execution claim anywhere
    const allText = view.sections
      .flatMap((s) => [...s.rows.map((r) => r.value), ...(s.bullets ?? []), s.title])
      .join(" ");
    expect(assertHasNoExecutionClaim(allText)).toBe(true);

    // explicit visible disclaimer
    expect(view.disclaimer.length).toBeGreaterThan(0);
    expect(view.disclaimer).toContain("not financial advice");
  });

  test("unverified or missing data surfaces as UNAVAILABLE, never estimated", () => {
    const view = buildStudioAnalysisView({
      accountId: "0.0.10329902",
      network: "hedera:testnet",
      analyzedAt: "2026-09-13T00:00:00.000Z",
      topicId: "0.0.10483725",
    });
    expect(view.paymentStatus).toBe(STATUS.UNAVAILABLE);
    expect(view.executionStatus).toBe(EXECUTION_STATUS.GATED);

    const risk = view.sections.find((s) => s.kind === "risk");
    const rows = Object.fromEntries(risk!.rows.map((r) => [r.label, r.value]));
    expect(rows["APY / yield data"]).toBe(UNAVAILABLE_TEXT);
    expect(rows["Liquidity / protocol data"]).toBe(UNAVAILABLE_TEXT);
    expect(rows["Volatility exposure"]).toBe(UNAVAILABLE_TEXT);

    const payment = view.sections.find((s) => s.kind === "payment");
    expect(payment!.rows[0]?.value).toContain(STATUS.UNAVAILABLE);
  });
});

describe("HCS audit card + requestId consistency", () => {
  const baseInput: StudioInput = {
    accountId: "0.0.10329902",
    network: "hedera:testnet",
    analyzedAt: "2026-09-13T00:00:00.000Z",
    topicId: "0.0.10483725",
  };

  test("hcs card renders the exact echoed requestId as a selectable mono row", () => {
    const view = buildStudioAnalysisView({
      ...baseInput,
      hcsOnline: true,
      hcsLastSeq: 52,
      audit: {
        requestId: "d0fd0709-08bc-456f-861a-6f8ebc08fb89",
        topicId: "0.0.10483725",
        sequenceNumber: 52,
        status: "online",
      },
      hcsAuditConsistency: { ok: true, reason: "API and HCS audit requestId match" },
    });

    const hcs = view.sections.find((s) => s.kind === "hcs");
    expect(hcs).toBeDefined();
    const rows = Object.fromEntries(hcs!.rows.map((r) => [r.label, r])) as Record<
      string,
      AnalysisRow
    >;
    expect(rows["Request ID"]!.value).toBe("d0fd0709-08bc-456f-861a-6f8ebc08fb89");
    expect(rows["Request ID"]!.mono).toBe(true);
    expect(rows["Audit topic"]!.href).toContain("0.0.10483725");
    expect(rows["Latest sequence"]!.value).toBe("52");
    expect(rows["Topic status"]!.value).toContain("online");
    expect(rows["Request ID ↔ HCS"]!.value).toBe("Matched");
    expect(rows["Request ID ↔ HCS"]!.tone).toBe("ok");
  });

  test("audit card degrades gracefully when the audit block is absent", () => {
    const view = buildStudioAnalysisView({ ...baseInput });
    const hcs = view.sections.find((s) => s.kind === "hcs");
    const rows = Object.fromEntries(hcs!.rows.map((r) => [r.label, r])) as Record<
      string,
      AnalysisRow
    >;
    expect(rows["Request ID"]!.value).toBe(UNAVAILABLE_TEXT);
    expect(rows["Request ID"]!.mono).toBe(true);
    expect(rows["Request ID ↔ HCS"]).toBeUndefined();
  });

  test("sequenceNumber falls back to the pre-payment hcsLastSeq when unavailable", () => {
    const view = buildStudioAnalysisView({
      ...baseInput,
      hcsOnline: true,
      hcsLastSeq: 17,
      audit: { requestId: "abc", topicId: "0.0.10483725", status: "online" },
    });
    const hcs = view.sections.find((s) => s.kind === "hcs");
    const rows = Object.fromEntries(hcs!.rows.map((r) => [r.label, r])) as Record<
      string,
      AnalysisRow
    >;
    expect(rows["Latest sequence"]!.value).toBe("17");
  });

  test("requestIdConsistency matches, mismatches, and stays unverifiable", () => {
    expect(
      requestIdConsistency("d0fd0709-08bc-456f-861a-6f8ebc08fb89", "d0fd0709-08bc-456f-861a-6f8ebc08fb89"),
    ).toEqual({ ok: true, reason: "API and HCS audit requestId match" });

    const mismatch = requestIdConsistency("aaa", "bbb");
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toContain("MISMATCH");

    expect(requestIdConsistency(undefined, "bbb").ok).toBe(true);
    expect(requestIdConsistency("aaa", undefined).ok).toBe(true);
    expect(requestIdConsistency(undefined, undefined).ok).toBe(true);
    expect(requestIdConsistency("", "").ok).toBe(true);
  });
});
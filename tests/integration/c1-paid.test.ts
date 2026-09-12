import { test, expect } from "bun:test";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { PrivateKey } from "@x402/hedera";
import {
  ALLOWED_ASSET,
  ALLOWED_NETWORK,
  ALLOWED_PRICE_TINYBARS,
  APPROVED_ROUTE,
  DISCOVERY_PATH,
  FACILITATOR_SUPPORTED_PATH,
  PAYMENT_SIGNATURE_HEADER,
} from "@strata402/consuming-agent";
import {
  C1Error,
  C1_REQUEST_COUNT,
  ENV_C1_CONFIRM,
  ENV_RUN_C1,
  EXIT_AWAITING_CONFIRM,
  EXIT_MISCONFIG,
  EXIT_OK,
  EXIT_PAYMENT_FAILED,
  MIRROR_TRANSACTIONS_PATH,
  PLACEHOLDER_PAYTO,
  findMatchingTransaction,
  isC1Enabled,
  runC1,
  runCliC1,
  verifySettlementEvidence,
} from "../../apps/consuming-agent/src/cli-c1-paid";
import type { C1ErrorCode, C1Fetch } from "../../apps/consuming-agent/src/cli-c1-paid";

const PAYER = "0.0.10329902";
const CERTIFIED_PAYTO = "0.0.7777";
const AMOUNT = String(ALLOWED_PRICE_TINYBARS);

const VALID_SERVICE = {
  id: "yield-risk",
  name: "Yield-Risk Strategy",
  description: "Risk-scored yield strategy assessment for a DeFi protocol position on Hedera.",
  priceTinybars: 1_000_000,
  asset: "0.0.0",
  unit: "tinybar",
};

function makeCatalog(payTo: string): Record<string, unknown> {
  return { network: "hedera:testnet", currency: "HBAR", payTo, services: [VALID_SERVICE] };
}

function paymentRequiredFor(payTo: string, overrides: Record<string, unknown> = {}): string {
  return encodePaymentRequiredHeader({
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "hedera:testnet",
        asset: "0.0.0",
        amount: "1000000",
        payTo,
        maxTimeoutSeconds: 300,
        extra: { feePayer: "0.0.9185802" },
        ...overrides,
      },
    ],
    resource: { url: "https://gateway.test/v1/strategy/yield-risk" },
  });
}

const VALID_SUPPORTED = {
  kinds: [{ x402Version: 2, scheme: "exact", network: "hedera:testnet" }],
  extensions: [],
  signers: {},
};

function mirrorTransactions(payer: string, payTo: string, amountTinybars: string): unknown {
  const now = Math.floor(Date.now() / 1000);
  return {
    transactions: [
      {
        transaction_id: "0.0.10329902-1234567890-123456789",
        consensus_timestamp: `${now}.000000000`,
        result: "SUCCESS",
        transfers: [
          { account: payer, amount: -Number(amountTinybars), is_approval: false },
          { account: payTo, amount: Number(amountTinybars), is_approval: false },
        ],
      },
    ],
  };
}

function emptyTransactions(): unknown {
  return { transactions: [] };
}

function confirmEnv(patch: Record<string, string | undefined> = {}): Record<string, string> {
  const key = PrivateKey.generateECDSA();
  return {
    STRATA402_NETWORK: "hedera:testnet",
    STRATA402_PAYER_ACCOUNT_ID: PAYER,
    STRATA402_PAYER_PRIVATE_KEY: key.toStringRaw(),
    STRATA402_ALLOWED_PAYTO: CERTIFIED_PAYTO,
    X402_FACILITATOR_URL: "https://facilitator.test",
    STRATA402_MIRROR_BASE_URL: "https://mirror.test",
    [ENV_RUN_C1]: "true",
    ...patch,
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function endpointRoute(url: string): boolean {
  return url.includes(APPROVED_ROUTE.endpoint);
}

function readsFetch(
  catalogPayTo: string,
  challengePayTo: string,
  sendStatus = 200,
  isConfirmed = false,
  mirror: () => Response = () => json(200, mirrorTransactions(PAYER, CERTIFIED_PAYTO, AMOUNT)),
  acceptOverrides: Record<string, unknown> = {},
): { fetchFn: C1Fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, init: init ?? {} });

    if (!isConfirmed && endpointRoute(url)) {
      return json(402, { error: "payment required" }, { "payment-required": paymentRequiredFor(challengePayTo, acceptOverrides) });
    }
    if (url.includes(DISCOVERY_PATH)) {
      return json(200, makeCatalog(catalogPayTo));
    }
    if (url.includes(FACILITATOR_SUPPORTED_PATH)) {
      return json(200, VALID_SUPPORTED);
    }
    if (url.includes(MIRROR_TRANSACTIONS_PATH)) {
      return mirror();
    }
    if (endpointRoute(url)) {
      if (headers[PAYMENT_SIGNATURE_HEADER] !== undefined) {
        return json(sendStatus, { ok: true });
      }
      return json(402, { error: "payment required" }, { "payment-required": paymentRequiredFor(challengePayTo, acceptOverrides) });
    }
    throw new Error(`readsFetch: no route for ${url}`);
  }) as unknown as C1Fetch;
  return { fetchFn, calls };
}

async function expectC1Error(
  run: () => Promise<unknown>,
  code: C1ErrorCode,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(C1Error);
    expect((error as C1Error).code).toBe(code);
    return;
  }
  throw new Error(`expected C1Error code=${code}, but no error was thrown`);
}

const pendingEnv = () => confirmEnv();

function withGlobalFetch(fetchFn: C1Fetch, body: () => Promise<number>): Promise<number> {
  const original = globalThis.fetch;
  globalThis.fetch = fetchFn as typeof fetch;
  return body().finally(() => {
    globalThis.fetch = original;
  });
}

test("isC1Enabled requires exactly STRATA402_RUN_C1=true", () => {
  expect(isC1Enabled({})).toBe(false);
  expect(isC1Enabled({ [ENV_RUN_C1]: "1" })).toBe(false);
  expect(isC1Enabled({ [ENV_RUN_C1]: "true" })).toBe(true);
  expect(isC1Enabled({ [ENV_RUN_C1]: "true", [ENV_C1_CONFIRM]: "true" })).toBe(true);
});

test("runC1 is closed by default and never touches the network", async () => {
  await expectC1Error(() => runC1({}), "CLOSED_REQUIRED");
});

test("empty certified allow-list fails closed before any network call", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: undefined });

  await expectC1Error(() => runC1({ env, fetchFn }), "ALLOW_LIST_EMPTY");
  expect(calls.length).toBe(0);
});

test("missing facilitator URL fails closed before any network call", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO);
  const env = confirmEnv({ X402_FACILITATOR_URL: undefined });

  await expectC1Error(() => runC1({ env, fetchFn }), "FACILITATOR_URL_MISSING");
  expect(calls.length).toBe(0);
});

test("missing mirror URL fails closed before any network call", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO);
  const env = confirmEnv({ STRATA402_MIRROR_BASE_URL: undefined });

  await expectC1Error(() => runC1({ env, fetchFn }), "MIRROR_URL_MISSING");
  expect(calls.length).toBe(0);
});

test("placeholder payTo 0.0.1234 is rejected with PAYTO_PLACEHOLDER", async () => {
  const { fetchFn, calls } = readsFetch(PLACEHOLDER_PAYTO, PLACEHOLDER_PAYTO, 200, true);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: PLACEHOLDER_PAYTO });

  await expectC1Error(() => runC1({ env, fetchFn }), "PAYTO_PLACEHOLDER");
  expect(calls.some((c) => c.url.includes(FACILITATOR_SUPPORTED_PATH))).toBe(false);
});

test("requests before the placeholder rejection are only discovery+402 (never facilitator/send)", async () => {
  const { fetchFn, calls } = readsFetch(PLACEHOLDER_PAYTO, PLACEHOLDER_PAYTO, 200, true);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: PLACEHOLDER_PAYTO });

  await expectC1Error(() => runC1({ env, fetchFn }), "PAYTO_PLACEHOLDER");
  expect(calls.filter((c) => c.url.includes(DISCOVERY_PATH)).length).toBe(1);
  expect(calls.filter((c) => c.url.includes(APPROVED_ROUTE.endpoint)).length).toBe(1);
});

test("payTo outside the certified allow-list fails closed with PAYTO_NOT_CERTIFIED", async () => {
  const { fetchFn } = readsFetch("0.0.8888", "0.0.8888", 200, true);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: "0.0.9999" });

  await expectC1Error(() => runC1({ env, fetchFn }), "PAYTO_NOT_CERTIFIED");
});

test("payTo mismatch between 402 and catalog fails closed with PAYTO_MISMATCH", async () => {
  const { fetchFn } = readsFetch("0.0.7777", "0.0.8888", 200, true);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: "0.0.7777,0.0.8888" });

  await expectC1Error(() => runC1({ env, fetchFn }), "PAYTO_MISMATCH");
});

test("a wrong network/asset/amount/scheme 402 fails closed before any signature is formed", async () => {
  const cases: Array<{ overrides: Record<string, unknown>; errorCode: string }> = [
    { overrides: { network: "hedera:mainnet" }, errorCode: "NETWORK" },
    { overrides: { asset: "0.0.1" }, errorCode: "ASSET" },
    { overrides: { amount: "2000000" }, errorCode: "AMOUNT" },
    { overrides: { scheme: "approximate" }, errorCode: "SCHEME" },
  ];

  for (const { overrides, errorCode } of cases) {
    const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
    const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 200, true, undefined, overrides);

    await expect(runC1({ env, fetchFn })).rejects.toMatchObject({ code: errorCode });

    const signedCalls = calls.filter((c) => {
      const headers = c.init.headers as Record<string, string> | undefined;
      return headers?.[PAYMENT_SIGNATURE_HEADER] !== undefined;
    });
    expect(signedCalls.length).toBe(0);
    expect(calls.some((c) => c.url.includes(MIRROR_TRANSACTIONS_PATH))).toBe(false);
  }
});

test("payer equal to payTo is rejected with PAYER_EQUALS_PAYTO", async () => {
  const { fetchFn } = readsFetch(PAYER, PAYER, 200, true);
  const env = confirmEnv({ STRATA402_ALLOWED_PAYTO: PAYER });

  await expectC1Error(() => runC1({ env, fetchFn }), "PAYER_EQUALS_PAYTO");
});

test("per-request cap rejects an oversized budget override", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 200, true);
  const env = confirmEnv({ STRATA402_MAX_PER_REQUEST_TINYBARS: "500000" });

  await expectC1Error(() => runC1({ env, fetchFn }), "CAP");
  expect(calls.some((c) => c.url.includes(APPROVED_ROUTE.endpoint))).toBe(true);
});

test("an invalid budget override (below per-request) fails closed as CONFIG", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 200, true);
  const env = confirmEnv({ STRATA402_MAX_TOTAL_BUDGET_TINYBARS: "500000" });

  await expectC1Error(() => runC1({ env, fetchFn }), "CONFIG");
  expect(calls.length).toBe(0);
});

test("confirmed=false prints the safe C1-B summary and signs nothing", async () => {
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO);
  const env = pendingEnv();
  const keyRaw = env.STRATA402_PAYER_PRIVATE_KEY!;

  const report = await runC1({ env, fetchFn, confirmed: false });

  expect(report.phase).toBe("C1-paid");
  expect(report.status).toBe("awaiting-confirm");
  expect(report.network).toBe("hedera:testnet");
  expect(report.scheme).toBe("exact");
  expect(report.asset).toBe(ALLOWED_ASSET);
  expect(report.amountTinybars).toBe(AMOUNT);
  expect(report.amountHbar).toBe("0.01 HBAR");
  expect(report.payerAccountId).toBe(PAYER);
  expect(report.payTo).toBe(CERTIFIED_PAYTO);
  expect(report.checks).toEqual({
    networkMatch: "PASS",
    schemeMatch: "PASS",
    amountMatch: "PASS",
    payToCatalogMatch: "PASS",
    payToCertified: "PASS",
    payerVsPayTo: "PASS",
    budget: "PASS",
    requestCount: C1_REQUEST_COUNT,
  });
  expect(report.traffic.discoveryReads).toBe(1);
  expect(report.traffic.challengeReads).toBe(1);
  expect(report.traffic.facilitatorReads).toBe(1);
  expect(report.traffic.paymentSends).toBe(0);
  expect(report.evidence).toBeNull();

  expect(calls.length).toBe(3);
  for (const call of calls) {
    const headers = call.init.headers as Record<string, string> | undefined;
    expect(headers?.[PAYMENT_SIGNATURE_HEADER]).toBeUndefined();
  }

  const serialized = JSON.stringify(report);
  expect(serialized).not.toContain(keyRaw);
  expect(serialized).not.toContain("payment-signature");
  expect(serialized).not.toContain("transaction_id");
});

test("runCliC1 without confirmation returns EXIT_AWAITING_CONFIRM (no network in the stub)", async () => {
  const env = pendingEnv();
  const { fetchFn } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO);
  const code = await withGlobalFetch(fetchFn, () => runCliC1(env));
  expect(code).toBe(EXIT_AWAITING_CONFIRM);
});

test("success requires BOTH the settled 2xx and verified mirror settlement evidence", async () => {
  const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const keyRaw = env.STRATA402_PAYER_PRIVATE_KEY!;
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 200, true);

  const report = await runC1({
    env,
    fetchFn,
    settlementAttempts: 1,
    settlementDelayMs: 0,
  });

  expect(report.status).toBe("success");
  expect(report.evidence).not.toBeNull();
  expect(report.evidence?.paymentStatus).toBe("settled");
  expect(report.evidence?.phase).toBe("settled");
  expect(report.evidence?.httpStatus).toBe(200);
  expect(report.traffic.paymentSends).toBe(1);
  expect(report.traffic.settlementReads).toBe(1);

  expect(report.settlement).not.toBeNull();
  expect(report.settlement!.network).toBe("hedera:testnet");
  expect(report.settlement!.transactionId).toMatch(/^0\.0\.10329902-/);
  expect(report.settlement!.payerAccountId).toBe(PAYER);
  expect(report.settlement!.recipientAccountId).toBe(CERTIFIED_PAYTO);
  expect(report.settlement!.amountTinybars).toBe(AMOUNT);

  const signedCalls = calls.filter((c) => {
    const headers = c.init.headers as Record<string, string> | undefined;
    return headers?.[PAYMENT_SIGNATURE_HEADER] !== undefined;
  });
  expect(signedCalls.length).toBe(1);
  const headerValue = (signedCalls[0]!.init.headers as Record<string, string>)[PAYMENT_SIGNATURE_HEADER];

  const serialized = JSON.stringify(report);
  expect(serialized).toContain(report.settlement!.transactionId);
  expect(serialized).not.toContain(keyRaw);
  expect(serialized).not.toContain(headerValue);
  expect(serialized).not.toContain("payment-signature");
});

test("a settled 2xx without mirror evidence is settled_unverified, not success", async () => {
  const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn, calls } = readsFetch(
    CERTIFIED_PAYTO,
    CERTIFIED_PAYTO,
    200,
    true,
    () => json(200, emptyTransactions()),
  );

  const report = await runC1({
    env,
    fetchFn,
    settlementAttempts: 1,
    settlementDelayMs: 0,
  });

  expect(report.status).toBe("settled_unverified");
  expect(report.settlement).toBeNull();
  expect(report.evidence?.paymentStatus).toBe("settled");
  expect(report.traffic.paymentSends).toBe(1);
  expect(report.traffic.settlementReads).toBe(1);
});

test("a 402 payment rejection is terminal: payment_rejected, no mirror read", async () => {
  const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 402, true);

  const report = await runC1({ env, fetchFn });

  expect(report.status).toBe("payment_rejected");
  expect(report.evidence?.httpStatus).toBe(402);
  expect(report.settlement).toBeNull();
  expect(calls.some((c) => c.url.includes(MIRROR_TRANSACTIONS_PATH))).toBe(false);
});

test("a 409 duplicate is terminal: duplicate, no mirror read, never resent", async () => {
  const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 409, true);

  const report = await runC1({ env, fetchFn });

  expect(report.status).toBe("duplicate");
  expect(report.evidence?.httpStatus).toBe(409);
  const signedCalls = calls.filter((c) => {
    const headers = c.init.headers as Record<string, string> | undefined;
    return headers?.[PAYMENT_SIGNATURE_HEADER] !== undefined;
  });
  expect(signedCalls.length).toBe(1);
  expect(calls.some((c) => c.url.includes(MIRROR_TRANSACTIONS_PATH))).toBe(false);
});

test("a 5xx outcome is undetermined with no auto retry", async () => {
  const env = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn, calls } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 500, true);

  const report = await runC1({ env, fetchFn });

  expect(report.status).toBe("undetermined");
  expect(report.evidence?.httpStatus).toBe(500);
  expect(calls.some((c) => c.url.includes(MIRROR_TRANSACTIONS_PATH))).toBe(false);
});

test("runCliC1 maps success and terminal failures to the documented exit codes", async () => {
  const closedCode = await runCliC1({});
  expect(closedCode).toBe(EXIT_OK);

  const successEnv = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn: okFetch } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 200, true);
  const okCode = await withGlobalFetch(okFetch, () => runCliC1(successEnv));
  expect(okCode).toBe(EXIT_OK);

  const misconfigEnv = confirmEnv({
    [ENV_C1_CONFIRM]: "true",
    STRATA402_ALLOWED_PAYTO: undefined,
  });
  const misconfigCode = await withGlobalFetch(okFetch, () => runCliC1(misconfigEnv));
  expect(misconfigCode).toBe(EXIT_MISCONFIG);

  const rejectedEnv = confirmEnv({ [ENV_C1_CONFIRM]: "true" });
  const { fetchFn: rejectedFetch } = readsFetch(CERTIFIED_PAYTO, CERTIFIED_PAYTO, 402, true);
  const rejectedCode = await withGlobalFetch(rejectedFetch, () => runCliC1(rejectedEnv));
  expect(rejectedCode).toBe(EXIT_PAYMENT_FAILED);
});

test("findMatchingTransaction requires payer+payTo+amount+SUCCESS", () => {
  const ok = mirrorTransactions(PAYER, CERTIFIED_PAYTO, AMOUNT);
  const match = findMatchingTransaction(ok, PAYER, CERTIFIED_PAYTO, AMOUNT);
  expect(match).not.toBeNull();
  expect(match!.transactionId).toMatch(/^0\.0\.10329902-/);

  const wrongPayTo = findMatchingTransaction(ok, PAYER, "0.0.9999", AMOUNT);
  expect(wrongPayTo).toBeNull();

  const wrongAmount = findMatchingTransaction(ok, PAYER, CERTIFIED_PAYTO, "2000000");
  expect(wrongAmount).toBeNull();

  const wrongPayer = findMatchingTransaction(ok, "0.0.11111", CERTIFIED_PAYTO, AMOUNT);
  expect(wrongPayer).toBeNull();

  const failed = {
    transactions: [
      {
        transaction_id: "0.0.10329902-0000000000-000000000",
        result: "INVALID_RECORD",
        transfers: [
          { account: PAYER, amount: -Number(AMOUNT), is_approval: false },
          { account: CERTIFIED_PAYTO, amount: Number(AMOUNT), is_approval: false },
        ],
      },
    ],
  };
  expect(findMatchingTransaction(failed, PAYER, CERTIFIED_PAYTO, AMOUNT)).toBeNull();

  expect(findMatchingTransaction(null, PAYER, CERTIFIED_PAYTO, AMOUNT)).toBeNull();
  expect(findMatchingTransaction({}, PAYER, CERTIFIED_PAYTO, AMOUNT)).toBeNull();
});

test("findMatchingTransaction prefers newest SUCCESS and respects notBeforeSeconds", () => {
  const raw = {
    transactions: [
      {
        transaction_id: "0.0.9185802-100-1",
        consensus_timestamp: "1789232649.178711760",
        result: "SUCCESS",
        transfers: [
          { account: PAYER, amount: -Number(AMOUNT), is_approval: false },
          { account: CERTIFIED_PAYTO, amount: Number(AMOUNT), is_approval: false },
        ],
      },
      {
        transaction_id: "0.0.9185802-200-2",
        consensus_timestamp: "1789237158.890204035",
        result: "SUCCESS",
        transfers: [
          { account: PAYER, amount: -Number(AMOUNT), is_approval: false },
          { account: CERTIFIED_PAYTO, amount: Number(AMOUNT), is_approval: false },
        ],
      },
    ],
  };

  const newest = findMatchingTransaction(raw, PAYER, CERTIFIED_PAYTO, AMOUNT);
  expect(newest?.transactionId).toBe("0.0.9185802-200-2");

  const filtered = findMatchingTransaction(raw, PAYER, CERTIFIED_PAYTO, AMOUNT, 1789237000);
  expect(filtered?.transactionId).toBe("0.0.9185802-200-2");

  const staleOnly = findMatchingTransaction(raw, PAYER, CERTIFIED_PAYTO, AMOUNT, 1789238000);
  expect(staleOnly).toBeNull();
});

test("verifySettlementEvidence returns null without retrying when nothing matches (no send)", async () => {
  const seen: number[] = [];
  const fetchFn = (async () => {
    seen.push(1);
    return json(200, emptyTransactions());
  }) as unknown as C1Fetch;

  const evidence = await verifySettlementEvidence({
    payerAccountId: PAYER,
    payTo: CERTIFIED_PAYTO,
    amountTinybars: AMOUNT,
    network: "hedera:testnet",
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    attempts: 1,
    delayMs: 0,
  });

  expect(evidence).toBeNull();
  expect(seen.length).toBe(1);
});
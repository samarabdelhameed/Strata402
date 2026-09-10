import { test, expect } from "bun:test";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import {
  APPROVED_ROUTE,
  DISCOVERY_PATH,
  ENV_RUN_C0,
  EXIT_OK,
  FACILITATOR_SUPPORTED_PATH,
  FacilitatorReadError,
  MirrorReadError,
  PreflightError,
  isC0Enabled,
  parseAllowedPayTos,
  runCliC0,
  runPreflight,
} from "@strata402/consuming-agent";
import type {
  FacilitatorReadErrorCode,
  MirrorReadErrorCode,
  PreflightErrorCode,
  PreflightFetch,
} from "@strata402/consuming-agent";

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

function paymentRequiredFor(payTo: string): string {
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

const VALID_MIRROR_ACCOUNT = {
  account: "0.0.10329902",
  balance: { balance: "500000000000000000000", timestamp: "2026-09-10T00:00:00.000Z" },
};

function envFor(patch: Record<string, string | undefined> = {}): Record<string, string> {
  return {
    STRATA402_NETWORK: "hedera:testnet",
    STRATA402_PAYER_ACCOUNT_ID: "0.0.10329902",
    STRATA402_ALLOWED_PAYTO: "0.0.7777",
    X402_FACILITATOR_URL: "https://facilitator.test",
    STRATA402_MIRROR_BASE_URL: "https://mirror.test",
    ...patch,
  };
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function routingFetch(
  routes: Array<{ match: (url: string) => boolean; respond: () => Response }>,
): { fetchFn: PreflightFetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const route = routes.find((r) => r.match(url));
    if (route === undefined) {
      throw new Error(`routingFetch: no route for ${url}`);
    }
    return route.respond();
  }) as unknown as PreflightFetch;
  return { fetchFn, calls };
}

function standardRoutes(
  catalogPayTo: string,
  challengePayTo: string,
  supported: unknown = VALID_SUPPORTED,
  mirror: () => Response = () => json(200, VALID_MIRROR_ACCOUNT),
): Array<{ match: (url: string) => boolean; respond: () => Response }> {
  return [
    {
      match: (url) => url.includes(DISCOVERY_PATH),
      respond: () => json(200, makeCatalog(catalogPayTo)),
    },
    {
      match: (url) => url.includes(APPROVED_ROUTE.endpoint),
      respond: () =>
        json(402, { error: "payment required" }, { "payment-required": paymentRequiredFor(challengePayTo) }),
    },
    {
      match: (url) => url.includes(FACILITATOR_SUPPORTED_PATH),
      respond: () => json(200, supported),
    },
    {
      match: (url) => url.includes("/api/v1/accounts/"),
      respond: mirror,
    },
  ];
}

async function expectPreflightError(
  run: () => Promise<unknown>,
  code: PreflightErrorCode,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(PreflightError);
    expect((error as PreflightError).code).toBe(code);
    return;
  }
  throw new Error(`expected PreflightError code=${code}, but no error was thrown`);
}

test("C0 preflight passes with a certified payTo, no private key, and zero traffic", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const report = await runPreflight({ env: envFor(), fetchFn });

  expect(report.phase).toBe("C0-preflight");
  expect(report.status).toBe("ok");
  expect(report.network).toBe("hedera:testnet");
  expect(report.payerAccountId).toBe("0.0.10329902");
  expect(report.payerExists).toBe(true);
  expect(report.payerBalanceTinybars).toBe("500000000000000000000");
  expect(report.serviceId).toBe("yield-risk");
  expect(report.priceTinybars).toBe(1_000_000);
  expect(report.payTo).toBe("0.0.7777");
  expect(report.payToCertified).toBe(true);
  expect(report.facilitatorUrl).toBe("https://facilitator.test");
  expect(report.facilitatorKindMatched).toBe(true);
  expect(report.budgetRemainingTinybars).toBe("100000000");
  expect(report.traffic).toEqual({ signaturesSent: 0, verifyCalls: 0, settleCalls: 0, spendHbar: 0 });

  expect(calls.some((c) => c.url.includes(FACILITATOR_SUPPORTED_PATH))).toBe(true);
  expect(calls.some((c) => c.url.includes("/api/v1/accounts/"))).toBe(true);

  const reportKeys = Object.keys(report);
  expect(reportKeys).not.toContain("payloadDigest");
  expect(reportKeys).not.toContain("headerDigest");
  expect(JSON.stringify(report)).not.toContain("transaction");
});

test("preflight sends exactly the four approved read requests and never verify/settle or PAYMENT-SIGNATURE", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const report = await runPreflight({ env: envFor(), fetchFn });

  expect(calls.length).toBe(4);
  expect(calls.filter((c) => c.url.includes(DISCOVERY_PATH)).length).toBe(1);
  expect(calls.filter((c) => c.url.includes(APPROVED_ROUTE.endpoint)).length).toBe(1);
  expect(calls.filter((c) => c.url.includes(FACILITATOR_SUPPORTED_PATH)).length).toBe(1);
  expect(calls.filter((c) => c.url.includes("/api/v1/accounts/")).length).toBe(1);

  for (const call of calls) {
    expect(call.url).not.toMatch(/verify|settle|payment-signature/i);
    const headers = call.init.headers as Record<string, string> | undefined;
    expect(headers?.["payment-signature"]).toBeUndefined();
  }

  expect(report.traffic.signaturesSent).toBe(0);
  expect(report.traffic.verifyCalls).toBe(0);
  expect(report.traffic.settleCalls).toBe(0);
});

test("C0 preflight never requires or reads the payer private key", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const env = envFor({ STRATA402_PAYER_PRIVATE_KEY: undefined });
  const report = await runPreflight({ env, fetchFn });

  expect(report.status).toBe("ok");
  expect(report.payerAccountId).toBe("0.0.10329902");
  expect(calls.length).toBe(4);
});

test("missing facilitator URL fails closed with FACILITATOR_URL_MISSING before any network call", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const env = envFor({ X402_FACILITATOR_URL: undefined });

  await expectPreflightError(() => runPreflight({ env, fetchFn }), "FACILITATOR_URL_MISSING");
  expect(calls.length).toBe(0);
});

test("missing mirror URL fails closed with MIRROR_URL_MISSING before any network call", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const env = envFor({ STRATA402_MIRROR_BASE_URL: undefined });

  await expectPreflightError(() => runPreflight({ env, fetchFn }), "MIRROR_URL_MISSING");
  expect(calls.length).toBe(0);
});

test("empty certified allow-list fails closed with PAYTO_NOT_CERTIFIED before any network call", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const env = envFor({ STRATA402_ALLOWED_PAYTO: undefined });

  await expectPreflightError(() => runPreflight({ env, fetchFn }), "PAYTO_NOT_CERTIFIED");
  expect(calls.length).toBe(0);
});

test("payTo mismatch between 402 and catalog fails closed with PAYTO_MISMATCH", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.7777", "0.0.8888"));

  await expectPreflightError(() => runPreflight({ env: envFor(), fetchFn }), "PAYTO_MISMATCH");
  expect(calls.some((c) => c.url.includes(FACILITATOR_SUPPORTED_PATH))).toBe(false);
  expect(calls.some((c) => c.url.includes("/api/v1/accounts/"))).toBe(false);
});

test("placeholder payTo 0.0.1234 is rejected with PAYTO_PLACEHOLDER", async () => {
  const { fetchFn, calls } = routingFetch(standardRoutes("0.0.1234", "0.0.1234"));

  await expectPreflightError(() => runPreflight({ env: envFor(), fetchFn }), "PAYTO_PLACEHOLDER");
  expect(calls.some((c) => c.url.includes(FACILITATOR_SUPPORTED_PATH))).toBe(false);
  expect(calls.some((c) => c.url.includes("/api/v1/accounts/"))).toBe(false);
});

test("payTo outside the certified allow-list fails closed with PAYTO_NOT_CERTIFIED", async () => {
  const { fetchFn } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const env = envFor({ STRATA402_ALLOWED_PAYTO: "0.0.9999" });

  await expectPreflightError(() => runPreflight({ env, fetchFn }), "PAYTO_NOT_CERTIFIED");
});

test("facilitator without the exact testnet kind fails closed with KIND_UNSUPPORTED", async () => {
  const unsupported = {
    kinds: [{ x402Version: 2, scheme: "fixed", network: "hedera:testnet" }],
    extensions: [],
    signers: {},
  };
  const { fetchFn, calls } = routingFetch(
    standardRoutes("0.0.7777", "0.0.7777", unsupported),
  );

  try {
    await runPreflight({ env: envFor(), fetchFn });
  } catch (error) {
    expect(error).toBeInstanceOf(FacilitatorReadError);
    expect((error as FacilitatorReadError).code).toBe<FacilitatorReadErrorCode>("KIND_UNSUPPORTED");
    expect(calls.some((c) => c.url.includes("/api/v1/accounts/"))).toBe(false);
    return;
  }
  throw new Error("expected kind KIND_UNSUPPORTED, but no error was thrown");
});

test("missing mirror account fails closed with ACCOUNT_NOT_FOUND (404)", async () => {
  const { fetchFn } = routingFetch(
    standardRoutes("0.0.7777", "0.0.7777", VALID_SUPPORTED, () => json(404, { _status: { messages: [] } })),
  );

  try {
    await runPreflight({ env: envFor(), fetchFn });
  } catch (error) {
    expect(error).toBeInstanceOf(MirrorReadError);
    expect((error as MirrorReadError).code).toBe<MirrorReadErrorCode>("ACCOUNT_NOT_FOUND");
    return;
  }
  throw new Error("expected code ACCOUNT_NOT_FOUND, but no error was thrown");
});

test("unreadable mirror balance fails closed with BALANCE_UNREADABLE", async () => {
  const broken = { account: "0.0.10329902", balance: { timestamp: "2026-09-10T00:00:00.000Z" } };
  const { fetchFn } = routingFetch(
    standardRoutes("0.0.7777", "0.0.7777", VALID_SUPPORTED, () => json(200, broken)),
  );

  try {
    await runPreflight({ env: envFor(), fetchFn });
  } catch (error) {
    expect(error).toBeInstanceOf(MirrorReadError);
    expect((error as MirrorReadError).code).toBe<MirrorReadErrorCode>("BALANCE_UNREADABLE");
    return;
  }
  throw new Error("expected code BALANCE_UNREADABLE, but no error was thrown");
});

test("parseAllowedPayTos trims, splits, and drops empty entries", () => {
  const env = { STRATA402_ALLOWED_PAYTO: " 0.0.1 , 0.0.2 ,, 0.0.3 " };
  expect(parseAllowedPayTos(env)).toEqual(["0.0.1", "0.0.2", "0.0.3"]);
});

test("C0 CLI is closed by default and returns EXIT_OK without any network attempt", async () => {
  expect(isC0Enabled({})).toBe(false);
  expect(isC0Enabled({ [ENV_RUN_C0]: "1" })).toBe(false);
  expect(isC0Enabled({ [ENV_RUN_C0]: "true" })).toBe(true);

  const exitCode = await runCliC0({});
  expect(exitCode).toBe(EXIT_OK);
});

test("C0 report serializes as a plain JSON object for the C0->C1 gate", async () => {
  const { fetchFn } = routingFetch(standardRoutes("0.0.7777", "0.0.7777"));
  const report = await runPreflight({ env: envFor(), fetchFn });

  const serialized = JSON.stringify(report);
  expect(serialized).toMatch(/^\{/);
  expect(serialized).toContain('"phase":"C0-preflight"');
  expect(serialized.length).toBeGreaterThan(100);
});
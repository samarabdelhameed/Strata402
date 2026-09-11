import { test, expect } from "bun:test";
import {
  ANALYSIS_SOURCE,
  buildNarrative,
  createYieldRiskHandler,
  invalidYieldRiskContract,
} from "@strata402/api-gateway/analyst";
import { MirrorReadError } from "@strata402/api-gateway/mirror";

// Unit-only handler tests. A fixture fetch provides a clearly-labeled local
// mirror payload (never presented as a live result). Live integration coverage
// lives in the RUN_MIRROR_INTEGRATION / RUN_GATEWAY_INTEGRATION suites.

const ACCOUNT = "0.0.7777";
const FIXTURE_NOW = 2_000_000_100;
const STALE_REMOTE = "1000000000.000000000";
const FRESH_REMOTE = "2000000000.000000000";

const VALID_BODY = { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: 100 };

function mirrorFixtureFetch(options: {
  fail?: boolean;
  balanceTimestamp?: string;
  latestTimestamp?: string;
  balanceTinybars?: string;
}): () => { fetchFn: typeof fetch; calls: () => number } {
  let calls = 0;
  const fetchFn = (async (input: string | URL | Request): Promise<Response> => {
    calls += 1;
    const url = String(input);
    if (options.fail === true) {
      return new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/v1/accounts/")) {
      return new Response(
        JSON.stringify({
          account: ACCOUNT,
          balance: {
            balance: options.balanceTinybars ?? "1000000000",
            timestamp: options.balanceTimestamp ?? FRESH_REMOTE,
          },
          created_timestamp: "1500000000.000000000",
          deleted: false,
          tokens: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/v1/transactions")) {
      return new Response(
        JSON.stringify({
          transactions: [
            {
              transaction_id: "0.0.7777-0000000000-000000000",
              consensus_timestamp: options.latestTimestamp ?? FRESH_REMOTE,
              result: "SUCCESS",
              transfers: [{ account: ACCOUNT, amount: 1000000 }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`fixture fetch: no route for ${url}`);
  }) as unknown as typeof fetch;
  return () => ({ fetchFn, calls: () => calls });
}

function run(handler: (req: never, res: never) => Promise<void>, body: unknown) {
  let status = 0;
  let payload: Record<string, unknown> | null = null;
  const req = { body } as never;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    setHeader(_name: string, _value: string) {
      return this;
    },
    json(p: Record<string, unknown>) {
      payload = p;
      return this;
    },
  } as never;
  return handler(req, res).then(() => ({ status, payload }));
}

function boot(fetchFn: typeof fetch, nowSeconds = FIXTURE_NOW) {
  return createYieldRiskHandler({ mirrorBaseUrl: "https://mirror.test", fetchFn, nowSeconds });
}

test("a valid contract produces a 200 with honest metadata and mirror facts", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({})();
  const handler = boot(fetchFn);
  const { status, payload } = await run(handler, VALID_BODY);

  expect(status).toBe(200);
  expect(payload!.status).toBe("success");
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.source).toBe(ANALYSIS_SOURCE);
  expect(analysis.scope).toBe("account-level on-chain risk");
  expect(analysis.dataTimestamp).toBe(FRESH_REMOTE);
  expect(analysis.freshnessHealth).toBe("fresh");
  expect((analysis.observed as Record<string, unknown>).balance).toBeTruthy();
  expect(analysis.unavailable).toContain("live pool APY");
  expect(calls()).toBe(2);
  expect("riskScore" in analysis).toBe(false);
  expect("confidence" in analysis).toBe(false);
});

test("the response carries a deterministic narrative from real facts only", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({
    balanceTinybars: "1500000000",
    balanceTimestamp: FRESH_REMOTE,
    latestTimestamp: FRESH_REMOTE,
  })();
  const handler = boot(fetchFn);
  const { status, payload } = await run(handler, VALID_BODY);

  expect(status).toBe(200);
  const analysis = payload!.analysis as Record<string, unknown>;
  const narrative = analysis.narrative as Record<string, unknown>;
  expect(narrative.generatedBy).toBe("deterministic");
  expect(narrative.llm).toBe(false);
  expect(Array.isArray(narrative.points)).toBe(true);
  const joined = (narrative.points as string[]).join("\n");
  expect(joined).toContain(ACCOUNT);
  expect(joined).toContain("15 HBAR");
  expect(joined).toContain("fresh");
  expect(String(narrative.summary)).toContain("No LLM involved");
  expect(calls()).toBe(2);
});

test("narrative avoids fabricated numbers beyond the supplied facts", () => {
  const narrative = buildNarrative(
    {
      account: { accountId: "0.0.7777", exists: true, deleted: false, createdTimestamp: "1500000000.000000000" },
      balance: { tinybars: "1000000", hbar: "0.01", timestamp: "2000000000.000000000", tokenBalancesCount: 0 },
      recent30d: {
        transactionCount: 1,
        hbarInTinybars: "1000000",
        hbarOutTinybars: "0",
        latestTimestamp: "2000000000.000000000",
      },
    },
    { net30dTinybars: "1000000" },
    "fresh",
  );
  expect(narrative.points.join("\n")).toContain("0.01 HBAR");
  expect(narrative.points.join("\n")).toContain("net 0.01 HBAR");
});

test("contract violations are rejected with HTTP 400 before any mirror read", async () => {
  const badBodies: Array<Record<string, unknown>> = [
    {},
    { accountId: "not-an-account", riskTolerance: "balanced", amountHbar: 1 },
    { accountId: ACCOUNT, riskTolerance: "extreme", amountHbar: 1 },
    { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: 0 },
    { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: -5 },
    { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: NaN },
    { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: Infinity },
    { accountId: ACCOUNT, riskTolerance: "balanced", amountHbar: 0.123456789 },
  ];
  for (const body of badBodies) {
    const { fetchFn, calls } = mirrorFixtureFetch({})();
    const handler = boot(fetchFn);
    const { status, payload } = await run(handler, body);
    expect(status).toBe(400);
    expect(payload!.code).toBe("invalid_request_contract");
    expect(Array.isArray(payload!.issues)).toBe(true);
    expect(calls()).toBe(0);
  }
});

test("mirror-unavailable degrades to a controlled dataUnavailable response, never fabricated data", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({ fail: true })();
  const handler = boot(fetchFn);
  const { status, payload } = await run(handler, VALID_BODY);

  expect(status).toBe(200);
  expect(payload!.status).toBe("success");
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.dataUnavailable).toBe(true);
  const indications = analysis.indications as Record<string, unknown>;
  expect(indications.accountNotReadable).toBe(true);
  expect(String(indications.reason)).toContain("mirror read failed");
  const narrative = analysis.narrative as Record<string, unknown>;
  expect(narrative.generatedBy).toBe("deterministic");
  expect(narrative.llm).toBe(false);
  expect(String(narrative.summary)).toContain("no account facts");
  expect(payload!.disclaimer).toBeTruthy();
  expect(calls()).toBe(1);
});

test("stale mirror timestamps surface a freshness warning", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({ balanceTimestamp: STALE_REMOTE, latestTimestamp: STALE_REMOTE })();
  const handler = boot(fetchFn);
  const { status, payload } = await run(handler, VALID_BODY);

  expect(status).toBe(200);
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.freshnessHealth).toBe("stale");
  const freshness = analysis.freshness as Record<string, unknown>;
  expect(freshness.ageSeconds).toBeGreaterThan(0);
  expect(calls()).toBe(2);
});

test("invalidYieldRiskContract builds a stable machine-readable body", () => {
  const body = invalidYieldRiskContract(["missing_accountId", "non_positive_amountHbar"]);
  expect(body).toEqual({
    status: "error",
    code: "invalid_request_contract",
    message: "Request does not satisfy the yield-risk contract: missing_accountId, non_positive_amountHbar",
    issues: ["missing_accountId", "non_positive_amountHbar"],
  });
});

test("mirror client still fails closed on a non-200 account read", async () => {
  const fetchFn = (async () =>
    new Response("{}", { status: 500, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const { readMirrorAccountSnapshot } = await import("@strata402/api-gateway/mirror");
  await expect(
    readMirrorAccountSnapshot(ACCOUNT, "https://mirror.test", { fetchFn }),
  ).rejects.toThrow(MirrorReadError);
});

test("audit hook receives a 200 paid event with a requestId and endpoint", async () => {
  const { fetchFn } = mirrorFixtureFetch({})();
  const events: Array<Record<string, unknown>> = [];
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    auditHcs: async (event) => {
      events.push(event as unknown as Record<string, unknown>);
      return undefined;
    },
  });

  const { status } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  expect(events).toHaveLength(1);
  expect(events[0]!.endpoint).toBe("/v1/strategy/yield-risk");
  expect(events[0]!.status).toBe("200");
  expect(typeof events[0]!.requestId).toBe("string");
  expect(String(events[0]!.requestId)).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
});

test("audit hook is not invoked for rejected (400) contracts", async () => {
  const { fetchFn } = mirrorFixtureFetch({})();
  const events: Array<Record<string, unknown>> = [];
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    auditHcs: async (event) => {
      events.push(event as unknown as Record<string, unknown>);
      return undefined;
    },
  });

  const { status } = await run(handler, {});
  expect(status).toBe(400);
  expect(events).toHaveLength(0);
});

test("audit hook failure never fails the paid 200 response (fail-open)", async () => {
  const { fetchFn } = mirrorFixtureFetch({})();
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    auditHcs: async () => {
      throw new Error("HCS topic unreachable");
    },
  });

  const { status, payload } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  expect(payload!.status).toBe("success");
});

test("disabled ai engine falls back to in-process deterministic analysis", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({})();
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    aiEngine: { enabled: false, callYieldRisk: async () => ({ url: "", status: 0, ok: false, body: null }) },
  });

  const { status, payload } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.source).toBe(ANALYSIS_SOURCE);
  expect(calls()).toBe(2);
});

test("unreachable ai engine falls back to in-process deterministic analysis", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({})();
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    aiEngine: {
      enabled: true,
      callYieldRisk: async () => ({ url: "http://localhost:8000", status: 0, ok: false, body: null }),
    },
  });

  const { status, payload } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.source).toBe(ANALYSIS_SOURCE);
  expect(calls()).toBe(2);
});

test("engine-produced success response is passed through verbatim", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({})();
  const engineBody = {
    status: "success",
    service: "strata402-ai-engine",
    request: VALID_BODY,
    analysis: { scope: "account-level on-chain risk", source: "hedera-mirror-node", narrative: { generatedBy: "deterministic", llm: false }, unavailable: [], limitations: [] },
    payment: { protocol: "x402", version: 2, network: "hedera:testnet", asset: "0.0.0", amountTinybars: "1000000" },
    disclaimer: "Not financial advice.",
  };
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    aiEngine: {
      enabled: true,
      callYieldRisk: async () => ({ url: "http://localhost:8000", status: 200, ok: true, body: engineBody }),
    },
  });

  const { status, payload } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  expect(payload!.status).toBe("success");
  expect(payload!.service).toBe("strata402-ai-engine");
  expect(calls()).toBe(0);
});

test("malformed engine response falls back to in-process deterministic analysis", async () => {
  const { fetchFn, calls } = mirrorFixtureFetch({})();
  const handler = createYieldRiskHandler({
    mirrorBaseUrl: "https://mirror.test",
    fetchFn,
    aiEngine: {
      enabled: true,
      callYieldRisk: async () => ({ url: "http://localhost:8000", status: 200, ok: true, body: { status: "boom" } }),
    },
  });

  const { status, payload } = await run(handler, VALID_BODY);
  expect(status).toBe(200);
  const analysis = payload!.analysis as Record<string, unknown>;
  expect(analysis.source).toBe(ANALYSIS_SOURCE);
  expect(calls()).toBe(2);
});
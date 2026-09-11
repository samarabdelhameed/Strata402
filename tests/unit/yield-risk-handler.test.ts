import { test, expect } from "bun:test";
import {
  ANALYSIS_SOURCE,
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
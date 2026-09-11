import { test, expect } from "bun:test";
import {
  ANALYSIS_SOURCE,
  createYieldRiskHandler,
  resolveAnalysisAccount,
  analyzeMirrorRead,
  UNVAILABLE_FEATURES,
} from "@strata402/api-gateway/analyst";
import { readMirrorAccountSnapshot, MirrorReadError } from "@strata402/api-gateway/mirror";

const RUN_MIRROR_INTEGRATION = process.env.RUN_MIRROR_INTEGRATION === "true";
const MIRROR_BASE_URL =
  process.env.STRATA402_MIRROR_BASE_URL || "https://testnet.mirrornode.hedera.com";
const SERVICE_ACCOUNT = process.env.HEDERA_SERVICE_ACCOUNT_ID || "0.0.10464194";

const run = RUN_MIRROR_INTEGRATION ? test : test.skip;

run("real Testnet Mirror read of the service account exposes honest on-chain facts", async () => {
  const read = await readMirrorAccountSnapshot(SERVICE_ACCOUNT, MIRROR_BASE_URL);
  const analysis = analyzeMirrorRead(read, "hedera:testnet");

  expect(analysis.status).toBe("ok");
  expect(analysis.analysisSource).toBe(ANALYSIS_SOURCE);
  expect(analysis.account).toBe(SERVICE_ACCOUNT);
  expect(analysis.network).toBe("hedera:testnet");
  expect(analysis.indicators.exists).toBe(true);
  expect(BigInt(analysis.indicators.balanceTinybars)).toBeGreaterThanOrEqual(0n);
  expect(analysis.scope).toBe("account-level on-chain risk");
  expect(analysis.protocolAdapters).toEqual([]);
  expect(analysis.unavailable).toEqual([...UNVAILABLE_FEATURES]);
  expect(analysis.unavailable).toContain("live pool APY");
  expect(analysis.unavailable).toContain("SaucerSwap data");
  expect(analysis.unavailable).toContain("Bonzo data");
});

run("real Testnet paid-handler response for the default service account is a 200 with mirror facts", async () => {
  const handler = createYieldRiskHandler({ mirrorBaseUrl: MIRROR_BASE_URL });

  let status = 0;
  let body: Record<string, unknown> | null = null;
  const req = { body: {} } as never;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    setHeader(_name: string, _value: string) {
      return this;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return this;
    },
  } as never;

  await (handler as (r: never, s: never) => Promise<void>)(req, res);

  expect(status).toBe(200);
  expect(body).not.toBeNull();
  const record = body!;
  expect(record.analysisSource).toBe(ANALYSIS_SOURCE);
  expect(record.protocolAdapters).toEqual([]);
  expect(record.unavailable).toContain("live pool APY");
}, 15000);

test("resolveAnalysisAccount honors explicit accountId else defaults to service account", () => {
  expect(resolveAnalysisAccount({ accountId: "0.0.12345" }, "0.0.10464194")).toBe("0.0.12345");
  expect(resolveAnalysisAccount({ accountId: "not-an-account" }, "0.0.10464194")).toBe("0.0.10464194");
  expect(resolveAnalysisAccount({}, "0.0.10464194")).toBe("0.0.10464194");
  expect(resolveAnalysisAccount(null, "0.0.10464194")).toBe("0.0.10464194");
  expect(resolveAnalysisAccount({ accountId: 0 }, "0.0.10464194")).toBe("0.0.10464194");
});

test("a non-200 mirror response is surfaced as an honest degraded read, never fabricated data", async () => {
  const fetchFn = (async () =>
    new Response("{}", { status: 500, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

  await expect(
    readMirrorAccountSnapshot("0.0.7777", "https://mirror.test", { fetchFn }),
  ).rejects.toThrow(MirrorReadError);
});
import { test, expect } from "bun:test";
import {
  ANALYSIS_SCOPE,
  ANALYSIS_SOURCE,
  SERVICE_NAME,
  analyzeMirrorRead,
  createYieldRiskHandler,
  UNVAILABLE_FEATURES,
} from "@strata402/api-gateway/analyst";
import {
  ANALYSIS_LIMITATIONS,
  DISCLAIMER,
  type YieldRiskContract,
} from "@strata402/x402-sdk";
import { readMirrorAccountSnapshot } from "@strata402/api-gateway/mirror";

// Live integration suite: real Hedera Testnet Mirror Node, closed by default.
// No fixtures, no mock fetch, no fabricated balances.
const RUN_MIRROR_INTEGRATION = process.env.RUN_MIRROR_INTEGRATION === "true";
const MIRROR_BASE_URL =
  process.env.STRATA402_MIRROR_BASE_URL || "https://testnet.mirrornode.hedera.com";
const SERVICE_ACCOUNT = process.env.HEDERA_SERVICE_ACCOUNT_ID || "0.0.10464194";

const REQUEST: YieldRiskContract = {
  accountId: SERVICE_ACCOUNT,
  riskTolerance: "balanced",
  amountHbar: 1,
};

const run = RUN_MIRROR_INTEGRATION ? test : test.skip;

run("real Testnet Mirror read exposes honest account-level facts with explicit metadata", async () => {
  const read = await readMirrorAccountSnapshot(SERVICE_ACCOUNT, MIRROR_BASE_URL);
  const analysis = analyzeMirrorRead(read, REQUEST, "hedera:testnet");

  expect(analysis.status).toBe("success");
  expect(analysis.service).toBe(SERVICE_NAME);
  expect(analysis.analysis.scope).toBe(ANALYSIS_SCOPE);
  expect(analysis.analysis.source).toBe(ANALYSIS_SOURCE);
  expect(analysis.analysis.network).toBe("hedera:testnet");
  expect(analysis.analysis.observed.account.accountId).toBe(SERVICE_ACCOUNT);
  expect(BigInt(analysis.analysis.observed.balance.tinybars)).toBeGreaterThanOrEqual(0n);
  expect(analysis.analysis.dataTimestamp).not.toBeNull();
  expect(["fresh", "stale", "unknown"]).toContain(analysis.analysis.freshnessHealth);
  expect(analysis.analysis.unavailable).toEqual([...UNVAILABLE_FEATURES]);
  expect(analysis.analysis.unavailable).toContain("live pool APY");
  expect(analysis.analysis.unavailable).toContain("Bonzo data");
  expect(analysis.analysis.unavailable).not.toContain("SaucerSwap data");
  expect(analysis.analysis.limitations).toEqual([...ANALYSIS_LIMITATIONS]);
  expect(analysis.analysis.limitations).toContain(
    "SaucerSwap read-only metrics available (APY unavailable)",
  );
  expect(analysis.analysis.limitations).toContain(
    "Bonzo lending matrix pending: no live Bonzo Lend source proven",
  );
  expect(analysis.payment).toEqual({
    protocol: "x402",
    version: 2,
    network: "hedera:testnet",
    asset: "0.0.0",
    amountTinybars: "1000000",
  });
  expect(analysis.disclaimer).toBe(DISCLAIMER);
  expect("riskScore" in analysis.analysis).toBe(false);
  expect("confidence" in analysis.analysis).toBe(false);
});

run("real Testnet paid-handler response with a validated contract is a 200 with mirror facts", async () => {
  const handler = createYieldRiskHandler({ mirrorBaseUrl: MIRROR_BASE_URL });

  let status = 0;
  let body: Record<string, unknown> | null = null;
  const req = {
    body: { accountId: SERVICE_ACCOUNT, riskTolerance: "conservative", amountHbar: 100 },
  } as never;
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
  expect(record.status).toBe("success");
  expect((record.analysis as Record<string, unknown>).source).toBe(ANALYSIS_SOURCE);
  expect((record.analysis as Record<string, unknown>).scope).toBe(ANALYSIS_SCOPE);
  expect((record.analysis as Record<string, unknown>).dataUnavailable).toBeUndefined();
}, 15000);
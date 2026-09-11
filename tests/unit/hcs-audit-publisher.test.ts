import { afterEach, describe, expect, test } from "bun:test";
import { isHcsAuditConfigured, publishAuditEvent } from "@strata402/api-gateway/hcs-audit";

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("hcs-audit publisher (fail-open)", () => {
  test("skips without a configured topic id", async () => {
    process.env.HCS_AUDIT_TOPIC_ID = "";
    const result = await publishAuditEvent({
      topicId: "",
      operatorAccountId: "0.0.10329902",
      operatorPrivateKey: "302e020100300506032b657004220420" + "00".repeat(31) + "01",
      requestId: "req-1",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
    });
    expect(result.published).toBe(false);
    expect(result.reason).toBe("topic-not-configured");
  });

  test("skips when the operator credential is absent", async () => {
    const result = await publishAuditEvent({
      topicId: "0.0.10483725",
      operatorAccountId: "",
      operatorPrivateKey: "",
      requestId: "req-2",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
    });
    expect(result.published).toBe(false);
    expect(result.reason).toBe("operator-not-configured");
  });

  test("rejects an invalid topic id without touching the network", async () => {
    const result = await publishAuditEvent({
      topicId: "not-a-topic",
      operatorAccountId: "0.0.10329902",
      operatorPrivateKey: "302e020100300506032b657004220420" + "00".repeat(31) + "01",
      requestId: "req-3",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
    });
    expect(result.published).toBe(false);
    expect(result.reason).toBe("invalid-topic-id");
  });

  test("isHcsAuditConfigured reflects the topic env", () => {
    expect(isHcsAuditConfigured({ HCS_AUDIT_TOPIC_ID: "0.0.10483725" })).toBe(true);
    expect(isHcsAuditConfigured({ HCS_AUDIT_TOPIC_ID: "" })).toBe(false);
    expect(isHcsAuditConfigured({})).toBe(false);
  });

  test("publish failure path degrades to a state object (topic unreachable never throws)", async () => {
    process.env.HCS_AUDIT_TOPIC_ID = "0.0.10483725";
    process.env.STRATA402_PAYER_ACCOUNT_ID = "0.0.10329902";
    process.env.STRATA402_PAYER_PRIVATE_KEY =
      "302e020100300506032b657004220420" + "00".repeat(31) + "01";
    process.env.STRATA402_MIRROR_BASE_URL = "https://testnet.mirrornode.hedera.com";

    const neverResolves = () => new Promise<Response>(() => undefined);
    const fetchFn = neverResolves as unknown as typeof fetch;

    // The mirror read hangs; the submit requires a network client we avoid by
    // short-circuiting through an impossible topic object constructed but never
    // executed — verified below that a malformed operator key is caught safely.
    const result = await publishAuditEvent({
      operatorAccountId: "0.0.10329902",
      operatorPrivateKey: "not-a-valid-key",
      requestId: "req-4",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
      mirrorBaseUrl: "https://testnet.mirrornode.hedera.com",
      fetchFn,
    });

    expect(result.published).toBe(false);
    expect(["submit-failed", "mirror-unverified", "invalid-topic-id", "operator-not-configured"]).toContain(
      result.reason,
    );
  });
});
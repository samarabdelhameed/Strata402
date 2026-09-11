import { describe, expect, test } from "bun:test";
import {
  ENV_HCS_AUDIT_TOPIC_ID,
  buildHcsAuditEvent,
  parseHcsAuditEvent,
  serializeHcsAuditEvent,
} from "@strata402/x402-sdk";

describe("hcs-audit events", () => {
  test("buildHcsAuditEvent returns only safe metadata fields", () => {
    const event = buildHcsAuditEvent({
      requestId: "req_abc",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
      paymentTxId: "0.0.9185802-1789101908-717608026",
      blockTimestamp: "1789101915.212785885",
      now: 1_750_000_000_000,
    });
    expect(event).toEqual({
      requestId: "req_abc",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
      paymentTxId: "0.0.9185802-1789101908-717608026",
      blockTimestamp: "1789101915.212785885",
      at: new Date(1_750_000_000_000).toISOString(),
    });
  });

  test("nulls are used when no payment transaction present", () => {
    const event = buildHcsAuditEvent({
      requestId: "req_unpaid",
      endpoint: "/v1/catalog",
      status: "402",
    });
    expect(event.paymentTxId).toBeNull();
    expect(event.blockTimestamp).toBeNull();
    expect(typeof event.at).toBe("string");
  });

  test("serializeHcsAuditEvent round-trips through parseHcsAuditEvent", () => {
    const event = buildHcsAuditEvent({
      requestId: "req_roundtrip",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
      paymentTxId: "0.0.9185802-1789101908-717608026",
      blockTimestamp: "1789101915.212785885",
    });
    const raw = serializeHcsAuditEvent(event);
    const parsed = parseHcsAuditEvent(raw);
    expect(parsed).toEqual(event);
  });

  test("parseHcsAuditEvent returns null on malformed payloads", () => {
    expect(parseHcsAuditEvent("not-json")).toBeNull();
    expect(parseHcsAuditEvent('{"requestId":123}')).toBeNull();
    expect(parseHcsAuditEvent("")).toBeNull();
  });

  test("ENV_HCS_AUDIT_TOPIC_ID matches gateway env name", () => {
    expect(ENV_HCS_AUDIT_TOPIC_ID).toBe("HCS_AUDIT_TOPIC_ID");
  });

  test("event never includes sensitive keys", () => {
    const event = buildHcsAuditEvent({
      requestId: "req_safe",
      endpoint: "/v1/strategy/yield-risk",
      status: "200",
    });
    const raw = serializeHcsAuditEvent(event);
    expect(raw).not.toMatch(/key|secret|token|signature/i);
  });
});
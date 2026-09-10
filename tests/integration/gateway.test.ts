import { test, expect, afterAll, beforeAll } from "bun:test";
import type { Server } from "node:http";
import { buildApp } from "@strata402/api-gateway/server";
import { HEADER_PAYMENT_REQUIRED } from "@strata402/x402-sdk";

type Json = Record<string, any>;

async function readJson(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = buildApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected numeric port");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server.close();
});

test("GET /health is free and reports gateway identity", async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  const body = await readJson(res);
  expect(body.status).toBe("ok");
  expect(body.service).toBe("strata402-api-gateway");
  expect(body.network).toBe("testnet");
});

test("GET /v1/services is free and lists the paid AI services in tinybars", async () => {
  const res = await fetch(`${baseUrl}/v1/services`);
  expect(res.status).toBe(200);
  const body = await readJson(res);
  expect(body.network).toBe("testnet");
  expect(body.currency).toBe("HBAR");
  expect(Array.isArray(body.services)).toBe(true);
  expect(body.services.length).toBe(3);
  const first = body.services[0]!;
  expect(first.asset).toBe("0.0.0");
  expect(first.unit).toBe("tinybar");
  expect(first.priceTinybars).toBe(1_000_000);
});

test("paid endpoint demands x402: 402 + PAYMENT-REQUIRED when no signature is sent", async () => {
  const res = await fetch(`${baseUrl}/v1/intel/defi-risk-intel`);
  expect(res.status).toBe(402);
  const header = res.headers.get(HEADER_PAYMENT_REQUIRED);
  expect(header).toBeTruthy();
  const envelope = JSON.parse(header!);
  expect(envelope.schema).toBe("x402-v2");
  expect(envelope.required.amount).toBe(1_000_000);
  expect(envelope.required.asset).toBe("0.0.0");
});
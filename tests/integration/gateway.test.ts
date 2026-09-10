import { test, expect, afterAll, beforeAll } from "bun:test";
import type { Server } from "node:http";
import { x402ResourceServer } from "@x402/core/server";
import { buildApp } from "@strata402/api-gateway/server";
import {
  HEADER_PAYMENT_REQUIRED,
  DEFAULT_NETWORK,
  DEFAULT_ASSET,
  DEFAULT_PRICE_TINYBARS,
  DEFAULT_SERVICE_ACCOUNT,
} from "@strata402/x402-sdk";
import { buildX402Gateway } from "@strata402/api-gateway/x402";

type Json = Record<string, any>;

async function readJson(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

function decodeBase64UrlHeader(header: string): Json {
  const json = Buffer.from(header, "base64url").toString("utf8");
  return JSON.parse(json) as Json;
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

test("GET /health is free and reports the CAIP-2 Hedera network", async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  const body = await readJson(res);
  expect(body.status).toBe("ok");
  expect(body.service).toBe("strata402-api-gateway");
  expect(body.network).toBe(DEFAULT_NETWORK);
});

test("GET /v1/services is free and lists the single MVP service with HBAR pico pricing", async () => {
  const res = await fetch(`${baseUrl}/v1/services`);
  expect(res.status).toBe(200);
  const body = await readJson(res);
  expect(body.network).toBe(DEFAULT_NETWORK);
  expect(body.currency).toBe("HBAR");
  expect(body.payTo).toBe(DEFAULT_SERVICE_ACCOUNT);
  expect(body.services).toHaveLength(1);
  const svc = body.services[0]!;
  expect(svc.id).toBe("yield-risk");
  expect(svc.asset).toBe(DEFAULT_ASSET);
  expect(svc.unit).toBe("tinybar");
  expect(svc.priceTinybars).toBe(DEFAULT_PRICE_TINYBARS);
});

test("official x402 middleware is wired (not a hand-rolled stub)", () => {
  const gateway = buildX402Gateway();
  expect(gateway.resourceServer).toBeInstanceOf(x402ResourceServer);
  expect(gateway.routes["POST /v1/strategy/yield-risk"]).toBeTruthy();
  const accepts = gateway.routes["POST /v1/strategy/yield-risk"]!.accepts as any;
  expect(accepts.scheme).toBe("exact");
  expect(accepts.network).toBe(DEFAULT_NETWORK);
  expect(accepts.payTo).toBe(DEFAULT_SERVICE_ACCOUNT);
  expect(accepts.price).toEqual({ asset: DEFAULT_ASSET, amount: String(DEFAULT_PRICE_TINYBARS) });
});

test("paid endpoint issues a real x402 v2 challenge: 402 + PAYMENT-REQUIRED", async () => {
  const res = await fetch(`${baseUrl}/v1/strategy/yield-risk`, { method: "POST" });
  expect(res.status).toBe(402);

  const header = res.headers.get(HEADER_PAYMENT_REQUIRED);
  expect(header).toBeTruthy();

  const envelope = decodeBase64UrlHeader(header!);
  expect(envelope.x402Version).toBe(2);
  expect(Array.isArray(envelope.accepts)).toBe(true);

  const accept = envelope.accepts[0]!;
  expect(accept.scheme).toBe("exact");
  expect(accept.network).toBe(DEFAULT_NETWORK);
  expect(accept.asset).toBe(DEFAULT_ASSET);
  expect(accept.amount).toBe(String(DEFAULT_PRICE_TINYBARS));
  expect(accept.payTo).toBe(DEFAULT_SERVICE_ACCOUNT);
  expect(accept.extra.feePayer).toBeTruthy();
});
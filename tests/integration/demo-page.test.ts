import { test, expect, afterAll, beforeAll } from "bun:test";
import type { Server } from "node:http";
import { buildApp } from "@strata402/api-gateway/server";
import { mountDemoPage } from "@strata402/api-gateway/pages/demo";
import { HEADER_PAYMENT_REQUIRED } from "@strata402/x402-sdk";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = buildApp();
  mountDemoPage(app);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected numeric port");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => { server.close(); });

test("GET /demo serves the real read-only HTML page", async () => {
  const res = await fetch(`${baseUrl}/demo`);
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("<title>Strata402");
  expect(html).toContain("read-only demo");
  expect(html).toContain("UNAVAILABLE");
  expect(html).toContain("DEFERRED");
  expect(html).toContain("PENDING");
  expect(html).toContain("fetch(\"/health\")");
  expect(html).toContain("fetch(\"/v1/services\")");
  expect(html).toContain("/v1/strategy/yield-risk");
  expect(html).not.toContain("Authorization:");
  expect(html).not.toContain("PAYMENT-SIGNATURE:");
  expect(html).toContain("content-type");
  expect(html).not.toContain("mock");
  expect(html).not.toContain("Mock");
});

test("real /health endpoint returns the same data the demo page reads", async () => {
  const res = await fetch(`${baseUrl}/health`);
  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  expect(body.status).toBe("ok");
  expect(body.network).toBe("hedera:testnet");
  expect(typeof body.service).toBe("string");
});

test("real /v1/services catalog returns the same payTo and price the demo page displays", async () => {
  const res = await fetch(`${baseUrl}/v1/services`);
  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  expect(body.network).toBe("hedera:testnet");
  expect(body.currency).toBe("HBAR");
  expect(typeof body.payTo).toBe("string");
  const svc = (body.services as any[])[0];
  expect(svc.id).toBe("yield-risk");
  expect(typeof svc.priceTinybars).toBe("number");
});

test("real unpaid POST to yield-risk returns 402 PAYMENT-REQUIRED (no payment sent)", async () => {
  const res = await fetch(`${baseUrl}/v1/strategy/yield-risk`, { method: "POST" });
  expect(res.status).toBe(402);
  const header = res.headers.get(HEADER_PAYMENT_REQUIRED);
  expect(header).toBeTruthy();
});

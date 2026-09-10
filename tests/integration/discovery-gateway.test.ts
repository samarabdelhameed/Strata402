import { test, expect } from "bun:test";
import {
  DEFAULT_SERVICE_URL,
  DISCOVERY_PATH,
  discoverApprovedService,
} from "@strata402/consuming-agent";

const RUN_GATEWAY_INTEGRATION = process.env.RUN_GATEWAY_INTEGRATION === "true";
const SERVICE_URL = process.env.STRATA402_SERVICE_URL ?? DEFAULT_SERVICE_URL;

const run = RUN_GATEWAY_INTEGRATION ? test : test.skip;

run("real discovery against the running local Gateway", async () => {
  const offer = await discoverApprovedService(SERVICE_URL);

  expect(offer.network).toBe("hedera:testnet");
  expect(offer.currency).toBe("HBAR");
  expect(offer.payTo).toBe("0.0.1234");

  expect(offer.service.id).toBe("yield-risk");
  expect(offer.service.priceTinybars).toBe(1_000_000);
  expect(offer.service.asset).toBe("0.0.0");
  expect(offer.service.unit).toBe("tinybar");
  expect(offer.displayAmount).toBe("0.01 HBAR");

  const raw = await fetch(`${SERVICE_URL}${DISCOVERY_PATH}`);
  expect(raw.status).toBe(200);
  const body = (await raw.json()) as { services: unknown[] };
  expect(body.services).toHaveLength(1);
});

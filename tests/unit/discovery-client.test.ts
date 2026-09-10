import { test, expect } from "bun:test";
import {
  APPROVED_ROUTE,
  DISCOVERY_PATH,
  DiscoveryError,
  buildOffer,
  discoverApprovedService,
  formatTinybarsDisplay,
  parseCatalogJson,
  selectApprovedService,
  validateCatalog,
} from "@strata402/consuming-agent";
import type { DiscoveryErrorCode } from "@strata402/consuming-agent";

const VALID_SERVICE: {
  id: "yield-risk";
  name: string;
  description: string;
  priceTinybars: number;
  asset: string;
  unit: string;
} = {
  id: "yield-risk",
  name: "Yield-Risk Strategy",
  description: "Risk-scored yield strategy assessment for a DeFi protocol position on Hedera.",
  priceTinybars: 1_000_000,
  asset: "0.0.0",
  unit: "tinybar",
};

const VALID_CATALOG = {
  network: "hedera:testnet",
  currency: "HBAR",
  payTo: "0.0.1234",
  services: [VALID_SERVICE],
};

function makeCatalog(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...VALID_CATALOG, ...patch };
}

function makeService(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...VALID_SERVICE, ...patch };
}

type FetchInput = Parameters<typeof fetch>[0];

function stubFetch(
  body: string | undefined,
  status = 200,
): { fn: typeof fetch; url: () => string } {
  let called = "";
  const fn = (async (input: FetchInput) => {
    called = String(input);
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { fn, url: () => called };
}

async function rejectsWith(
  runner: () => Promise<unknown> | unknown,
  code: DiscoveryErrorCode,
): Promise<void> {
  try {
    await runner();
  } catch (err) {
    expect(err).toBeInstanceOf(DiscoveryError);
    expect((err as DiscoveryError).code).toBe(code);
    return;
  }
  throw new Error(`expected DiscoveryError code=${code}, but no error was thrown`);
}

test("valid discovery catalog validates and selects the approved service", () => {
  const catalog = validateCatalog(VALID_CATALOG);
  expect(catalog.network).toBe("hedera:testnet");
  expect(catalog.currency).toBe("HBAR");
  expect(catalog.payTo).toBe("0.0.1234");

  const service = selectApprovedService(catalog.services);
  expect(service.id).toBe("yield-risk");
  expect(service.priceTinybars).toBe(1_000_000);
  expect(service.asset).toBe("0.0.0");
  expect(service.unit).toBe("tinybar");
});

test("discoverApprovedService returns a complete offer from a valid 200 response", async () => {
  const stub = stubFetch(JSON.stringify(VALID_CATALOG));
  const offer = await discoverApprovedService("http://gateway.local", stub.fn);

  expect(stub.url()).toBe(`http://gateway.local${DISCOVERY_PATH}`);
  expect(offer.network).toBe("hedera:testnet");
  expect(offer.currency).toBe("HBAR");
  expect(offer.payTo).toBe("0.0.1234");
  expect(offer.service).toEqual(VALID_SERVICE);
  expect(offer.route).toEqual(APPROVED_ROUTE);
  expect(offer.displayAmount).toBe("0.01 HBAR");
});

test("non-200 discovery response fails closed with HTTP_STATUS", async () => {
  const stub = stubFetch("nope", 500);
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "HTTP_STATUS",
  );
});

test("malformed JSON fails closed with MALFORMED_JSON", async () => {
  const stub = stubFetch("not-json{", 200);
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "MALFORMED_JSON",
  );
});

test("parseCatalogJson rejects non-JSON text", () => {
  expect(() => parseCatalogJson("{nope")).toThrow(DiscoveryError);
});

test("wrong network fails closed with NETWORK", async () => {
  const raw = makeCatalog({ network: "eip155:1" });
  await rejectsWith(() => validateCatalog(raw), "NETWORK");
});

test("wrong currency fails closed with CURRENCY", async () => {
  const raw = makeCatalog({ currency: "USDC" });
  await rejectsWith(() => validateCatalog(raw), "CURRENCY");
});

test("missing payTo fails closed with PAYTO_MISSING", async () => {
  const raw = makeCatalog({ payTo: undefined });
  await rejectsWith(() => validateCatalog(raw), "PAYTO_MISSING");
});

test("payTo equal to asset id 0.0.0 fails closed with PAYTO_ZERO", async () => {
  const raw = makeCatalog({ payTo: "0.0.0" });
  await rejectsWith(() => validateCatalog(raw), "PAYTO_ZERO");
});

test("missing or empty services fails closed with SERVICES_MISSING", async () => {
  await rejectsWith(
    () => validateCatalog(makeCatalog({ services: undefined })),
    "SERVICES_MISSING",
  );
  await rejectsWith(
    () => validateCatalog(makeCatalog({ services: [] })),
    "SERVICES_MISSING",
  );
});

test("missing yield-risk fails closed with SERVICE_ID", async () => {
  const raw = makeCatalog({
    services: [{ ...VALID_SERVICE, id: "other-service" }],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "SERVICE_ID",
  );
});

test("wrong price fails closed with PRICE", async () => {
  const raw = makeCatalog({
    services: [makeService({ priceTinybars: 2_000_000 })],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "PRICE",
  );
});

test("non-integer amount fails closed with PRICE", async () => {
  const raw = makeCatalog({
    services: [makeService({ priceTinybars: 1_000_000.5 })],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "PRICE",
  );
});

test("negative amount fails closed with PRICE", async () => {
  const raw = makeCatalog({
    services: [makeService({ priceTinybars: -5 })],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "PRICE",
  );
});

test("wrong asset fails closed with ASSET", async () => {
  const raw = makeCatalog({
    services: [makeService({ asset: "0.0.9185802" })],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "ASSET",
  );
});

test("wrong unit fails closed with UNIT", async () => {
  const raw = makeCatalog({
    services: [makeService({ unit: "microhbar" })],
  });
  const stub = stubFetch(JSON.stringify(raw));
  await rejectsWith(
    () => discoverApprovedService("http://gateway.local", stub.fn),
    "UNIT",
  );
});

test("tinybar display conversion is exact for the approved price", () => {
  expect(formatTinybarsDisplay(1_000_000)).toBe("0.01 HBAR");
  expect(formatTinybarsDisplay(100_000_000)).toBe("1.00 HBAR");
});

test("offer carries the allow-listed method and endpoint contract", () => {
  const catalog = validateCatalog(VALID_CATALOG);
  const service = selectApprovedService(catalog.services);
  const offer = buildOffer(catalog, service);

  expect(offer.route).toEqual(APPROVED_ROUTE);
  expect(offer.route.method).toBe("POST");
  expect(offer.route.endpoint).toBe("/v1/strategy/yield-risk");
});

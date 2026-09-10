import {
  ALLOWED_ASSET,
  ALLOWED_CURRENCY,
  ALLOWED_NETWORK,
  ALLOWED_PRICE_TINYBARS,
  ALLOWED_SERVICE_ID,
  ALLOWED_UNIT,
  APPROVED_ROUTE,
  DEFAULT_SERVICE_URL,
  DISCOVERY_PATH,
  ENV_SERVICE_URL,
  TINYBARS_PER_HBAR,
  type DiscoveryOffer,
  type ValidatedCatalog,
  type ValidatedService,
} from "./types";
import { DiscoveryError } from "./errors";

export type DiscoveryFetch = typeof fetch;

export function resolveServiceUrl(): string {
  return process.env[ENV_SERVICE_URL] ?? DEFAULT_SERVICE_URL;
}

export function formatTinybarsDisplay(priceTinybars: number): string {
  const hbar = priceTinybars / TINYBARS_PER_HBAR;
  return `${hbar.toFixed(2)} HBAR`;
}

export function parseCatalogJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DiscoveryError("MALFORMED_JSON", "Discovery response is not valid JSON");
  }
}

export function validateCatalog(raw: unknown): ValidatedCatalog {
  if (typeof raw !== "object" || raw === null) {
    throw new DiscoveryError("MALFORMED_JSON", "Discovery catalog must be a JSON object");
  }
  const record = raw as Record<string, unknown>;

  const network = record.network;
  if (network !== ALLOWED_NETWORK) {
    throw new DiscoveryError("NETWORK", `Unexpected network: ${String(network)}`);
  }

  const currency = record.currency;
  if (currency !== ALLOWED_CURRENCY) {
    throw new DiscoveryError("CURRENCY", `Unexpected currency: ${String(currency)}`);
  }

  const payTo = record.payTo;
  if (typeof payTo !== "string" || payTo.length === 0) {
    throw new DiscoveryError("PAYTO_MISSING", "payTo is missing");
  }
  if (payTo === "0.0.0") {
    throw new DiscoveryError("PAYTO_ZERO", "payTo must not be the HBAR asset id 0.0.0");
  }

  if (!Array.isArray(record.services) || record.services.length === 0) {
    throw new DiscoveryError("SERVICES_MISSING", "services must be a non-empty array");
  }

  return {
    network,
    currency,
    payTo,
    services: record.services,
  };
}

export function selectApprovedService(services: unknown[]): ValidatedService {
  const candidate = services.find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as Record<string, unknown>).id === ALLOWED_SERVICE_ID,
  );
  if (!candidate) {
    throw new DiscoveryError("SERVICE_ID", `Approved service "${ALLOWED_SERVICE_ID}" not found`);
  }

  const price = candidate.priceTinybars;
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0) {
    throw new DiscoveryError("PRICE", "priceTinybars must be a positive integer");
  }
  if (price !== ALLOWED_PRICE_TINYBARS) {
    throw new DiscoveryError("PRICE", `Unexpected priceTinybars: ${price}`);
  }

  const asset = candidate.asset;
  if (asset !== ALLOWED_ASSET) {
    throw new DiscoveryError("ASSET", `Unexpected asset: ${String(asset)}`);
  }

  const unit = candidate.unit;
  if (unit !== ALLOWED_UNIT) {
    throw new DiscoveryError("UNIT", `Unexpected unit: ${String(unit)}`);
  }

  return {
    id: ALLOWED_SERVICE_ID,
    name: typeof candidate.name === "string" ? candidate.name : "",
    description: typeof candidate.description === "string" ? candidate.description : "",
    priceTinybars: price,
    asset,
    unit,
  };
}

export function buildOffer(
  catalog: ValidatedCatalog,
  service: ValidatedService,
): DiscoveryOffer {
  return {
    network: catalog.network,
    currency: catalog.currency,
    payTo: catalog.payTo,
    service,
    route: APPROVED_ROUTE,
    displayAmount: formatTinybarsDisplay(service.priceTinybars),
  };
}

export async function discoverApprovedService(
  serviceUrl: string = resolveServiceUrl(),
  fetchFn: DiscoveryFetch = fetch,
): Promise<DiscoveryOffer> {
  const target = `${serviceUrl}${DISCOVERY_PATH}`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new DiscoveryError("REQUEST_FAILED", `Discovery request failed: ${String(cause)}`);
  }

  if (res.status !== 200) {
    throw new DiscoveryError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  const raw = parseCatalogJson(text);
  const catalog = validateCatalog(raw);
  const service = selectApprovedService(catalog.services);
  return buildOffer(catalog, service);
}

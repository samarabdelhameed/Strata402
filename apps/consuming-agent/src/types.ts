export const TINYBARS_PER_HBAR = 100_000_000;

export const ALLOWED_NETWORK = "hedera:testnet";
export const ALLOWED_CURRENCY = "HBAR";
export const ALLOWED_SERVICE_ID = "yield-risk";
export const ALLOWED_ASSET = "0.0.0";
export const ALLOWED_UNIT = "tinybar";
export const ALLOWED_PRICE_TINYBARS = 1_000_000;

export const APPROVED_ROUTE = {
  method: "POST",
  endpoint: "/v1/strategy/yield-risk",
} as const;
export type ApprovedRoute = typeof APPROVED_ROUTE;

export const DEFAULT_SERVICE_URL = "http://127.0.0.1:8080";
export const ENV_SERVICE_URL = "STRATA402_SERVICE_URL";
export const DISCOVERY_PATH = "/v1/services";

export interface ValidatedService {
  id: typeof ALLOWED_SERVICE_ID;
  name: string;
  description: string;
  priceTinybars: number;
  asset: string;
  unit: string;
}

export interface ValidatedCatalog {
  network: string;
  currency: string;
  payTo: string;
  services: unknown[];
}

export interface DiscoveryOffer {
  network: string;
  currency: string;
  payTo: string;
  service: ValidatedService;
  route: ApprovedRoute;
  displayAmount: string;
}

/**
 * Strata402 — shared x402 v2 types and constants.
 * Canonical transport headers per the x402 v2 spec.
 * Amounts are denominated in tinybars (asset: "0.0.0" = HBAR).
 */

export const X402_VERSION = 2;

export const HEADER_PAYMENT_REQUIRED = "PAYMENT-REQUIRED";
export const HEADER_PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE";
export const HEADER_PAYMENT_RESPONSE = "PAYMENT-RESPONSE";

export const DEFAULT_ASSET = "0.0.0";
export const DEFAULT_NETWORK = "testnet";
export const DEFAULT_PRICE_TINYBARS = 1_000_000;
export const DEFAULT_RECIPIENT = "";

export interface ServiceBill {
  id: string;
  name: string;
  description: string;
  priceTinybars: number;
  asset: string;
  unit: "tinybar";
}

export interface ServiceCatalog {
  network: string;
  currency: "HBAR";
  services: ServiceBill[];
}

export interface ServiceCatalogOverrides {
  network?: string;
  asset?: string;
  priceTinybars?: number;
}

export function buildServiceCatalog(
  overrides: ServiceCatalogOverrides = {},
): ServiceCatalog {
  const network = overrides.network ?? process.env.STRATA_NETWORK ?? DEFAULT_NETWORK;
  const asset = overrides.asset ?? process.env.X402_ASSET ?? DEFAULT_ASSET;
  const priceTinybars = overrides.priceTinybars ?? Number(process.env.X402_PRICE_TINYBARS ?? DEFAULT_PRICE_TINYBARS);

  const base = {
    asset,
    unit: "tinybar" as const,
  };

  return {
    network,
    currency: "HBAR",
    services: [
      {
        id: "defi-risk-intel",
        name: "DeFi Risk Intel",
        description: "Risk-scored intelligence brief for a protocol or token position.",
        priceTinybars,
        ...base,
      },
      {
        id: "portfolio-rebalance",
        name: "Portfolio Rebalance Plan",
        description: "Actionable rebalancing plan derived from on-chain positions.",
        priceTinybars,
        ...base,
      },
      {
        id: "market-sentiment",
        name: "Market Sentiment Digest",
        description: "Aggregated sentiment and momentum snapshot for a market.",
        priceTinybars,
        ...base,
      },
    ],
  };
}
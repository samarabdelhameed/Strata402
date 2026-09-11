/**
 * Strata402 — shared x402 v2 types and constants.
 * Canonical transport headers per the x402 v2 spec.
 * Network identifiers are CAIP-2 (e.g. "hedera:testnet").
 * Amounts are denominated in tinybars (asset: "0.0.0" = HBAR).
 */

export const X402_VERSION = 2;

export const HEADER_PAYMENT_REQUIRED = "PAYMENT-REQUIRED";
export const HEADER_PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE";
export const HEADER_PAYMENT_RESPONSE = "PAYMENT-RESPONSE";

export const DEFAULT_NETWORK = "hedera:testnet";
export const DEFAULT_ASSET = "0.0.0";
export const DEFAULT_PRICE_TINYBARS = 1_000_000;
export const DEFAULT_SERVICE_ACCOUNT = "0.0.1234";

export const ENV_SERVICE_ACCOUNT = "HEDERA_SERVICE_ACCOUNT_ID";
export const ENV_FACILITATOR_URL = "X402_FACILITATOR_URL";
export const ENV_PRICE_TINYBARS = "X402_PRICE_TINYBARS";
export const ENV_ASSET = "X402_ASSET";

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
  payTo: string;
  services: ServiceBill[];
}

export interface ServiceCatalogOverrides {
  network?: string;
  asset?: string;
  priceTinybars?: number;
  payTo?: string;
}

export function serviceAccountFromEnv(): string {
  return process.env[ENV_SERVICE_ACCOUNT] ?? DEFAULT_SERVICE_ACCOUNT;
}

export {
  ACCOUNT_ID_PATTERN,
  ANALYSIS_LIMITATIONS,
  ASSET_ID,
  DEFAULT_RISK_TOLERANCE,
  DISCLAIMER,
  MAX_ANALYSIS_AMOUNT_HBAR,
  RISK_TOLERANCE_VALUES,
  TINYBARS_PER_HBAR,
  isRiskTolerance,
  parseYieldRiskContract,
} from "./yield-risk-contract";
export type {
  RiskTolerance,
  YieldRiskContract,
  YieldRiskContractIssue,
  YieldRiskParseResult,
} from "./yield-risk-contract";

export function buildServiceCatalog(
  overrides: ServiceCatalogOverrides = {},
): ServiceCatalog {
  const network = overrides.network ?? process.env.STRATA_NETWORK ?? DEFAULT_NETWORK;
  const asset = overrides.asset ?? process.env[ENV_ASSET] ?? DEFAULT_ASSET;
  const priceTinybars = overrides.priceTinybars ?? Number(process.env[ENV_PRICE_TINYBARS] ?? DEFAULT_PRICE_TINYBARS);
  const payTo = overrides.payTo ?? serviceAccountFromEnv();

  const base = {
    asset,
    unit: "tinybar" as const,
  };

  return {
    network,
    currency: "HBAR",
    payTo,
    services: [
      {
        id: "yield-risk",
        name: "Yield-Risk Strategy",
        description: "Risk-scored yield strategy assessment for a DeFi protocol position on Hedera.",
        priceTinybars,
        ...base,
      },
    ],
  };
}
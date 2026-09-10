import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RouteConfig } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { HEDERA_TESTNET_CAIP2 } from "@x402/hedera";
import {
  DEFAULT_ASSET,
  ENV_FACILITATOR_URL,
  ENV_PRICE_TINYBARS,
  serviceAccountFromEnv,
  X402_VERSION,
} from "@strata402/x402-sdk";

export const FACILITATOR_URL =
  process.env[ENV_FACILITATOR_URL] ?? "https://x402.org/facilitator";

export interface X402Gateway {
  facilitatorClient: HTTPFacilitatorClient;
  resourceServer: x402ResourceServer;
  routes: Record<string, RouteConfig>;
}

export const X402_ROUTES: Record<string, RouteConfig> = {
  "POST /v1/strategy/yield-risk": {
    description: "Yield-risk strategy assessment (official x402 v2 payment wall)",
    accepts: {
      scheme: "exact",
      network: HEDERA_TESTNET_CAIP2,
      payTo: serviceAccountFromEnv(),
      price: {
        asset: DEFAULT_ASSET,
        amount: String(Number(process.env[ENV_PRICE_TINYBARS] ?? 1_000_000)),
      },
    },
  },
};

export function buildX402Gateway(): X402Gateway {
  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(HEDERA_TESTNET_CAIP2, new ExactHederaScheme());
  return { facilitatorClient, resourceServer, routes: X402_ROUTES };
}

export function createPaymentMiddleware(gateway: X402Gateway) {
  return paymentMiddleware(
    gateway.routes,
    gateway.resourceServer,
    undefined,
    undefined,
    true,
  );
}

export function assertX402Version(expected: number = X402_VERSION): void {
  if (expected !== X402_VERSION) {
    throw new Error(`Unexpected x402 protocol version: ${expected}`);
  }
}
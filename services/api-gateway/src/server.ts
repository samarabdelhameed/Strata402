import express from "express";
import { DEFAULT_NETWORK, buildServiceCatalog } from "@strata402/x402-sdk";
import { buildX402Gateway, createPaymentMiddleware } from "./x402";
import { createYieldRiskHandler } from "./analyst";

export const ENV_MIRROR_BASE_URL = "STRATA402_MIRROR_BASE_URL";
export const DEFAULT_MIRROR_BASE_URL = "https://testnet.mirrornode.hedera.com";

export function buildApp(): express.Express {
  const app = express();
  app.use(express.json());

  const gateway = buildX402Gateway();
  app.use(createPaymentMiddleware(gateway));

  const mirrorBaseUrl = process.env[ENV_MIRROR_BASE_URL]?.trim() || DEFAULT_MIRROR_BASE_URL;

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "strata402-api-gateway",
      version: "0.1.0",
      network: DEFAULT_NETWORK,
      x402Version: 2,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/v1/services", (_req, res) => {
    res.json(buildServiceCatalog());
  });

  app.post(
    "/v1/strategy/yield-risk",
    createYieldRiskHandler({
      mirrorBaseUrl,
      network: DEFAULT_NETWORK,
    }),
  );

  return app;
}

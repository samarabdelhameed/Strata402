import express from "express";
import { DEFAULT_NETWORK, buildServiceCatalog } from "@strata402/x402-sdk";
import { buildX402Gateway, createPaymentMiddleware } from "./x402";

export function buildApp(): express.Express {
  const app = express();
  app.use(express.json());

  const gateway = buildX402Gateway();
  app.use(createPaymentMiddleware(gateway));

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

  app.post("/v1/strategy/yield-risk", (_req, res) => {
    // Phase 3: payment wall is enforced by x402 middleware above.
    // Phase 4: AI engine computes the actual yield-risk strategy here.
    res.status(501).json({
      status: "not_implemented",
      message: "AI engine lands in Phase 4; payment processing is live via x402.",
    });
  });

  return app;
}
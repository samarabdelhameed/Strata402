import express from "express";
import {
  DEFAULT_ASSET,
  DEFAULT_NETWORK,
  HEADER_PAYMENT_REQUIRED,
  buildServiceCatalog,
} from "@strata402/x402-sdk";

export function buildApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "strata402-api-gateway",
      version: "0.1.0",
      network: process.env.STRATA_NETWORK ?? DEFAULT_NETWORK,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/v1/services", (_req, res) => {
    res.json(buildServiceCatalog());
  });

  app.get("/v1/intel/:serviceId", (_req, res) => {
    // STUB — Phase 2 only. The real x402 middleware (Phase 3) validates
    // PAYMENT-SIGNATURE and issues PAYMENT-RESPONSE via @x402/express.
    const paymentRequired = JSON.stringify({
      schema: "x402-v2",
      network: process.env.STRATA_NETWORK ?? DEFAULT_NETWORK,
      required: {
        to: process.env.X402_RECIPIENT ?? DEFAULT_ASSET,
        asset: process.env.X402_ASSET ?? DEFAULT_ASSET,
        amount: Number(process.env.X402_PRICE_TINYBARS ?? 1_000_000),
      },
    });

    res.setHeader(HEADER_PAYMENT_REQUIRED, paymentRequired);
    res.status(402).json({
      error: "payment_required",
      message: "x402 payment required — sign a TransferTransaction and send PAYMENT-SIGNATURE.",
    });
  });

  return app;
}
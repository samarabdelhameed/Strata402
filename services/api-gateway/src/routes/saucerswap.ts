import type { Express, Request, Response } from "express";
import {
  SAUCER_BASE_URL,
  SaucerReadError,
  readSaucerTokens,
  readSaucerPools,
} from "../saucerswap";

export function mountSaucerSwapRoute(app: Express): void {
  app.get("/v1/defi/saucerswap", async (_req: Request, res: Response) => {
    res.type("json");
    try {
      const tokens = await readSaucerTokens(SAUCER_BASE_URL);
      const pools = await readSaucerPools(SAUCER_BASE_URL);
      res.json({
        status: "ok",
        source: "SaucerSwap Liquid",
        fetchedAt: new Date().toISOString(),
        tokens: {
          tokenCount: tokens.tokenCount,
          sampleSymbols: tokens.sampleSymbols,
          topPoolSymbols: tokens.topPoolSymbols,
        },
        pools: {
          poolCount: pools.poolCount,
          feeTiersSeen: pools.feeTiersSeen,
          pools: pools.pools,
        },
        apy: null,
        limitations: ["APY_UNAVAILABLE"],
      });
    } catch (err) {
      const code = err instanceof SaucerReadError ? err.code : "UNEXPECTED_ERROR";
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        status: "error",
        code,
        message,
        limitations: ["SAUCER_READ_FAILED", "APY_UNAVAILABLE"],
      });
    }
  });
}

import { DEFAULT_ASSET, DEFAULT_NETWORK, ENV_PRICE_TINYBARS, serviceAccountFromEnv } from "@strata402/x402-sdk";
import { buildApp } from "./server";
import { FACILITATOR_URL } from "./x402";

const port = Number(process.env.PORT ?? 8080);
const app = buildApp();

app.listen(port, () => {
  console.log(`[strata402] api-gateway listening on http://localhost:${port}`);
  console.log(`[strata402] network=${DEFAULT_NETWORK} asset=${DEFAULT_ASSET} priceTinybars=${process.env[ENV_PRICE_TINYBARS] ?? 1_000_000}`);
  console.log(`[strata402] payTo=${serviceAccountFromEnv()}`);
  console.log(`[strata402] facilitator=${FACILITATOR_URL}`);
});
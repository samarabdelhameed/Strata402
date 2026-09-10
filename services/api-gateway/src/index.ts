import { buildApp } from "./server";

const port = Number(process.env.PORT ?? 8080);
const app = buildApp();

app.listen(port, () => {
  console.log(`[strata402] api-gateway listening on http://localhost:${port}`);
});
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@strata402/x402-sdk", "@strata402/consuming-agent"],
  // Hiero/@x402 pull in pino; webpack-bundling pino breaks Node diagnostics
  // (`diagChan.tracingChannel is not a function`) on POST /api/paid.
  experimental: {
    serverComponentsExternalPackages: [
      "pino",
      "pino-pretty",
      "thread-stream",
      "@hiero-ledger/sdk",
      "@x402/hedera",
      "@x402/fetch",
      "@x402/core",
    ],
  },
};

export default nextConfig;
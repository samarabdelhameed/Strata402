/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@strata402/x402-sdk", "@strata402/consuming-agent"],
};

export default nextConfig;
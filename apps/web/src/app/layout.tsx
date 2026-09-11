import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strata402 — Autonomous AI DeFi Intelligence on Hedera",
  description:
    "Real x402-gated AI DeFi intelligence: live Hedera Mirror Node data, HCS-audited paid requests, and a fully deterministic risk engine. No mock data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
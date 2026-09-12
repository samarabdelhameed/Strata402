import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = { variable: "font-inter" };
const jetbrainsMono = { variable: "font-jetbrains" };

export const metadata: Metadata = {
  title: "Strata402 — Autonomous AI DeFi Intelligence on Hedera",
  description:
    "Real x402-gated AI DeFi intelligence: live Hedera Mirror Node data, HCS-audited paid requests, and a fully deterministic risk engine. No mock data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: browser extensions inject attrs (e.g. bis_skin_checked) that mismatch SSR.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
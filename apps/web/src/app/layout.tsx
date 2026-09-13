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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isExtensionError(e, msgStr) {
                  var s = String((e && e.stack) || e || "");
                  var f = String((e && e.filename) || "");
                  var msg = String(msgStr || (e && e.message) || e || "");
                  return s.indexOf("chrome-extension://") !== -1 ||
                         f.indexOf("chrome-extension://") !== -1 ||
                         msg.indexOf("M_ID") !== -1 ||
                         msg.indexOf("bis_skin_checked") !== -1;
                }
                window.addEventListener("error", function(e) {
                  if (isExtensionError(e.error || e, e.message)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return true;
                  }
                }, true);
                window.addEventListener("unhandledrejection", function(e) {
                  if (isExtensionError(e.reason)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return true;
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
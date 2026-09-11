"use client";

import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-10">{children}</main>
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-xs text-[#5d6573] md:flex-row">
          <div>
            Strata402 — autonomous AI DeFi intelligence on Hedera, monetized via x402
            micropayments.
          </div>
          <div className="mono">All data is live: gateway · Mirror Node · HCS 0.0.10483725</div>
        </div>
      </footer>
    </div>
  );
}
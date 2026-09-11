"use client";

import { Shell } from "@/components/Shell";
import { useApi } from "@/hooks/useApi";

interface ServicesResponse {
  ok: boolean;
  body?: Array<{
    id: string;
    name: string;
    status: "available" | "pending" | "unavailable";
    note: string;
  }>;
  error?: string;
}

export default function OrdersPage() {
  const services = useApi<ServicesResponse>("/api/services", 15_000);

  return (
    <Shell>
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold">AutoSwap Orders</h1>
        <p className="mt-1 text-sm text-[#8a93a3]">
          Programmatic order execution against Hedera DeFi (SaucerSwap / Bonzo / HCS-14). Every
          integrator shown honestly: no mock liquidity, no fabricated fills.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {services.data?.body?.map((s) => (
            <div key={s.id} className={`glass p-6 ${s.status === "pending" ? "border-[#00F2FE]/25" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{s.name}</div>
                <span
                  className={`chips ${
                    s.status === "available"
                      ? "chip-live"
                      : s.status === "pending"
                        ? "chip-warn"
                        : "chip-neutral"
                  }`}
                >
                  {s.status === "pending" ? "PENDING" : s.status === "available" ? "LIVE" : "—"}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#8a93a3]">{s.note}</p>
            </div>
          ))}
        </div>

        <div className="glass mt-8 p-6">
          <h2 className="font-semibold">Order pipeline</h2>
          <div className="mt-4 space-y-3">
            {[
              { n: "Step 1", t: "Audit intent", d: "Write signed intent to HCS audit topic", st: "ok" as const },
              { n: "Step 2", t: "Payment x402", d: "Exact-price settlement via Blocky402", st: "ok" as const },
              { n: "Step 3", t: "Delegate & execute", d: "Requires official SaucerSwap/Bonzo keys — gated", st: "pending" as const },
              { n: "Step 4", t: "Settle & verify", d: "Mirror-verified settlement proof", st: "pending" as const },
            ].map((step) => (
              <div
                key={step.n}
                className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4"
              >
                <div className="mono mt-0.5 text-[#00F2FE]">{step.n}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className={step.st === "ok" ? "text-[#1DE9B6]" : "text-[#FFB259]"}>
                      {step.st === "ok" ? "●" : "◐"}
                    </span>
                    {step.t}
                  </div>
                  <div className="mt-0.5 text-xs text-[#8a93a3]">{step.d}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#5d6573]">
            AutoSwap is intentionally <strong>not</strong> live until the SaucerSwap and Bonzo
            integrators can be exercised against protocols on the testnet. Displaying them as
            operating would be fabricated; we ship the honest gate instead.
          </p>
        </div>
      </div>
    </Shell>
  );
}
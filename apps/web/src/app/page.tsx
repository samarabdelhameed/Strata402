"use client";

import Link from "next/link";
import { Shell } from "@/components/Shell";
import { useApi } from "@/hooks/useApi";

interface StatusResponse {
  gateway: {
    baseUrl: string;
    ok: boolean;
    health: {
      service?: string;
      version?: string;
      network?: string;
      x402Version?: number;
      timestamp?: string;
    };
  };
  services: {
    ok: boolean;
    body?: {
      network?: string;
      payTo?: string;
      services?: Array<{
        id?: string;
        name?: string;
        priceTinybars?: number;
        asset?: string;
      }>;
    };
  };
}

interface HcsResponse {
  ok: boolean;
  topicId: string;
  messages: Array<{
    sequenceNumber: number;
    consensusTimestamp: string;
    message: string;
  }>;
  error?: string;
}

function StatCard({
  label,
  value,
  sub,
  accent,
  skeleton,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "cyan" | "emerald" | "amber";
  skeleton?: boolean;
}) {
  const color =
    accent === "cyan"
      ? "text-[#00F2FE]"
      : accent === "emerald"
        ? "text-[#1DE9B6]"
        : accent === "amber"
          ? "text-[#FFB259]"
          : "text-white";
  return (
    <div className="glass p-5">
      <div className="label">{label}</div>
      {skeleton ? (
        <div className="skeleton mt-2 h-7 w-2/3" />
      ) : (
        <div className={`mono mt-1 text-2xl font-bold ${color}`}>{value}</div>
      )}
      {sub ? <div className="mt-1 text-xs text-[#5d6573]">{sub}</div> : null}
    </div>
  );
}

export default function LandingPage() {
  const status = useApi<StatusResponse>("/api/status", 15_000);
  const hcs = useApi<HcsResponse>("/api/hcs?limit=6", 15_000);

  const health = status.data?.gateway.health;
  const service = status.data?.services.body?.services?.[0];
  const priceTinybars = service?.priceTinybars;
  const payTo = status.data?.services.body?.payTo;
  const lastAudit = hcs.data?.ok ? hcs.data.messages[0] : null;

  return (
    <Shell>
      <section className="animate-fade-up pt-8 text-center">
        <span className="chips chip-live mb-6">x402 v2 · Blocky402 settlement · Hedera testnet</span>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Autonomous AI DeFi intelligence,{" "}
          <span className="bg-gradient-to-r from-[#00F2FE] to-[#4FACFE] bg-clip-text text-transparent">
            paid per call
          </span>
          , on Hedera
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[#8a93a3]">
          Institutional risk analytics for Hedera positions. An agent discovers the service,
          settles an HBAR micropayment through Blocky402, and receives a deterministic analysis
          built from real Mirror Node facts — audited on HCS, proven on-chain.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="btn btn-cyan">
            Launch AI Studio
          </Link>
          <Link href="/audit" className="btn btn-ghost">
            View Live HCS Audit Feed
          </Link>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Service / gateway"
          value={health ? String(health.service ?? "—") : "…"}
          sub={status.data?.gateway.baseUrl}
          accent="cyan"
          skeleton={status.loading}
        />
        <StatCard
          label="x402 version"
          value={health?.x402Version !== undefined ? String(health.x402Version) : "…"}
          sub={health?.network}
          accent="cyan"
          skeleton={status.loading}
        />
        <StatCard
          label="Price per analysis"
          value={
            priceTinybars !== undefined
              ? `${(priceTinybars / 1e8).toFixed(2)} HBAR`
              : "…"
          }
          sub={
            priceTinybars !== undefined
              ? `${priceTinybars.toLocaleString("en-US")} tinybars`
              : undefined
          }
          accent="emerald"
          skeleton={status.loading}
        />
        <StatCard
          label="Last HCS audit"
          value={lastAudit ? `seq ${lastAudit.sequenceNumber}` : "…"}
          sub={lastAudit?.consensusTimestamp}
          accent="amber"
          skeleton={hcs.loading}
        />
      </section>

      <div className="mono mt-3 text-right text-xs text-[#5d6573]">
        {payTo ? `service payTo: ${payTo}` : null}
      </div>

      {status.error ? (
        <div className="glass mt-8 border-[#FF5252]/40 p-4 text-sm text-[#FFB259]">
          Gateway unreachable: {status.error}. Start the gateway (services/api-gateway) on :8080
          and the ai-engine on :8000 before using this dashboard.
        </div>
      ) : null}

      <section className="mt-16">
        <h2 className="text-xl font-bold">How it works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Discover & challenge",
              d: "The agent reads the real service manifest, then triggers an HTTP 402 Payment Required from the live gateway.",
            },
            {
              n: "02",
              t: "Settle in HBAR",
              d: "A real 0.01 HBAR exact transfer is verified and settled through Blocky402, provable on HashScan.",
            },
            {
              n: "03",
              t: "Deterministic analysis",
              d: "The paid response is a deterministic narrative over real Mirror Node facts. No risk scores are invented.",
            },
          ].map((item) => (
            <div key={item.n} className="glass p-6">
              <div className="mono text-xs text-[#00F2FE]">{item.n}</div>
              <h3 className="mt-2 font-semibold">{item.t}</h3>
              <p className="mt-2 text-sm text-[#8a93a3]">{item.d}</p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
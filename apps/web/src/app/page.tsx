"use client";

import Link from "next/link";
import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { usePayment, DEFAULT_ACCOUNT } from "@/components/PaymentSheet";
import { useApi } from "@/hooks/useApi";

interface StatusResponse {
  gateway: {
    baseUrl: string;
    ok: boolean;
    health: { service?: string; version?: string; network?: string; x402Version?: number };
  };
  aiEngine: { baseUrl: string; ok: boolean; health: { service?: string } };
  mirror: { ok: boolean };
  hcs: { topicId: string; configured: boolean };
  services: {
    ok: boolean;
    body?: {
      network?: string;
      payTo?: string;
      services?: Array<{ id?: string; name?: string; priceTinybars?: number; asset?: string }>;
    };
  };
}

interface HcsResponse {
  ok: boolean;
  topicId: string;
  messages: Array<{ sequenceNumber: number; consensusTimestamp: string }>;
  error?: string;
}

interface AccountResponse {
  ok: boolean;
  exists: boolean;
  balanceHbar: string;
}

export default function LandingPage() {
  const { openPay } = usePayment();
  const [gatedNote, setGatedNote] = useState(false);
  const status = useApi<StatusResponse>("/api/status", 15_000);
  const hcs = useApi<HcsResponse>("/api/hcs?limit=3", 15_000);
  const account = useApi<AccountResponse>(
    `/api/account?accountId=${DEFAULT_ACCOUNT}`,
    30_000,
  );

  const firstService = status.data?.services.body?.services?.[0];
  const priceTinybars = firstService?.priceTinybars;
  const priceHbar =
    priceTinybars !== undefined ? (priceTinybars / 1e8).toFixed(2) : "…";
  const serviceName = firstService?.name ?? status.data?.gateway.health.service ?? "…";
  const health = status.data?.gateway.health;
  const payTo = status.data?.services.body?.payTo ?? "0.0.10464194";
  const topicId = status.data?.hcs.topicId || "0.0.10483725";
  const lastAudit = hcs.data?.ok ? hcs.data.messages[0] : null;
  const balance = account.data?.exists
    ? Number(account.data.balanceHbar).toFixed(2)
    : "…";

  function onGated() {
    setGatedNote(true);
  }

  return (
    <AppFrame>
      <div className="screen">
        <div className="hero">
          <div className="eyebrow">🤖 AUTONOMOUS DEFI AGENT · HEDERA</div>
          <h1>Institutional risk intelligence, paid per call.</h1>
          <p>
            Real Mirror Node data, x402 micropayments settled via Blocky402, every request
            audited on HCS.
          </p>
          <div className="hero-cta">
            <Link href="/studio" className="btn btn-primary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
              Launch AI Studio
            </Link>
            <Link href="/audit" className="btn btn-ghost">
              View HCS Feed
            </Link>
          </div>
        </div>

        <div className="stats-row stagger">
          <div className="stat-tile">
            <div className="label">SERVICE / GATEWAY</div>
            <div className="value cyan" style={{ fontSize: 14 }}>
              {status.loading ? "…" : serviceName}
            </div>
            <div className="sub">x402 v{health?.x402Version ?? "·"} · {health?.network ?? "hestera"}</div>
          </div>
          <div className="stat-tile">
            <div className="label">PRICE / CALL</div>
            <div className="value emerald">{status.loading ? "…" : `${priceHbar} HBAR`}</div>
            <div className="sub">exact · 1,000,000 tinybars</div>
          </div>
          <div className="stat-tile">
            <div className="label">HCS TOPIC ID</div>
            <div className="value" style={{ fontSize: 13 }}>
              {status.loading ? "…" : topicId}
            </div>
            <div className="sub">
              {lastAudit ? `seq ${lastAudit.sequenceNumber} · live` : "…"}
            </div>
          </div>
          <div className="stat-tile">
            <div className="label">PAYER ACCOUNT</div>
            <div className="value" style={{ fontSize: 15 }}>
              {DEFAULT_ACCOUNT}
            </div>
            <div className="sub">{account.data ? `${balance} HBAR` : "…"}</div>
          </div>
        </div>

        <div className="section-title">
          Agent Marketplace{" "}
          <Link href="/audit">HCS-14 registry →</Link>
        </div>

        <div className="stagger">
          <div className="card agent-card">
            <div className="agent-icon" style={{ background: "rgba(0,242,254,.12)", color: "var(--cyan)" }}>
              ◆
            </div>
            <div className="agent-info">
              <div className="name">Strata402 Core Agent</div>
              <div className="price">
                {status.loading ? "…" : `${priceHbar} HBAR / call`} · payTo {payTo}
              </div>
            </div>
            <button className="mini-btn" onClick={() => openPay("Strata402 Core Agent")}>
              Try demo
            </button>
          </div>

          <div className="card agent-card">
            <div className="agent-icon" style={{ background: "rgba(0,230,118,.12)", color: "var(--emerald)" }}>
              ⟲
            </div>
            <div className="agent-info">
              <div className="name">SaucerSwap LP Optimizer</div>
              <div className="price">GATED · awaiting official SaucerSwap testnet key</div>
            </div>
            <button className="mini-btn emerald-o" disabled onClick={onGated}>
              Try demo
            </button>
          </div>

          <div className="card agent-card">
            <div className="agent-icon" style={{ background: "rgba(255,145,0,.12)", color: "var(--warn)" }}>
              ⛨
            </div>
            <div className="agent-info">
              <div className="name">Bonzo Risk Guard</div>
              <div className="price">GATED · awaiting official Bonzo protocol keys</div>
            </div>
            <button className="mini-btn warn-o" disabled onClick={onGated}>
              Try demo
            </button>
          </div>
        </div>

        {gatedNote ? (
          <div className="card" style={{ marginTop: 4, borderLeft: "3px solid var(--warn)" }}>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--warn)" }}>
              Honest gate — no fabricated prices.
            </div>
            <div className="note" style={{ marginTop: 4 }}>
              AutoSwap and Bonzo integrators will not be shown as operating until their official
              testnet protocol keys exist and can be exercised for real. Displayed prices would
              be invented numbers, so they are withheld.
            </div>
          </div>
        ) : null}

        {status.error ? (
          <div className="error-box" style={{ marginTop: 16 }}>
            Gateway unreachable: {status.error}. Start the gateway (:8080) and ai-engine (:8000)
            before using this dashboard.
          </div>
        ) : null}
      </div>
    </AppFrame>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { usePayment, DEFAULT_ACCOUNT } from "@/components/PaymentSheet";
import { useApi } from "@/hooks/useApi";

interface ActivityResponse {
  ok: boolean;
  total: number;
  inflowHbar: string;
  outflowHbar: string;
  netHbar: string;
  fromTs: number | null;
  buckets: Array<{ label: string; count: number }>;
  error?: string;
}

interface AccountResponse {
  ok: boolean;
  exists: boolean;
  balanceHbar: string;
  balanceTinybars: string;
  error?: string;
}

const CIRCUMFERENCE = 2 * Math.PI * 54;

function Gauge({ fraction, center, label }: { fraction: number; center: string; label: string }) {
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const clamped = Math.min(Math.max(fraction, 0), 1);
  useEffect(() => {
    const id = window.setTimeout(() => setOffset(CIRCUMFERENCE * (1 - clamped)), 180);
    return () => window.clearTimeout(id);
  }, [clamped]);
  return (
    <div className="gauge-wrap">
      <div className="gauge">
        <svg width="130" height="130">
          <circle cx="65" cy="65" r="54" stroke="rgba(255,255,255,.06)" strokeWidth="10" fill="none" />
          <circle
            cx="65"
            cy="65"
            r="54"
            stroke="url(#g1)"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
          />
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00E676" />
              <stop offset="100%" stopColor="#1DE9B6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="gauge-center">
          <div className="num">{center}</div>
          <div className="lbl">{label}</div>
        </div>
      </div>
      <div className="risk-tag warn">No fabricated risk score</div>
    </div>
  );
}

function ActivityChart({ buckets }: { buckets: Array<{ label: string; count: number }> }) {
  const counts = buckets.map((b) => b.count);
  const max = Math.max(...counts, 1);
  const width = 300;
  const height = 90;
  const n = buckets.length;
  const points = counts.map((c, i) => {
    const x = n === 1 ? width : (i / (n - 1)) * width;
    const y = height - 8 - (c / max) * (height - 16);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ marginTop: 10, overflow: "visible" }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,242,254,.35)" />
          <stop offset="100%" stopColor="rgba(0,242,254,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(0,242,254,.6))" }}
      />
      <circle cx={last.x} cy={last.y} r="4" fill="#fff" style={{ filter: "drop-shadow(0 0 6px #00F2FE)" }} />
    </svg>
  );
}

interface SaucerPool {
  id: number;
  contractId: string;
  pair: string;
  feeTierPercent: string;
  liquidity: string;
  apyStatus: string;
}

interface SaucerSwapResponse {
  ok: boolean;
  readOnly?: boolean;
  tokenCount?: number;
  poolCount?: number;
  pools?: SaucerPool[];
  error?: string;
}

interface BonzoReserve {
  symbol: string;
  tokenId: string;
  ltvPercent: number | null;
  liquidationThresholdPercent: number | null;
  reserveFactorPercent: number | null;
  supplyApy?: number;
  apyStatus: string;
}

interface BonzoResponse {
  ok: boolean;
  status?: string;
  readOnly?: boolean;
  protocol?: string;
  reservesCount?: number;
  reserves?: BonzoReserve[];
  message?: string;
  apyStatus?: string;
  error?: string;
}

export default function DashboardPage() {
  const { openPay } = usePayment();
  const account = useApi<AccountResponse>(`/api/account?accountId=${DEFAULT_ACCOUNT}`, 30_000);
  const activity = useApi<ActivityResponse>(
    `/api/tx-activity?accountId=${DEFAULT_ACCOUNT}&buckets=12`,
    30_000,
  );
  const saucerswap = useApi<SaucerSwapResponse>("/api/saucerswap", 60_000);
  const bonzo = useApi<BonzoResponse>("/api/bonzo", 60_000);

  const balance = account.data?.exists ? Number(account.data.balanceHbar).toFixed(2) : "…";
  const net = Number(activity.data?.netHbar ?? 0);
  const fraction =
    activity.data && Number(balance) > 0
      ? Math.min(Math.abs(net) / Number(balance), 1)
      : 0;

  const frame = useMemo(() => {
    if (!activity.data?.buckets?.length) return null;
    return { label: `${activity.data.buckets[0].label} UTC → ${activity.data.buckets.at(-1)?.label} UTC` };
  }, [activity.data]);

  return (
    <AppFrame>
      <div className="screen">
        <div className="nav-strip">
          <span>
            PAYER <b style={{ color: "var(--text-primary)" }}>{DEFAULT_ACCOUNT}</b>
          </span>
          <span className="badge-live">
            <span className="d"></span>TESTNET
          </span>
        </div>

        <div className="dash-split">
          <div className="card" style={{ padding: "16px 8px" }}>
            <Gauge
              fraction={fraction}
              center={balance}
              label="HBAR BALANCE"
            />
            <div className="stat-grid" style={{ marginTop: 12 }}>
              <div className="stat-tile">
                <div className="label">30D TX COUNT</div>
                <div className="value">{activity.data ? activity.data.total : "…"}</div>
              </div>
              <div className="stat-tile">
                <div className="label">30D FLOW IN</div>
                <div className="value" style={{ fontSize: 15 }}>{activity.data ? activity.data.inflowHbar : "…"}</div>
              </div>
              <div className="stat-tile">
                <div className="label">30D FLOW OUT</div>
                <div className="value" style={{ fontSize: 15 }}>{activity.data ? activity.data.outflowHbar : "…"}</div>
              </div>
            </div>
            <div className="note" style={{ marginTop: 10, textAlign: "center" }}>
              Real on-chain facts from the public Mirror Node · {activity.data?.total ?? "…"} txs observed
              {activity.data?.error ? ` · ${activity.data.error}` : ""}
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <div className="eyebrow">ACCOUNT ACTIVITY</div>
                <div className="big-num">{activity.data ? `${activity.data.total} TX` : "…"}</div>
              </div>
              <div className="delta">{activity.data ? `${net} HBAR net` : "…"}</div>
            </div>
            {activity.loading && !activity.data ? <div className="skeleton" style={{ height: 90, marginTop: 10 }} /> : null}
            {activity.data?.buckets?.length ? <ActivityChart buckets={activity.data.buckets} /> : null}
            {activity.data?.error && !activity.data.buckets.length ? (
              <div className="error-box" style={{ marginTop: 10 }}>{activity.data.error}</div>
            ) : null}
            <div className="timeframes">
              <span className="tf active">Live</span>
              <span className="tf">{frame ? `${frame.label}` : "—"}</span>
            </div>
          </div>
        </div>

        <button
          className="btn btn-emerald btn-block"
          style={{ marginTop: 14 }}
          onClick={() => openPay("Portfolio Health Scan")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
          </svg>
          Run AI Portfolio Health Scan
        </button>

        <div className="section-title">
          SaucerSwap V2 Pools
          {saucerswap.data?.poolCount ? (
            <span style={{ fontSize: 11, color: "var(--emerald)", fontWeight: 400, marginLeft: 8 }}>
              {saucerswap.data.poolCount} pools observed · {saucerswap.data.tokenCount} tokens
            </span>
          ) : null}
        </div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pool</th>
                <th>Fee Tier</th>
                <th>Contract</th>
                <th>APY</th>
              </tr>
            </thead>
            <tbody>
              {saucerswap.data?.pools?.length ? (
                saucerswap.data.pools.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="pair-cell">
                        <span className="coin-dot" style={{ background: "linear-gradient(135deg,#00E676,#1DE9B6)" }}></span>
                        {p.pair}
                      </div>
                    </td>
                    <td>{p.feeTierPercent}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.contractId}</td>
                    <td>
                      <span className="risk-tag warn" style={{ padding: "2px 6px", fontSize: 10 }}>
                        UNAVAILABLE
                      </span>
                    </td>
                  </tr>
                ))
              ) : saucerswap.loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 12 }}>
                    Loading SaucerSwap Testnet pools…
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 12 }}>
                    {saucerswap.data?.error || "SaucerSwap Testnet pools unavailable"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="note" style={{ marginTop: 10 }}>
            Read-only DEX snapshot from SaucerSwap Testnet API. APY is withheld: public wire facts carry no historical volume/fee earnings.
          </div>
        </div>

        <div className="section-title">
          Bonzo Lending Matrix
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 8 }}>
            {bonzo.data?.status === "available"
              ? `real · live /market read · ${bonzo.data.reservesCount ?? "…"} reserves`
              : "pending · not live"}
          </span>
        </div>
        <div className="card">
          <div className="note" style={{ padding: "8px 0" }}>
            {bonzo.data?.message ||
              "No eligible live Bonzo Testnet API is wired. Static parameter snapshots are not claimed as live market data. APY UNAVAILABLE."}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Token ID</th>
                <th>LTV</th>
                <th>Liq. Threshold</th>
                <th>APY Status</th>
              </tr>
            </thead>
            <tbody>
              {bonzo.data?.reserves?.length ? (
                bonzo.data.reserves.map((r) => (
                  <tr key={`${r.tokenId}-${r.symbol}`}>
                    <td>
                      <div className="pair-cell">
                        <span className="coin-dot" style={{ background: "linear-gradient(135deg,#B388FF,#7C4DFF)" }}></span>
                        {r.symbol}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.tokenId}</td>
                    <td>{r.ltvPercent != null ? `${Math.round(r.ltvPercent * 100)}%` : "—"}</td>
                    <td>{r.liquidationThresholdPercent != null ? `${Math.round(r.liquidationThresholdPercent * 100)}%` : "—"}</td>
                    <td>
                      {r.supplyApy != null ? (
                        <span style={{ color: "var(--emerald)" }}>
                          {r.supplyApy}%
                        </span>
                      ) : (
                        <span className="risk-tag warn" style={{ padding: "2px 6px", fontSize: 10 }}>
                          UNAVAILABLE
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : bonzo.loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 12 }}>
                    Probing Bonzo Lend /market…
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 12 }}>
                    Bonzo adapter pending — reserves not claimed
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  );
}
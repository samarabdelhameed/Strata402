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

export default function DashboardPage() {
  const { openPay } = usePayment();
  const account = useApi<AccountResponse>(`/api/account?accountId=${DEFAULT_ACCOUNT}`, 30_000);
  const activity = useApi<ActivityResponse>(
    `/api/tx-activity?accountId=${DEFAULT_ACCOUNT}&buckets=12`,
    30_000,
  );

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

        <div className="card" style={{ padding: "16px 8px" }}>
          <Gauge
            fraction={fraction}
            center={balance}
            label="HBAR BALANCE"
          />
          <div className="stagger" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 8px" }}>
            <div className="stat-tile">
              <div className="label">30D FLOW IN</div>
              <div className="value emerald" style={{ fontSize: 15 }}>{activity.data ? `${activity.data.inflowHbar}` : "…"}</div>
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

        <div className="card chart-card" style={{ marginTop: 14 }}>
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

        <div className="section-title">SaucerSwap V2 Pools</div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pool</th>
                <th>TVL</th>
                <th>APY</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="pair-cell">
                    <span className="coin-dot" style={{ background: "linear-gradient(135deg,#8247e5,#c2a2ff)" }}></span>
                    HBAR/USDC
                  </div>
                </td>
                <td>—</td>
                <td>—</td>
                <td><button className="mini-btn" disabled>Gated</button></td>
              </tr>
              <tr>
                <td>
                  <div className="pair-cell">
                    <span className="coin-dot" style={{ background: "linear-gradient(135deg,#00E676,#1DE9B6)" }}></span>
                    HBAR/SAUCE
                  </div>
                </td>
                <td>—</td>
                <td>—</td>
                <td><button className="mini-btn" disabled>Gated</button></td>
              </tr>
            </tbody>
          </table>
          <div className="note" style={{ marginTop: 10 }}>
            Values withheld: official SaucerSwap testnet token/routing feeds are not yet live.
          </div>
        </div>

        <div className="section-title">Bonzo Lending Matrix</div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Supply</th>
                <th>Borrow</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="pair-cell">
                    <span className="coin-dot" style={{ background: "linear-gradient(135deg,#4FACFE,#00F2FE)" }}></span>
                    HBAR
                  </div>
                </td>
                <td>—</td>
                <td>—</td>
                <td><button className="mini-btn emerald-o" disabled>Gated</button></td>
              </tr>
              <tr>
                <td>
                  <div className="pair-cell">
                    <span className="coin-dot" style={{ background: "linear-gradient(135deg,#2775CA,#5AC1FF)" }}></span>
                    USDC
                  </div>
                </td>
                <td>—</td>
                <td>—</td>
                <td><button className="mini-btn emerald-o" disabled>Gated</button></td>
              </tr>
            </tbody>
          </table>
          <div className="note" style={{ marginTop: 10 }}>
            Rates withheld: Bonzo testnet cannot be exercised yet — no invented APY.
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
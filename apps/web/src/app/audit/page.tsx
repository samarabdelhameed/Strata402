"use client";

import { useMemo } from "react";
import { AppFrame } from "@/components/AppFrame";
import { useApi } from "@/hooks/useApi";

interface HcsRead {
  ok: boolean;
  topicId: string;
  messages: Array<{
    sequenceNumber: number;
    consensusTimestamp: string;
    runningHash: string;
    message: string;
    payerAccountId: string | null;
  }>;
  error?: string;
}

interface AuditEvent {
  requestId?: string;
  endpoint?: string;
  status?: string;
  paymentTxId?: string | null;
  blockTimestamp?: string | null;
  at?: string;
}

function parseEvent(raw: string): AuditEvent | null {
  try {
    const parsed = JSON.parse(raw) as AuditEvent;
    if (typeof parsed.requestId === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

function fmtTime(consensusTimestamp: string): string {
  const sec = Number(consensusTimestamp);
  if (!Number.isFinite(sec) || sec <= 0) return consensusTimestamp;
  return new Date(sec * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function volumeBuckets(messages: HcsRead["messages"], n = 12) {
  const ts = messages.map((m) => Number(m.consensusTimestamp)).filter((t) => Number.isFinite(t) && t > 0);
  if (ts.length === 0) return [];
  const from = Math.min(...ts);
  const to = Math.max(...ts);
  const span = Math.max(to - from, 1);
  const step = span / n;
  const counts = Array<number>(n).fill(0);
  for (const t of ts) {
    const i = Math.min(Math.floor((t - from) / step), n - 1);
    counts[i] += 1;
  }
  const max = Math.max(...counts, 1);
  return counts.map((c, i) => ({
    label: new Date((from + i * step) * 1000).toISOString().slice(11, 16),
    pct: Math.max(2, Math.round((c / max) * 80)),
    count: c,
  }));
}

function exportCsv(messages: HcsRead["messages"]) {
  const header = "seq,consensus_timestamp,requestId,endpoint,status,paymentTxId,at";
  const lines = messages.map((m) => {
    const ev = parseEvent(m.message);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      m.sequenceNumber,
      esc(m.consensusTimestamp),
      esc(ev?.requestId ?? ""),
      esc(ev?.endpoint ?? ""),
      esc(ev?.status ?? m.message.slice(0, 24)),
      esc(ev?.paymentTxId ?? ""),
      esc(ev?.at ?? ""),
    ].join(",");
  });
  const blob = new Blob([`${header}\n${lines.join("\n")}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "strata402-hcs-audit.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const hcs = useApi<HcsRead>("/api/hcs?limit=50", 10_000);
  const bars = useMemo(() => volumeBuckets(hcs.data?.messages ?? []), [hcs.data]);
  const hashscanTopic = hcs.data?.topicId
    ? `https://hashscan.io/testnet/topic/${hcs.data.topicId}`
    : null;

  return (
    <AppFrame>
      <div className="screen">
        <div className="topic-pill">
          🔍 HCS Topic <b style={{ color: "var(--text-primary)" }}>{hcs.data?.topicId ?? "—"}</b>
          <span className={hcs.data?.ok ? "chip chip-live" : "chip chip-pending"}>
            {hcs.data?.ok ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        <div className="card">
          <div className="eyebrow">x402 PAYMENT VOLUME / HR</div>
          {hcs.loading && !hcs.data ? <div className="skeleton" style={{ height: 80, marginTop: 14 }} /> : null}
          {bars.length ? (
            <div>
              <div className="bars">
                {bars.map((b, i) => (
                  <div
                    key={i}
                    className="bar"
                    style={{ height: `${b.pct}%` }}
                    title={`${b.count} request${b.count === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
              <div className="bars" style={{ height: "auto", marginTop: 6 }}>
                {bars.map((b, i) => (
                  <div key={i} className="bar-label">
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {hcs.data && !hcs.data.ok ? (
            <div style={{ marginTop: 12 }} className="error-box">
              {hcs.data.error}
            </div>
          ) : null}
        </div>

        <div className="section-title">
          Audit Log
          <span className="badge-live">
            <span className="d"></span>Live
          </span>
        </div>
        <div className="card">
          {hcs.loading && !hcs.data ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : null}
          {hcs.data?.ok && hcs.data.messages.length === 0 ? (
            <div className="note" style={{ textAlign: "center", padding: 12 }}>
              No messages published to this topic yet.
            </div>
          ) : null}
          {hcs.data?.messages.map((m) => {
            const ev = parseEvent(m.message);
            const id = ev?.requestId ?? `seq ${m.sequenceNumber}`;
            const svc = ev ? `${ev.endpoint ?? "?"} · ${fmtTime(m.consensusTimestamp)}` : `raw · ${fmtTime(m.consensusTimestamp)}`;
            const fee = ev?.paymentTxId ? `0x…${ev.paymentTxId.slice(-8)}` : `${m.sequenceNumber} HBAR`;
            const settled = ev ? ev.status === "200" || ev.paymentTxId !== null : false;
            return (
              <div className="audit-row" key={m.sequenceNumber}>
                <div className="audit-left">
                  <div className="id">{id}</div>
                  <div className="svc">{svc}</div>
                </div>
                <div className="audit-right">
                  <div className="fee">{fee}</div>
                  <span className={`status-chip ${settled ? "settled" : ""}`}>
                    <span className="d"></span>
                    {settled ? "Settled" : "Audited"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hero-cta" style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={hcs.refresh} disabled={hcs.loading}>
            🔄 Refresh feed
          </button>
          <button
            className="btn btn-ghost"
            disabled={!hcs.data || hcs.data.messages.length === 0}
            onClick={() => hcs.data && exportCsv(hcs.data.messages)}
          >
            📥 Export CSV
          </button>
        </div>
        {hashscanTopic ? (
          <a className="btn btn-primary btn-block" style={{ marginTop: 10 }} href={hashscanTopic} target="_blank" rel="noreferrer">
            🔗 View Topic on HashScan
          </a>
        ) : null}
      </div>
    </AppFrame>
  );
}
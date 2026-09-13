"use client";

import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { usePayment, DEFAULT_ACCOUNT } from "@/components/PaymentSheet";
import { useApi } from "@/hooks/useApi";
import PaidAnalysisResult from "@/components/PaidAnalysisResult";
import { buildStudioAnalysisView, requestIdConsistency, type StudioAnalysisView } from "@/lib/assistant";

interface AccountResponse {
  ok: boolean;
  exists: boolean;
  balanceHbar: string;
  balanceTimestamp?: string | null;
  recent30dHbarIn?: string;
  recent30dHbarOut?: string;
  transactionCount?: number;
}

interface StatusResponse {
  services: {
    body?: {
      services?: Array<{ priceTinybars?: number }>;
    };
  };
}

interface HcsResponse {
  ok: boolean;
  topicId: string;
  messages: Array<{ sequenceNumber: number; runningHash: string; message?: string }>;
  error?: string;
}

interface ActivityResponse {
  ok: boolean;
  total: number;
  inflowHbar: string;
  outflowHbar: string;
  netHbar: string;
  fromTs: number | null;
  toTs: number | null;
  error?: string;
}

interface SaucerResponse {
  ok: boolean;
  readOnly?: boolean;
  poolCount?: number;
  tokenCount?: number;
  apyStatus?: string;
  error?: string;
}

interface Settlement {
  verified: boolean;
  transactionId: string;
  payerAccountId: string;
  recipientAccountId: string;
  amountTinybars: string;
  consensusTimestamp?: string | null;
}

interface PaidResult {
  ok: boolean;
  code?: string;
  message?: string;
  paymentStatus?: string | null;
  settlement?: Settlement | null;
  narrativePoints?: string[];
  audit?: {
    requestId?: string;
    topicId?: string;
    sequenceNumber?: number;
    status?: string;
  };
}

interface ChatMsg {
  role: "ai" | "user";
  text: string;
  badge?: string;
}

type StepState = "pending" | "done" | "idle" | "gated";

export default function StudioPage() {
  const { openPay } = usePayment();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<StudioAnalysisView | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepPay, setStepPay] = useState<StepState>("idle");
  const [stepAnalysis, setStepAnalysis] = useState<StepState>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  const account = useApi<AccountResponse>(`/api/account?accountId=${DEFAULT_ACCOUNT}`, 30_000);
  const status = useApi<StatusResponse>("/api/status", 30_000);
  const hcs = useApi<HcsResponse>("/api/hcs?limit=2", 20_000);
  const activity = useApi<ActivityResponse>(
    `/api/tx-activity?accountId=${DEFAULT_ACCOUNT}&buckets=8`,
    30_000,
  );
  const saucer = useApi<SaucerResponse>("/api/saucerswap", 30_000);

  const priceHbar =
    status.data?.services.body?.services?.[0]?.priceTinybars !== undefined
      ? (status.data.services.body.services[0].priceTinybars / 1e8).toFixed(2)
      : "0.01";
  const balance = account.data?.exists
    ? Number(account.data.balanceHbar).toFixed(4)
    : "…";
  const topicId = hcs.data?.topicId || "0.0.10483725";
  const lastSeq = hcs.data?.ok ? hcs.data.messages[0]?.sequenceNumber : null;
  const runningHash = hcs.data?.ok ? hcs.data.messages[0]?.runningHash : null;

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "ai",
          text: `Hi — I can analyze live Hedera account data (${DEFAULT_ACCOUNT} holds ${balance} HBAR on hedera:testnet) and return a paid, auditable risk assessment. Strategy execution is currently read-only and gated, so this session never moves or trades funds. Each analysis settles exactly ${priceHbar} HBAR via Blocky402 and is audited on HCS ${topicId}${
            lastSeq ? ` (last seq ${lastSeq})` : ""
          }. Send any prompt to start.`,
          badge: "⚡ x402 exact · Blocky402 · hedera:testnet · execution gated",
        },
      ]);
    }
  }, [balance, priceHbar, topicId, lastSeq, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function sendChat(override?: string) {
    const text = (override ?? composerValue).trim();
    if (text === "" || busy) return;
    setComposerValue("");
    setBusy(true);
    setStepPay("pending");
    setMessages((prev) => [...prev, { role: "user", text }]);
    await new Promise((r) => setTimeout(r, 700));
    try {
      const res = await fetch("/api/paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: DEFAULT_ACCOUNT, riskTolerance: "balanced", amountHbar: 1 }),
      });
      const json = (await res.json()) as PaidResult;
      if (json.ok && json.settlement) {
        setStepPay("done");
        setStepAnalysis("done");
        const s = json.settlement;

        // Defensive check: the requestId echoed by /api/paid must equal the
        // requestId inside the on-chain HCS audit message. Read the freshest
        // audit message after settlement; best-effort, never blocks the flow.
        let hcsRequestId: string | undefined;
        try {
          const fresh = await fetch("/api/hcs?limit=1", { cache: "no-store" });
          const freshJson = (await fresh.json()) as HcsResponse;
          if (freshJson.ok && freshJson.messages.length > 0) {
            const auditMsg = freshJson.messages[0]?.message;
            if (typeof auditMsg === "string" && auditMsg.trim() !== "") {
              const parsed = JSON.parse(auditMsg) as Record<string, unknown>;
              if (typeof parsed.requestId === "string") hcsRequestId = parsed.requestId;
            }
          }
        } catch {
          hcsRequestId = undefined;
        }
        const consistency = requestIdConsistency(json.audit?.requestId, hcsRequestId);

        const view = buildStudioAnalysisView({
          accountId: DEFAULT_ACCOUNT,
          network: "hedera:testnet",
          analyzedAt: new Date().toISOString(),
          topicId,
          balanceHbar: account.data?.balanceHbar,
          balanceExists: account.data?.exists,
          activity: activity.data
            ? {
                ok: activity.data.ok,
                total: activity.data.total,
                inflowHbar: activity.data.inflowHbar,
                outflowHbar: activity.data.outflowHbar,
                netHbar: activity.data.netHbar,
                fromTs: activity.data.fromTs,
                toTs: activity.data.toTs,
                error: activity.data.error,
              }
            : null,
          saucer: saucer.data
            ? {
                ok: saucer.data.ok,
                readOnly: saucer.data.readOnly,
                poolCount: saucer.data.poolCount,
                tokenCount: saucer.data.tokenCount,
                apyStatus: saucer.data.apyStatus,
                error: saucer.data.error,
              }
            : null,
          hcsOnline: hcs.data?.ok === true,
          hcsLastSeq: lastSeq,
          settlement: {
            verified: s.verified,
            transactionId: s.transactionId,
            payerAccountId: s.payerAccountId,
            recipientAccountId: s.recipientAccountId,
            amountTinybars: s.amountTinybars,
            consensusTimestamp: s.consensusTimestamp ?? undefined,
          },
          narrativePoints: json.narrativePoints,
          audit: json.audit
            ? {
                requestId: json.audit.requestId,
                topicId: json.audit.topicId,
                sequenceNumber: json.audit.sequenceNumber,
                status: json.audit.status,
              }
            : null,
          hcsAuditConsistency: { ok: consistency.ok, reason: consistency.reason },
        });
        setLatestAnalysis(view);

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `Payment settled: ${priceHbar} HBAR via Blocky402. Risk assessment completed using live Hedera Mirror Node data. Execution status: Not executed — the strategy execution layer is gated and no funds were moved. Full sectioned analysis below.`,
            badge: `⚡ Settled ${priceHbar} HBAR · execution gated`,
          },
        ]);
      } else {
        setStepPay("idle");
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `Paid pipeline could not settle on this deployment (${json.code ?? "?"}: ${json.message}). No payment was fabricated — check the server env.`,
            badge: "⚠ x402 closed",
          },
        ]);
      }
    } catch (error) {
      setStepPay("idle");
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          badge: "⚠ x402 closed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <div className="screen">
        <div className="eyebrow">
          💬 AI STRATEGY ASSISTANT
          <span className="badge-live" style={{ marginLeft: 4 }}>
            <span className="d"></span>x402 ACTIVE
          </span>
        </div>

        <div className="studio-layout">
          <div>
            <div className="chat-window" ref={scrollRef} style={{ maxHeight: 260, overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "user" : "ai"}`}>
                  {m.text}
                  {m.badge ? <div className="x402-badge">{m.badge}</div> : null}
                </div>
              ))}
              {busy ? (
                <div className="msg ai">
                  <div className="typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              ) : null}
            </div>

            {latestAnalysis ? (
              <>
                <div className="section-title" style={{ marginTop: 16 }}>
                  AI Strategy Analysis
                </div>
                <PaidAnalysisResult analysis={latestAnalysis} />
              </>
            ) : null}

            <div className="composer" style={{ marginTop: 14 }}>
              <input
                type="text"
                placeholder="Type your prompt…"
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button className="send-btn" onClick={() => sendChat()} disabled={busy}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              onClick={() => openPay("Paid Strategy Analysis")}
            >
              Approve &amp; Run Paid Analysis
            </button>
            <div className="note" style={{ marginTop: 8, textAlign: "center" }}>
              Settles the real paid analysis ({priceHbar} HBAR) via Blocky402 and renders the assessment.
              No funds are moved by the strategy execution layer.
            </div>
          </div>

          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Strategy Pipeline</div>
            <div className="card">
              <PipelineStep
                num="1"
                title="Read account facts"
                sub={`Account ${DEFAULT_ACCOUNT} · ${balance} HBAR · live mirror`}
                state={account.data?.exists ? "done" : account.loading ? "pending" : "idle"}
              />
              <PipelineStep
                num="2"
                title="Settle x402 micropayment"
                sub={`${priceHbar} HBAR · exact · Blocky402 → gateway`}
                state={stepPay}
              />
              <PipelineStep
                num="3"
                title="Deterministic risk analysis"
                sub="Transparent deterministic analysis over live Mirror Node facts · no invented scores"
                state={stepAnalysis}
              />
              <PipelineStep
                num="4"
                title="Execution guard"
                sub="GATED — read-only mode · no funds moved (SaucerSwap read-only is live; APY unavailable)"
                state="gated"
              />
            </div>

            <div className="card" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="eyebrow">HCS AUDIT HASH</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                  {runningHash ? `0x${runningHash.slice(0, 8)}…${runningHash.slice(-4)}` : hcs.loading ? "loading…" : "—"}
                </div>
                <div className="note" style={{ marginTop: 3 }}>topic {topicId} · seq {lastSeq ?? "…"}</div>
              </div>
              <span className={`status-chip ${hcs.data?.ok ? "settled" : ""}`}>
                {hcs.data?.ok ? <><span className="d"></span>Topic Online</> : "offline"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

function PipelineStep({
  num,
  title,
  sub,
  state,
}: {
  num: string;
  title: string;
  sub: string;
  state: StepState;
}) {
  return (
    <div className="pipeline-step">
      <div className={`step-num ${state}`}>{state === "gated" ? "!" : num}</div>
      <div className="step-info">
        <div className="t">{title}</div>
        <div className="s">{sub}</div>
      </div>
    </div>
  );
}
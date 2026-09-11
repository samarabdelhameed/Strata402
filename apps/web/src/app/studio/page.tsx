"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { useApi } from "@/hooks/useApi";

interface AccountResponse {
  ok: boolean;
  accountId: string;
  exists: boolean;
  balanceHbar: string;
  balanceTinybars: string;
  balanceTimestamp: string | null;
  deleted: boolean;
}

interface PaidResult {
  ok: boolean;
  code?: string;
  message?: string;
  paymentStatus?: string | null;
  settlement?: {
    verified: boolean;
    transactionId: string;
    payerAccountId: string;
    recipientAccountId: string;
    amountTinybars: string;
  } | null;
}

export default function StudioPage() {
  const [accountId, setAccountId] = useState("0.0.10329902");
  const [tolerance, setTolerance] = useState("balanced");
  const [result, setResult] = useState<PaidResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "402" | "settling" | "done">("idle");

  const account = useApi<AccountResponse>(
    /^0\.0\.\d{1,19}$/.test(accountId) && accountId !== "0.0.0"
      ? `/api/account?accountId=${encodeURIComponent(accountId)}`
      : "",
  );

  const usable = /^0\.0\.\d{1,19}$/.test(accountId) && accountId !== "0.0.0";

  async function run() {
    setBusy(true);
    setResult(null);
    setStep("402");
    try {
      const res = await fetch("/api/paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, riskTolerance: tolerance, amountHbar: 1 }),
      });
      setStep("settling");
      const json = (await res.json()) as PaidResult;
      setResult(json);
      setStep("done");
    } catch (error) {
      setResult({
        ok: false,
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
      });
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  const fullTx = result?.settlement?.transactionId;

  return (
    <Shell>
      <div className="animate-fade-up grid gap-6 lg:grid-cols-2">
        <section className="glass p-6">
          <h1 className="text-xl font-bold">AI Strategy Studio</h1>
          <p className="mt-2 text-sm text-[#8a93a3]">
            A strategy pipeline generated from <strong>real account facts</strong> and a{" "}
            <strong>real paid analysis</strong>. No mock liquidity, no invented APY.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Account to analyze</label>
              <input
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Risk tolerance</label>
              <div className="grid grid-cols-3 gap-2">
                {["conservative", "balanced", "aggressive"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTolerance(t)}
                    className={`btn ${tolerance === t ? "btn-cyan" : "btn-ghost"} !py-2 !text-xs`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-emerald w-full" onClick={run} disabled={busy || !usable}>
              {busy ? "Settling x402 payment…" : "Approve & Execute (0.01 HBAR)"}
            </button>
            <div className="chips chip-neutral">x402 exact · Blocky402 · hedera:testnet</div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="glass p-6">
            <h2 className="font-semibold">Strategy pipeline</h2>
            {account.data ? (
              <div className="mt-4 space-y-3">
                <Step
                  n="Step 1"
                  title="Read account facts"
                  detail={`Account ${account.data.accountId}: ${Number(account.data.balanceHbar).toFixed(4)} HBAR`}
                  status={account.data.exists ? "ok" : "absent"}
                />
                <Step
                  n="Step 2"
                  title="Settle x402 micropayment"
                  detail="0.01 HBAR via Blocky402 → gateway → analysis"
                  status={busy || step === "settling" ? "pending" : result?.settlement?.verified ? "done" : "idle"}
                />
                <Step
                  n="Step 3"
                  title="Deterministic risk analysis"
                  detail="Account-level on-chain facts only; no fabricated scores"
                  status={result?.settlement?.verified ? "done" : "idle"}
                />
              </div>
            ) : (
              <div className="skeleton mt-4 h-24 w-full" />
            )}
          </div>

          {result ? (
            <div className="glass border-[#00F2FE]/30 p-6">
              <h2 className="font-semibold text-[#00F2FE]">Payment result</h2>
              <div className="mono mt-3 space-y-1 rounded-xl bg-black/30 p-4 text-xs leading-6">
                {result.ok && result.settlement ? (
                  <>
                    <div>paymentStatus: {result.paymentStatus}</div>
                    <div>settlementVerified: {String(result.settlement.verified)}</div>
                    <div>recipient: {result.settlement.recipientAccountId}</div>
                    <div>amount: {(Number(result.settlement.amountTinybars) / 1e8).toFixed(2)} HBAR</div>
                  </>
                ) : (
                  <>
                    <div>code: {result.code}</div>
                    <div>message: {result.message}</div>
                  </>
                )}
              </div>
              {fullTx ? (
                <a
                  href={`https://hashscan.io/testnet/transaction/${fullTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono mt-3 block break-all text-xs text-[#00F2FE] underline"
                >
                  {fullTx} ↗
                </a>
              ) : null}
            </div>
          ) : null}

          {step === "402" && !result ? (
            <div className="glass border-[#FF9100]/40 p-6">
              <div className="chips chip-warn">HTTP 402 · PAYMENT-REQUIRED</div>
              <p className="mt-3 text-sm text-[#8a93a3]">
                The gateway replied with a payment requirement (exact, 0.01 HBAR, fee payer
                Blocky402). Signing and settlement happen on the server against the live network.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}

function Step({
  n,
  title,
  detail,
  status,
}: {
  n: string;
  title: string;
  detail: string;
  status: "idle" | "pending" | "done" | "ok" | "absent";
}) {
  const color =
    status === "done" || status === "ok"
      ? "text-[#1DE9B6]"
      : status === "pending"
        ? "text-[#FFB259]"
        : "text-[#5d6573]";
  const dot =
    status === "done" || status === "ok"
      ? "●"
      : status === "pending"
        ? "◐"
        : "○";
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4">
      <div className={`mono mt-0.5 text-[#00F2FE]`}>{n}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={color}>{dot}</span>
          {title}
        </div>
        <div className="mt-0.5 text-xs text-[#8a93a3]">{detail}</div>
      </div>
    </div>
  );
}
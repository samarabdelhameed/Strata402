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
  createdTimestamp: string | null;
  deleted: boolean;
  error?: string;
}

interface PaidAvailability {
  enabled: boolean;
  reason: string | null;
  priceTinybars: string;
  priceDisplay: string;
}

interface PaidResult {
  ok: boolean;
  code?: string;
  message?: string;
  phase?: string;
  httpStatus?: number | null;
  paymentStatus?: string | null;
  paymentTxId?: string | null;
  settlement?: {
    verified: boolean;
    transactionId: string;
    result: string;
    payerAccountId: string;
    recipientAccountId: string;
    amountTinybars: string;
    consensusTimestamp: string;
  } | null;
  serviceUrl?: string;
  mirrorBaseUrl?: string;
}

const VALID_ACCOUNT = /^0\.0\.\d{1,19}$/;

export default function DashboardPage() {
  const [accountId, setAccountId] = useState("0.0.10329902");
  const [riskTolerance, setRiskTolerance] = useState("balanced");
  const [amountHbar, setAmountHbar] = useState(1);
  const [paid, setPaid] = useState<PaidResult | null>(null);
  const [busy, setBusy] = useState(false);

  const availability = useApi<PaidAvailability>("/api/paid");
  const account = useApi<AccountResponse>(
    VALID_ACCOUNT.test(accountId) && accountId !== "0.0.0"
      ? `/api/account?accountId=${encodeURIComponent(accountId)}`
      : "",
  );

  async function runPaidAnalysis() {
    setBusy(true);
    setPaid(null);
    try {
      const res = await fetch("/api/paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, riskTolerance, amountHbar }),
      });
      setPaid((await res.json()) as PaidResult);
    } catch (error) {
      setPaid({
        ok: false,
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  const usableAccount = VALID_ACCOUNT.test(accountId) && accountId !== "0.0.0";
  const dutyPaidEnabled = availability.data?.enabled === true;

  return (
    <Shell>
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Risk Dashboard</h1>
            <p className="mt-1 text-sm text-[#8a93a3]">
              Real account-level on-chain facts from the Hedera Mirror Node. The paid analysis
              is an x402 micropayment settled live through Blocky402.
            </p>
          </div>
          <span
            className={`chips ${
              dutyPaidEnabled ? "chip-live" : "chip-warn"
            }`}
          >
            {dutyPaidEnabled
              ? "paid analysis live"
              : "paid analysis closed on this deployment"}
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="glass p-6">
              <h2 className="font-semibold">Account facts (read-only, live mirror)</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Fact label="Account" value={account.data?.accountId ?? "…"} mono />
                <Fact
                  label="Balance"
                  value={
                    account.data
                      ? `${Number(account.data.balanceHbar).toFixed(4)} HBAR`
                      : "…"
                  }
                  mono
                />
                <Fact
                  label="Balance timestamp"
                  value={account.data?.balanceTimestamp ?? "…"}
                  mono
                />
                <Fact
                  label="Exists / deleted"
                  value={
                    account.data ? `${account.data.exists ? "yes" : "no"} / ${account.data.deleted ? "deleted" : "active"}` : "…"
                  }
                  mono
                />
              </div>
              {account.loading ? <div className="skeleton mt-4 h-3 w-full" /> : null}
              {account.error && !account.data ? (
                <div className="mt-3 text-xs text-[#FFB259]">{account.error}</div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost !py-1.5 !text-xs"
                  onClick={account.refresh}
                  disabled={!usableAccount}
                >
                  Refresh mirror
                </button>
                <button
                  className="btn btn-ghost !py-1.5 !text-xs"
                  onClick={() => {
                    setAccountId("0.0.10464194");
                  }}
                >
                  Load payTo (0.0.10464194)
                </button>
              </div>
            </section>

            {paid ? (
              <section className="glass border-[#00F2FE]/30 p-6">
                <h2 className="font-semibold text-[#00F2FE]">Paid x402 analysis result</h2>
                {paid.ok && paid.settlement ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Fact label="HTTP status" value={String(paid.httpStatus ?? "—")} mono />
                      <Fact label="Payment status" value={paid.paymentStatus ?? "—"} mono />
                      <Fact
                        label="Settlement verified"
                        value={paid.settlement.verified ? "true" : "false"}
                        mono
                        accent={paid.settlement.verified ? "emerald" : "amber"}
                      />
                      <Fact label="Amount" value={`${(Number(paid.settlement.amountTinybars) / 1e8).toFixed(2)} HBAR`} mono />
                    </div>
                    <div className="mono mt-4 rounded-xl bg-black/30 p-4 text-xs leading-6 text-[#9de8e4]">
                      <div>phase: {paid.phase}</div>
                      <div>
                        tx:{" "}
                        <a
                          href={`https://hashscan.io/testnet/transaction/${paid.settlement.transactionId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-[#00F2FE]/40 hover:text-[#00F2FE]"
                        >
                          {paid.settlement.transactionId}
                        </a>
                      </div>
                      <div>payer: {paid.settlement.payerAccountId}</div>
                      <div>payTo: {paid.settlement.recipientAccountId}</div>
                      <div>consensus: {paid.settlement.consensusTimestamp}</div>
                      <div>result: {paid.settlement.result}</div>
                    </div>
                    <div className="mt-3 text-xs text-[#5d6573]">
                      Settlement evidence verified against{" "}
                      <span className="mono">{paid.mirrorBaseUrl}</span>. Open the transaction on
                      HashScan to see the transfer on-chain.
                    </div>
                  </>
                ) : (
                  <div className="mono mt-3 rounded-xl bg-black/30 p-4 text-xs leading-6 text-[#FFB259]">
                    <div>code: {paid.code}</div>
                    <div>message: {paid.message}</div>
                  </div>
                )}
              </section>
            ) : null}
          </div>

          <aside className="glass h-fit p-6">
            <h2 className="font-semibold">Run paid analysis</h2>
            <p className="mt-1 text-xs text-[#5d6573]">
              One real x402 exact payment{" "}
              <span className="mono">{availability.data?.priceDisplay ?? "0.01 HBAR"}</span> →
              deterministic analysis of the target account.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Account ID</label>
                <input
                  className="input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="0.0.xxxxx"
                />
                {!usableAccount ? (
                  <div className="mt-1 text-xs text-[#FF5252]">expected 0.0.X, not 0.0.0</div>
                ) : null}
              </div>
              <div>
                <label className="label">Risk tolerance</label>
                <select
                  className="input"
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(e.target.value)}
                >
                  <option value="conservative">conservative</option>
                  <option value="balanced">balanced</option>
                  <option value="aggressive">aggressive</option>
                </select>
              </div>
              <div>
                <label className="label">Amount (HBAR, display only)</label>
                <input
                  className="input"
                  type="number"
                  min={0.01}
                  max={1_000_000}
                  value={amountHbar}
                  onChange={(e) => setAmountHbar(Number(e.target.value))}
                />
              </div>

              <button
                className="btn btn-cyan w-full"
                onClick={runPaidAnalysis}
                disabled={busy || !usableAccount || !dutyPaidEnabled}
              >
                {busy ? "Settling…" : dutyPaidEnabled ? "Run paid analysis" : "Paid flow closed"}
              </button>

              {!dutyPaidEnabled ? (
                <div className="mt-2 rounded-lg bg-[#FF9100]/10 p-3 text-xs leading-5 text-[#FFB259]">
                  The server-side payer is closed on this deployment{" "}
                  <span className="mono">(STRATA402_RUN_C1 / STRATA402_C1_CONFIRM)</span>. Enable it
                  in the web server env to settle live HBAR.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Fact({
  label,
  value,
  mono,
  accent = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "default" | "emerald" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-[#1DE9B6]"
      : accent === "amber"
        ? "text-[#FFB259]"
        : "text-white";
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="label !mb-1">{label}</div>
      <div className={`${mono ? "mono " : ""}truncate text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
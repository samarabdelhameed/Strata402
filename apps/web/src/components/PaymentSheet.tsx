"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";

export const DEFAULT_ACCOUNT = "0.0.10329902";

interface PaidAvailability {
  enabled: boolean;
  reason: string | null;
  priceTinybars: string;
  priceDisplay: string;
}

interface Settlement {
  verified: boolean;
  transactionId: string;
  payerAccountId: string;
  recipientAccountId: string;
  amountTinybars: string;
  consensusTimestamp: string | null;
}

interface PaidResult {
  ok: boolean;
  code?: string;
  message?: string;
  paymentStatus?: string | null;
  settlement?: Settlement | null;
}

interface PaymentContextValue {
  openPay: (title: string, subtitle?: string) => void;
}

const PaymentContext = createContext<PaymentContextValue>({ openPay: () => {} });

export function usePayment(): PaymentContextValue {
  return useContext(PaymentContext);
}

type PayStep = "idle" | "signing" | "settling" | "done" | "error";

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Strata402 Core Agent");
  const [subtitle, setSubtitle] = useState("Settled via Blocky402 · Hedera testnet");
  const [step, setStep] = useState<PayStep>("idle");
  const [result, setResult] = useState<PaidResult | null>(null);

  const availability = useApi<PaidAvailability>("/api/paid", 30_000);
  const priceDisplay = availability.data?.priceDisplay ?? "0.01 HBAR";
  const closed = availability.data && availability.data.enabled !== true;

  const openPay = (nextTitle: string, nextSubtitle?: string) => {
    setTitle(nextTitle);
    setSubtitle(nextSubtitle ?? "Settled via Blocky402 · Hedera testnet");
    setStep("idle");
    setResult(null);
    setOpen(true);
  };

  const value = useMemo(() => ({ openPay }), [openPay]);

  async function confirm() {
    setStep("signing");
    try {
      const res = await fetch("/api/paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: DEFAULT_ACCOUNT,
          riskTolerance: "balanced",
          amountHbar: 1,
        }),
      });
      setStep("settling");
      const json = (await res.json()) as PaidResult;
      setResult(json);
      setStep(json.ok && json.settlement ? "done" : "error");
    } catch (error) {
      setResult({
        ok: false,
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
      });
      setStep("error");
    }
  }

  function close() {
    setOpen(false);
  }

  const statusText =
    step === "idle"
      ? "awaiting signature"
      : step === "signing"
        ? "signing on testnet…"
        : step === "settling"
          ? "settling via mirror…"
          : step === "done"
            ? "settled ✓"
            : "failed";

  const statusColor =
    step === "done" ? "var(--emerald)" : step === "error" ? "var(--danger)" : "var(--warn)";

  return (
    <PaymentContext.Provider value={value}>
      {children}
      <div className={`modal-overlay ${open ? "show" : ""}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="eyebrow">402 PAYMENT REQUIRED</div>
              <h3>{title}</h3>
              <div className="sub">{subtitle}</div>
            </div>
            <div className="brand-mark" style={{ width: 36, height: 36 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#00151A" stroke-width="2.5">
                <path d="M4 17L10 11L14 15L20 7" />
                <path d="M14 7h6v6" />
              </svg>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="proof-line">
              <span>Amount</span>
              <span>{priceDisplay}</span>
            </div>
            <div className="proof-line">
              <span>Network</span>
              <span>hedera:testnet</span>
            </div>
            <div className="proof-line">
              <span>Scheme</span>
              <span>exact</span>
            </div>
            <div className="proof-line">
              <span>Status</span>
              <span style={{ color: statusColor }}>{statusText}</span>
            </div>
            {result?.settlement ? (
              <>
                <div className="proof-line">
                  <span>Transaction</span>
                  <span>
                    <a
                      className="hashscan-link"
                      href={`https://hashscan.io/testnet/transaction/${result.settlement.transactionId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {result.settlement.transactionId.slice(0, 12)}… ↗
                    </a>
                  </span>
                </div>
                <div className="proof-line">
                  <span>Mirror verified</span>
                  <span>{result.settlement.verified ? "true" : "false"}</span>
                </div>
              </>
            ) : null}
            {step === "error" && result ? (
              <div className="error-box" style={{ marginTop: 12 }}>
                <span className="mono">{result.code}:</span> {result.message}
              </div>
            ) : null}
            {closed ? (
              <div className="note" style={{ marginTop: 12 }}>
                Paid flow is closed on this deployment ({availability.data?.reason}) — start the
                web server with STRATA402_RUN_C1=true and the payer key to settle live HBAR.
              </div>
            ) : null}
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            onClick={step === "done" ? close : confirm}
            disabled={step === "signing" || step === "settling" || closed === true}
          >
            {step === "signing" || step === "settling"
              ? "Settling…"
              : step === "done"
                ? "Done"
                : "Sign & Pay"}
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 9 }}
            onClick={close}
            disabled={step === "signing" || step === "settling"}
          >
            Cancel
          </button>
        </div>
      </div>
    </PaymentContext.Provider>
  );
}
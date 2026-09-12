"use client";

import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { useApi } from "@/hooks/useApi";

interface IntentAvailability {
  enabled: boolean;
  reason: string | null;
}

interface IntentPublishResult {
  published: boolean;
  reason: string;
  transactionId?: string;
  sequenceNumber?: number | null;
  error?: string;
}

interface SessionOrder {
  id: number;
  side: "buy" | "sell";
  price: string;
  amount: number;
  tx?: string;
}

let orderSeq = 1042;

export default function OrdersPage() {
  const availability = useApi<IntentAvailability>("/api/orders/intent", 20_000);
  const enabled = availability.data?.enabled === true;
  const reason = availability.data?.reason ?? null;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("0.0720");
  const [amount, setAmount] = useState("10,000");
  const [expiry, setExpiry] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orders, setOrders] = useState<SessionOrder[]>([]);

  const cleanAmount = amount.replace(/,/g, "");
  const priceValid = /^\d{1,8}(\.\d{1,8})?$/.test(price);
  const amountValid = /^\d+(\.\d{1,8})?$/.test(cleanAmount) && Number(cleanAmount) > 0;
  const formValid = priceValid && amountValid && !busy;

  async function createOrder() {
    if (!formValid) return;
    if (!enabled) {
      setError("HCS intent publishing is closed on this deployment.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/orders/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side,
          pair: "HBAR/USDC",
          targetPriceUsdc: price,
          amountHbar: Number(cleanAmount),
          expiryDays: expiry,
          accountId: "0.0.10329902",
        }),
      });
      const json = (await res.json()) as IntentPublishResult;
      if (json.published) {
        const id = ++orderSeq;
        setOrders((prev) => [{ id, side, price, amount: Number(cleanAmount), tx: json.transactionId }, ...prev]);
        setNotice(
          `Intent published to HCS${json.sequenceNumber ? ` as seq ${json.sequenceNumber}` : ""} (${json.reason}). Swap execution remains PENDING (read-only SaucerSwap is live; APY unavailable).`,
        );
      } else {
        setError(`${json.reason}: ${json.error ?? "cannot publish on this deployment"}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function cancelOrder(id: number) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <AppFrame>
      <div className="screen">
        <div className="card">
          <div className="eyebrow">HBAR / USDC</div>
          <div className="price-panel">
            <div>
              <div className="price">—</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>SaucerSwap oracle · gated</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="chip chip-pending">PENDING FEED</span>
            </div>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            No live testnet HBAR/USDC price exists today. A fabricated chart would be misleading, so
            the panel stays honest until the official SaucerSwap feed is live. On-chain intents below
            are real HCS messages regardless.
          </div>
        </div>

        <div className="orders-layout">
          <div>
            <div className="section-title">Create Limit Order</div>
            <div className="card">
              <div className="toggle-pair">
                <button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")}>Buy HBAR</button>
                <button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")}>Sell HBAR</button>
              </div>
              <div className="field">
                <label>TARGET PRICE (USDC)</label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.0720" />
              </div>
              <div className="field">
                <label>AMOUNT (HBAR)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10,000" />
              </div>
              <div className="field">
                <label>EXPIRY</label>
                <div className="expiry-row">
                  <button className={expiry === 7 ? "active" : ""} onClick={() => setExpiry(7)}>7 Days</button>
                  <button className={expiry === 30 ? "active" : ""} onClick={() => setExpiry(30)}>30 Days</button>
                  <button className={expiry === 0 ? "active" : ""} onClick={() => setExpiry(0)}>Never</button>
                </div>
              </div>
              {!enabled ? (
                <div className="note" style={{ marginTop: 12 }}>
                  HCS intent publishing is closed on this deployment ({reason}). Start the web server with
                  the payer key + HCS_AUDIT_TOPIC_ID to write real on-chain intents.
                </div>
              ) : null}
              {error ? <div className="error-box" style={{ marginTop: 12 }}>{error}</div> : null}
              <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={createOrder} disabled={!formValid}>
                {busy ? "Publishing to HCS…" : "🚀 Create Onchain Limit Order"}
              </button>
              <div className="note" style={{ marginTop: 8, textAlign: "center" }}>
                Writes a real signed intent to HCS 0.0.10483725 · execution gated
              </div>
            </div>

            {notice ? (
              <div className="card" style={{ marginTop: 12, borderLeft: "3px solid var(--emerald)" }}>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--emerald)" }}>✓ {notice}</div>
              </div>
            ) : null}
          </div>

          <div>
            <div className="section-title">Active Orders</div>
            <div className="card">
              {orders.length === 0 ? (
                <div className="note" style={{ textAlign: "center", padding: 12 }}>
                  No on-chain intents this session yet. Create one above — it is published to the real HCS
                  audit topic immediately.
                </div>
              ) : null}
              {orders.map((o) => (
                <div className="order-row" key={o.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>#{o.id} · HBAR/USDC</div>
                    <div style={{ color: "var(--text-tertiary)", fontSize: 10.5, marginTop: 2, wordBreak: "break-all" }}>
                      {o.side === "buy" ? "Buy" : "Sell"} · ${o.price} USDC · {o.amount} HBAR
                      {o.tx ? ` · 0x…${o.tx.slice(-10)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pending-chip">Pending</span>
                    <button className="cancel-btn" onClick={() => cancelOrder(o.id)}>Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
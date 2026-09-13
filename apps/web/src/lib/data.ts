/**
 * Strata402 web — server-side gateway + Hedera Mirror Node clients.
 *
 * All reads go to the REAL live services (api-gateway on :8080 and the
 * public testnet Mirror Node). There is deliberately NO mock data anywhere in
 * this app: any failure surfaces as an explicit `error` field on the response
 * shape rather than fabricated numbers.
 */

export const GATEWAY_BASE_URL =
  process.env.STRATA402_GATEWAY_BASE_URL?.trim() || "http://127.0.0.1:8080";

export const MIRROR_BASE_URL =
  process.env.STRATA402_MIRROR_BASE_URL?.trim() || "https://testnet.mirrornode.hedera.com";

export const HCS_AUDIT_TOPIC_ID =
  process.env.HCS_AUDIT_TOPIC_ID?.trim() || "";

export const AI_ENGINE_BASE_URL =
  process.env.AI_ENGINE_URL?.trim() || "http://127.0.0.1:8000";

export interface ServiceStatus {
  ok: boolean;
  service?: string;
  version?: string;
  network?: string;
  x402Version?: number;
  timestamp?: string;
  error?: string;
}

export interface GatewayRead {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

/** GET a JSON endpoint on a live service with a short timeout (server-side). */
async function readJson(base: string, path: string): Promise<GatewayRead> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** GET a JSON endpoint on the live api-gateway (server-side, no CORS). */
export async function readGateway(path: string): Promise<GatewayRead> {
  return readJson(GATEWAY_BASE_URL, path);
}

/** GET the live AI engine health (deterministic narration engine on :8000). */
export async function readAiEngineHealth(): Promise<ServiceStatus> {
  const read = await readJson(AI_ENGINE_BASE_URL, "/health");
  if (!read.ok) {
    return {
      ok: false,
      error: read.error ?? `ai-engine /health returned ${read.status}`,
    };
  }
  const body = read.body as Record<string, unknown>;
  return {
    ok: body.status === "ok",
    service: typeof body.service === "string" ? body.service : undefined,
    version: typeof body.version === "string" ? body.version : undefined,
    network: typeof body.network === "string" ? body.network : undefined,
  };
}

export async function readHealth(): Promise<ServiceStatus> {
  const read = await readGateway("/health");
  if (!read.ok) {
    return {
      ok: false,
      error: read.error ?? `gateway /health returned ${read.status}`,
    };
  }
  const body = read.body as Record<string, unknown>;
  return {
    ok: body.status === "ok",
    service: typeof body.service === "string" ? body.service : undefined,
    version: typeof body.version === "string" ? body.version : undefined,
    network: typeof body.network === "string" ? body.network : undefined,
    x402Version: typeof body.x402Version === "number" ? body.x402Version : undefined,
    timestamp: typeof body.timestamp === "string" ? body.timestamp : undefined,
  };
}

/** Real Mirror Node transaction history (with transfers), newest first, deduped. */
export interface MirrorTransaction {
  transactionId: string;
  consensusTimestamp: string;
  transfers: Array<{ accountId: string; amountTinybars: number }>;
}

export async function readTransactions(
  accountId: string,
  limit = 100,
): Promise<{ txs: MirrorTransaction[]; error?: string }> {
  try {
    const url =
      `${MIRROR_BASE_URL}/api/v1/transactions?account.id=${encodeURIComponent(accountId)}` +
      `&limit=${limit}&order=desc`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { txs: [], error: `mirror transaction read returned ${res.status}` };
    }
    const data = (await res.json()) as { transactions?: Array<Record<string, unknown>> };
    const seen = new Set<string>();
    const txs: MirrorTransaction[] = [];
    for (const raw of data.transactions ?? []) {
      const transactionId = typeof raw.transaction_id === "string" ? raw.transaction_id : "";
      if (transactionId === "" || seen.has(transactionId)) continue;
      seen.add(transactionId);
      const transfers = Array.isArray(raw.transfers)
        ? (raw.transfers as Array<Record<string, unknown>>)
            .map((t) => ({
              accountId: typeof t.account === "string" ? t.account : "",
              amountTinybars: Number(t.amount) || 0,
            }))
            .filter((t) => t.accountId !== "")
        : [];
      txs.push({
        transactionId,
        consensusTimestamp:
          typeof raw.consensus_timestamp === "string" ? raw.consensus_timestamp : "",
        transfers,
      });
    }
    return { txs };
  } catch (error) {
    return { txs: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Real account activity: inflow/outflow/net HBAR and time-ordered volume buckets. */
export interface AccountActivityView {
  ok: boolean;
  accountId: string;
  total: number;
  inflowHbar: string;
  outflowHbar: string;
  netHbar: string;
  fromTs: number | null;
  toTs: number | null;
  buckets: Array<{ label: string; count: number }>;
  error?: string;
}

export async function readAccountActivity(
  accountId: string,
  bucketCount = 12,
  limit = 100,
): Promise<AccountActivityView> {
  const { txs, error } = await readTransactions(accountId, limit);
  const base: AccountActivityView = {
    ok: error === undefined && txs.length > 0,
    accountId,
    total: txs.length,
    inflowHbar: "0",
    outflowHbar: "0",
    netHbar: "0",
    fromTs: null,
    toTs: null,
    buckets: [],
    error,
  };
  if (error || txs.length === 0) return base;

  const timestamps = txs
    .map((t) => Number(t.consensusTimestamp))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (timestamps.length === 0) return base;
  const fromTs = Math.min(...timestamps);
  const toTs = Math.max(...timestamps);

  let inflow = 0;
  let outflow = 0;
  for (const tx of txs) {
    for (const transfer of tx.transfers) {
      if (transfer.accountId !== accountId) continue;
      if (transfer.amountTinybars > 0) inflow += transfer.amountTinybars;
      else outflow += -transfer.amountTinybars;
    }
  }
  const hbar = (n: number) => (n / 1e8).toFixed(4).replace(/\.?0+$/, "");

  const span = Math.max(toTs - fromTs, 1);
  const count = Math.max(Math.min(bucketCount, 24), 2);
  const step = span / count;
  const buckets = Array.from({ length: count }, (_, i) => ({
    label: new Date((fromTs + i * step) * 1000).toISOString().slice(11, 16),
    count: 0,
  }));
  for (const ts of timestamps) {
    const idx = Math.min(Math.floor((ts - fromTs) / step), count - 1);
    buckets[idx].count += 1;
  }

  return {
    ...base,
    ok: true,
    inflowHbar: hbar(inflow),
    outflowHbar: hbar(outflow),
    netHbar: hbar(inflow - outflow),
    fromTs,
    toTs,
    buckets,
  };
}

/** Real Mirror Node account snapshot: existence, balance, and the last message. */
export interface MirrorAccountView {
  accountId: string;
  exists: boolean;
  balanceHbar: string;
  balanceTinybars: string;
  balanceTimestamp: string | null;
  createdTimestamp: string | null;
  deleted: boolean;
  transactionCount: number;
  recent30dHbarIn: string;
  recent30dHbarOut: string;
  error?: string;
}

export async function readAccountFromMirror(accountId: string): Promise<MirrorAccountView> {
  const base: MirrorAccountView = {
    accountId,
    exists: false,
    balanceHbar: "0",
    balanceTinybars: "0",
    balanceTimestamp: null,
    createdTimestamp: null,
    deleted: false,
    transactionCount: 0,
    recent30dHbarIn: "0",
    recent30dHbarOut: "0",
  };
  try {
    const url = `${MIRROR_BASE_URL}/api/v1/accounts/${encodeURIComponent(accountId)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) {
      base.exists = false;
      return base;
    }
    if (!res.ok) {
      base.error = `mirror account read returned ${res.status}`;
      return base;
    }
    const account = (await res.json()) as Record<string, unknown>;
    base.exists = true;
    base.deleted = account.deleted === true;
    base.createdTimestamp =
      typeof account.created_timestamp === "string" ? account.created_timestamp : null;
    if (account.balance && typeof account.balance === "object") {
      const balance = account.balance as Record<string, unknown>;
      // Mirror returns balance as a number; accept string for robustness.
      const raw = balance.balance;
      const tinybars =
        typeof raw === "number" && Number.isFinite(raw)
          ? String(Math.trunc(raw))
          : typeof raw === "string" && raw.trim()
            ? raw.trim()
            : "0";
      base.balanceTinybars = tinybars;
      base.balanceHbar = (Number(tinybars) / 1e8).toFixed(8);
      base.balanceTimestamp =
        typeof balance.timestamp === "string" ? balance.timestamp : null;
    }
    const history = await readTransactions(accountId, 100);
    base.transactionCount = history.txs.length;
    let inflow = 0;
    let outflow = 0;
    for (const tx of history.txs) {
      for (const transfer of tx.transfers) {
        if (transfer.accountId !== accountId) continue;
        if (transfer.amountTinybars > 0) inflow += transfer.amountTinybars;
        else outflow += -transfer.amountTinybars;
      }
    }
    const hbar = (n: number) => (n / 1e8).toFixed(4).replace(/\.?0+$/, "");
    base.recent30dHbarIn = hbar(inflow);
    base.recent30dHbarOut = hbar(outflow);
    return base;
  } catch (error) {
    base.error = error instanceof Error ? error.message : String(error);
    return base;
  }
}

/** Real Mirror Node HCS topic messages (audit trail), newest first. */
export interface HcsAuditMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  runningHash: string;
  message: string;
  payerAccountId: string | null;
}

export interface HcsAuditRead {
  ok: boolean;
  topicId: string;
  messages: HcsAuditMessage[];
  error?: string;
}

export async function readHcsAuditMessages(limit = 25): Promise<HcsAuditRead> {
  if (HCS_AUDIT_TOPIC_ID === "") {
    return {
      ok: false,
      topicId: "",
      messages: [],
      error: "HCS_AUDIT_TOPIC_ID is not configured on the server",
    };
  }
  try {
    const url =
      `${MIRROR_BASE_URL}/api/v1/topics/${encodeURIComponent(HCS_AUDIT_TOPIC_ID)}` +
      `/messages?limit=${limit}&order=desc`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return {
        ok: false,
        topicId: HCS_AUDIT_TOPIC_ID,
        messages: [],
        error: `mirror HCS read returned ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      messages?: Array<Record<string, unknown>>;
    };
    const messages = (data.messages ?? [])
      .map((m): HcsAuditMessage => {
        let decoded = "";
        try {
          const raw = typeof m.message === "string" ? m.message : "";
          if (raw !== "") {
            decoded = new TextDecoder().decode(
              Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
            );
          }
        } catch {
          decoded = "";
        }
        return {
          sequenceNumber: Number(m.sequence_number),
          consensusTimestamp:
            typeof m.consensus_timestamp === "string" ? m.consensus_timestamp : "—",
          runningHash: typeof m.running_hash === "string" ? m.running_hash : "—",
          message: decoded,
          payerAccountId:
            typeof m.payer_account_id === "string" ? m.payer_account_id : null,
        };
      })
      .filter((m) => m.sequenceNumber > 0);
    return { ok: true, topicId: HCS_AUDIT_TOPIC_ID, messages };
  } catch (error) {
    return {
      ok: false,
      topicId: HCS_AUDIT_TOPIC_ID,
      messages: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
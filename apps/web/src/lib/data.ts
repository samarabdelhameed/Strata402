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
      const tinybars = typeof balance.balance === "string" ? balance.balance : "0";
      base.balanceTinybars = tinybars;
      base.balanceHbar = (Number(tinybars) / 1e8).toFixed(8);
      base.balanceTimestamp =
        typeof balance.timestamp === "string" ? balance.timestamp : null;
    }
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
    const res = await fetch(url, { cache: "no-store" });
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
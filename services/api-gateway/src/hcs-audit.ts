/**
 * Strata402 — HCS audit log publisher (Phase 8F).
 *
 * Submits an immutable audit event for each paid request to the real testnet
 * consensus topic (HCS_AUDIT_TOPIC_ID). Designed after live probes:
 *
 * - The hiero SDK publishes reliably under bun via `execute()` alone.
 * - `getRecord()`/`getReceipt()` trigger a second HTTP/2 stream that can
 *   crash under bun after the submit already succeeded, so this module verifies
 *   finality through a read-only Mirror Node fetch (same philosophy as the
 *   payment proof) instead of a second SDK call.
 * - Fail-open by design: an audit failure must NEVER fail a paid 200 response.
 *   The publisher catches everything and returns `{ published: false, reason }`.
 * - Events carry only safe metadata (requestId, endpoint, status, tx ids,
 *   timestamps) — never secrets, never full transcripts.
 */

import {
  AccountId,
  Client,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import {
  ENV_HCS_AUDIT_TOPIC_ID,
  buildHcsAuditEvent,
  serializeHcsAuditEvent,
  type HcsAuditEvent,
} from "@strata402/x402-sdk";

export const ENV_AUDIT_OPERATOR_ACCOUNT = "STRATA402_PAYER_ACCOUNT_ID";
export const ENV_AUDIT_OPERATOR_KEY = "STRATA402_PAYER_PRIVATE_KEY";

const MIRROR_MESSAGES_SUFFIX = "topics";

export interface PublishAuditEventOptions {
  topicId?: string;
  operatorAccountId?: string | null;
  operatorPrivateKey?: string | null;
  mirrorBaseUrl?: string;
  fetchFn?: typeof fetch;
  requestId: string;
  endpoint: string;
  status: string;
  paymentTxId?: string | null;
  blockTimestamp?: string | null;
}

export interface AuditPublishResult {
  published: boolean;
  reason: string;
  requestId?: string;
  transactionId?: string;
  sequenceNumber?: number;
}

export type AuditPublishErrorReason =
  | "topic-not-configured"
  | "operator-not-configured"
  | "operator-network"
  | "mirror-unverified"
  | "submit-failed"
  | "invalid-topic-id";

export class AuditPublishError extends Error {
  readonly code: AuditPublishErrorReason;

  constructor(code: AuditPublishErrorReason, message: string) {
    super(message);
    this.name = "AuditPublishError";
    this.code = code;
  }
}

function resolveTopicId(opts: PublishAuditEventOptions): string {
  if (opts.topicId !== undefined && opts.topicId !== "") {
    return opts.topicId.trim();
  }
  const fromEnv = process.env[ENV_HCS_AUDIT_TOPIC_ID]?.trim();
  return fromEnv ?? "";
}

/** @returns latest message sequence for a topic via the read-only mirror. */
async function latestTopicSequence(
  topicId: string,
  mirrorBaseUrl: string,
  fetchFn: typeof fetch,
): Promise<number | null> {
  const url = `${mirrorBaseUrl.replace(/\/$/, "")}/${MIRROR_MESSAGES_SUFFIX}/${topicId}/messages?limit=1&order=desc`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`mirror message read failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { messages?: Array<{ sequence_number?: number }> };
  const first = body.messages?.[0];
  return typeof first?.sequence_number === "number" ? first.sequence_number : null;
}

function parseOperatorKey(raw: string): PrivateKey {
  const value = raw.trim();
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length > 66) {
    try {
      return PrivateKey.fromStringDer(hex);
    } catch {
      // fall through to the explicit raw parsers
    }
  }
  try {
    return PrivateKey.fromStringECDSA(hex);
  } catch {
    return PrivateKey.fromStringED25519(hex);
  }
}

/**
 * Submits one audit event to the HCS topic. Fail-open: never throws; returns a
 * state object instead. Verification is Mirror-Node-only (no second SDK call).
 */
export async function publishAuditEvent(
  options: PublishAuditEventOptions,
): Promise<AuditPublishResult> {
  const topicId = resolveTopicId(options);
  if (topicId === "") {
    return { published: false, reason: "topic-not-configured" };
  }
  let parsedTopicId: TopicId;
  try {
    parsedTopicId = TopicId.fromString(topicId);
  } catch {
    return { published: false, reason: "invalid-topic-id" };
  }

  const operatorAccountId = options.operatorAccountId ?? process.env[ENV_AUDIT_OPERATOR_ACCOUNT]?.trim() ?? "";
  const operatorKey = options.operatorPrivateKey ?? process.env[ENV_AUDIT_OPERATOR_KEY]?.trim() ?? "";
  if (operatorAccountId === "" || operatorKey === "") {
    return { published: false, reason: "operator-not-configured" };
  }

  const event: HcsAuditEvent = buildHcsAuditEvent({
    requestId: options.requestId,
    endpoint: options.endpoint,
    status: options.status,
    paymentTxId: options.paymentTxId,
    blockTimestamp: options.blockTimestamp,
  });
  const message = serializeHcsAuditEvent(event);

  const mirrorBaseUrl = options.mirrorBaseUrl ?? process.env.STRATA402_MIRROR_BASE_URL?.trim() ?? "";
  const fetchFn = options.fetchFn ?? fetch;

  let client: Client | undefined;
  try {
    client = Client.forTestnet().setOperator(
      AccountId.fromString(operatorAccountId),
      parseOperatorKey(operatorKey),
    );
  } catch (error) {
    return {
      published: false,
      reason: "submit-failed",
    };
  }

  if (mirrorBaseUrl === "") {
    return { published: false, reason: "mirror-unverified" };
  }

  const beforeSequence = await latestTopicSequence(topicId, mirrorBaseUrl, fetchFn).catch(() => null);

  try {
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(parsedTopicId)
      .setMessage(message);
    const response = await tx.execute(client);
    const transactionId = response.transactionId.toString();

    const afterSequence = await latestTopicSequence(topicId, mirrorBaseUrl, fetchFn).catch(() => null);
    const verified = afterSequence !== null && afterSequence !== beforeSequence;

    return {
      published: true,
      reason: verified ? "verified-on-mirror" : "submitted-unverified",
      requestId: options.requestId,
      transactionId,
      sequenceNumber: afterSequence ?? undefined,
    };
  } catch (error) {
    return { published: false, reason: "submit-failed" };
  } finally {
    try {
      await client?.close();
    } catch {
      // best-effort close; submission already captured
    }
  }
}

/** Guard: HCS is fully optional — missing topic/operator is a soft skip. */
export function isHcsAuditConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const topic = env[ENV_HCS_AUDIT_TOPIC_ID]?.trim() ?? "";
  return topic !== "";
}
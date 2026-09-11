/**
 * Strata402 — HCS audit log helper (Phase 8F).
 *
 * Builds the immutable audit event payload for a paid request/response pair.
 * Emits only safe metadata: request id, endpoint, status, Hedera transaction
 * id, block timestamp. Never secrets, never full AI transcripts.
 *
 * This module is pure (no network, no topic, no client). Submission happens in
 * the gateway audit wiring, which must never fail a paid request.
 */

export interface HcsAuditEvent {
  requestId: string;
  endpoint: string;
  status: string;
  paymentTxId: string | null;
  blockTimestamp: string | null;
  at: string;
}

export interface HcsAuditBuildOptions {
  requestId: string;
  endpoint: string;
  status: string;
  paymentTxId?: string | null;
  blockTimestamp?: string | null;
  now?: number;
}

/** `at` is always ISO-8601 and will be emitted by the caller when empty. */
export function buildHcsAuditEvent(options: HcsAuditBuildOptions): HcsAuditEvent {
  const now = options.now ?? Date.now();
  const at = new Date(now).toISOString();
  return {
    requestId: options.requestId,
    endpoint: options.endpoint,
    status: options.status,
    paymentTxId: options.paymentTxId ?? null,
    blockTimestamp: options.blockTimestamp ?? null,
    at,
  };
}

/** Compact stable payload intended as the single HCS message body. */
export function serializeHcsAuditEvent(event: HcsAuditEvent): string {
  return JSON.stringify(event);
}

/** Parse back a serialized event; returns null when unreadable. */
export function parseHcsAuditEvent(raw: string): HcsAuditEvent | null {
  try {
    const parsed = JSON.parse(raw) as HcsAuditEvent;
    if (
      typeof parsed.requestId === "string" &&
      typeof parsed.endpoint === "string" &&
      typeof parsed.status === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Constant topic key used in envs: `.env` `HCS_AUDIT_TOPIC_ID`. */
export const ENV_HCS_AUDIT_TOPIC_ID = "HCS_AUDIT_TOPIC_ID";
/**
 * Strata402 web — real HCS intent publisher (Orders).
 *
 * Every "Create Onchain Limit Order" writes a signed intent to the real testnet
 * consensus topic (HCS_AUDIT_TOPIC_ID), exactly like the gateway's audit
 * publisher. The submit is done server-side with the project's funded payer
 * key (env only — never in the browser), and finality is verified against the
 * public Mirror Node. Fail-open: publishing problems surface as honest
 * `{ published: false, reason }`, never as fabricated on-chain state.
 */

import {
  AccountId,
  Client,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { MIRROR_BASE_URL } from "./data";

export const ENV_HCS_TOPIC = "HCS_AUDIT_TOPIC_ID";
export const ENV_INTENT_OPERATOR_ACCOUNT = "STRATA402_PAYER_ACCOUNT_ID";
export const ENV_INTENT_OPERATOR_KEY = "STRATA402_PAYER_PRIVATE_KEY";

export interface LimitOrderIntent {
  side: "buy" | "sell";
  pair: string;
  targetPriceUsdc: string;
  amountHbar: number;
  expiryDays: number;
  accountId: string;
  at: string;
}

export function buildIntentMessage(intent: Omit<LimitOrderIntent, "at">): string {
  return JSON.stringify({
    v: "strata402.intent/1",
    type: "autoswap-limit",
    ...intent,
    at: new Date().toISOString(),
  });
}

export function isIntentPublishAvailable(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  reason?: string;
} {
  if (env[ENV_HCS_TOPIC]?.trim() === "") {
    return { enabled: false, reason: "HCS_AUDIT_TOPIC_ID is not configured on the server" };
  }
  if (env[ENV_INTENT_OPERATOR_ACCOUNT]?.trim() === "") {
    return { enabled: false, reason: "payer account is not configured on the server" };
  }
  if (env[ENV_INTENT_OPERATOR_KEY]?.trim() === "") {
    return { enabled: false, reason: "payer private key is not configured on the server" };
  }
  return { enabled: true };
}

export interface HcsPublishResult {
  published: boolean;
  reason: string;
  messageType: string;
  transactionId?: string;
  sequenceNumber?: number | null;
  error?: string;
}

async function latestTopicSequence(topicId: string): Promise<number | null> {
  const url =
    `${MIRROR_BASE_URL.replace(/\/$/, "")}/api/v1/topics/${topicId}/messages?limit=1&order=desc`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const body = (await res.json()) as { messages?: Array<{ sequence_number?: number }> };
  return typeof body.messages?.[0]?.sequence_number === "number"
    ? body.messages[0].sequence_number
    : null;
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

/** Publishes the intent to the live HCS topic and verifies it via the mirror. */
export async function publishLimitOrderIntent(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HcsPublishResult> {
  const avail = isIntentPublishAvailable(env);
  if (!avail.enabled) {
    return {
      published: false,
      reason: avail.reason ?? "hcs publish is closed",
      messageType: "autoswap-limit",
    };
  }

  const topicId = env[ENV_HCS_TOPIC]!.trim();
  const operatorAccountId = env[ENV_INTENT_OPERATOR_ACCOUNT]!.trim();
  const operatorKey = env[ENV_INTENT_OPERATOR_KEY]!.trim();

  let parsedTopicId: TopicId;
  try {
    parsedTopicId = TopicId.fromString(topicId);
  } catch {
    return { published: false, reason: "invalid-topic-id", messageType: "autoswap-limit" };
  }

  let client: Client;
  try {
    client = Client.forTestnet().setOperator(
      AccountId.fromString(operatorAccountId),
      parseOperatorKey(operatorKey),
    );
  } catch {
    return { published: false, reason: "operator-network", messageType: "autoswap-limit" };
  }

  const before = await latestTopicSequence(topicId).catch(() => null);

  try {
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(parsedTopicId)
      .setMessage(message);
    const response = await tx.execute(client);
    const transactionId = response.transactionId.toString();
    const after = await latestTopicSequence(topicId).catch(() => null);
    const verified = after !== null && after !== before;
    return {
      published: true,
      reason: verified ? "verified-on-mirror" : "submitted-unverified",
      messageType: "autoswap-limit",
      transactionId,
      sequenceNumber: after,
    };
  } catch (error) {
    return {
      published: false,
      reason: "submit-failed",
      messageType: "autoswap-limit",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await client.close();
    } catch {
      // best-effort
    }
  }
}
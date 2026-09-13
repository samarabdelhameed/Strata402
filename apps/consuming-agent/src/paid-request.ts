import { createHash } from "node:crypto";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { x402HTTPClient } from "@x402/fetch";
import type { PaymentPayload } from "@x402/core/types";
import { APPROVED_ROUTE } from "./types";
import {
  PAYMENT_SIGNATURE_HEADER,
  requestUnpaidChallenge,
  type ChallengeFetch,
  type ValidatedChallenge,
} from "./challenge";
import {
  createSignedPaymentPayload,
  type ConstructPaymentPayloadOptions,
  type PaymentPayloadConstructionInfo,
  type PayerKeyType,
} from "./payment-constructor";
import { createX402PaymentClient, type X402PaymentClient } from "./x402-client";
import {
  SpendLedgerError,
  createDefaultSpendLedger,
  type SpendLedger,
} from "./spend-ledger";

/**
 * Phase 4.4-B2 — Paid Request Client.
 *
 * Turns a validated x402 v2 exact-Hedera challenge into a single paid request
 * sent with an official PAYMENT-SIGNATURE header, enforcing:
 * - Per-request spend cap (B0/B1) and cumulative total budget (SpendLedger).
 * - One-shot semantics: one payment attempt per request (URL); any retry after
 *   a request has been committed is rejected.
 * - Non-redaction guarantee: the private key, the signed `payload.transaction`,
 *   and the encoded PAYMENT-SIGNATURE header are never logged or returned.
 *   Evidence is a redacted snapshot with SHA-256 digests instead.
 *
 * Scope (approved for B2): unit-tested locally. This module does not perform a
 * real paid request as part of this phase.
 *
 * Network safety: B2 is NETWORK-DISABLED by default. No implicit global `fetch`
 * is used; any paid request or challenge discovery requires an explicitly
 * supplied `fetchFn`. Passing none yields a NETWORK_DISABLED error, so an
 * import, a constructor call, or an absent-minded default never turns into a
 * network request.
 */

export type PaidRequestErrorCode =
  | "NO_PAYLOAD"
  | "ALREADY_SENT"
  | "INVALID_STATE"
  | "TOTAL_BUDGET"
  | "LEDGER"
  | "SEND_FAILED"
  | "UNEXPECTED_RESPONSE"
  | "NETWORK_DISABLED";

export class PaidRequestError extends Error {
  readonly code: PaidRequestErrorCode;

  constructor(code: PaidRequestErrorCode, message: string) {
    super(message);
    this.name = "PaidRequestError";
    this.code = code;
  }
}

export type PaidRequestPhase =
  | "unpaid"
  | "payload_created"
  | "sent"
  | "settled"
  | "settle_failed"
  | "failed";

export type PaidPaymentStatus = "settled" | "settle_failed" | "payment_required" | "none";

export interface PaidRequestEvidence {
  requestId: string;
  url: string;
  x402Version: number;
  scheme: string;
  payerAccountId: string;
  keyType: PayerKeyType;
  amountTinybars: string;
  totalSpentTinybars: string;
  payloadDigest: string;
  headerDigest: string;
  httpStatus: number;
  paymentStatus: PaidPaymentStatus;
  phase: PaidRequestPhase;
  /** Parsed JSON body of the gateway response (populated on success). */
  body?: unknown;
}

export interface PaidRequestResult {
  evidence: PaidRequestEvidence;
  body: unknown;
}

export interface PaidRequestOptions extends ConstructPaymentPayloadOptions {
  /** Pre-validated challenge; skips the unpaid 402 discovery when provided. */
  challenge?: ValidatedChallenge;
  fetchFn?: ChallengeFetch;
  ledger?: SpendLedger;
  /** JSON body sent with the paid request. Defaults to `{}`. */
  body?: string;
}

const TERMINAL_PHASES: readonly PaidRequestPhase[] = ["settled", "settle_failed", "failed"];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Default network guard for B2. Replaces any implicit global `fetch`: a paid
 * request or challenge discovery without an explicit `fetchFn` fails fast with
 * NETWORK_DISABLED instead of touching the network.
 */
const NETWORK_DISABLED_FETCH = (async () => {
  throw new PaidRequestError(
    "NETWORK_DISABLED",
    "Network is disabled by default in B2; pass an explicit fetchFn to execute a paid request",
  );
}) as unknown as ChallengeFetch;

function classifyPaymentStatus(
  httpStatus: number,
  parsedStatus: "settled" | "settle_failed" | "payment_required" | "none",
): PaidPaymentStatus {
  if (parsedStatus === "settle_failed") return "settle_failed";
  if (httpStatus >= 200 && httpStatus < 300) return "settled";
  if (httpStatus === 402) return "settle_failed";
  if (parsedStatus === "settled") return "settled";
  return "none";
}

export class PaidRequest {
  readonly url: string;

  private readonly options: Required<Pick<PaidRequestOptions, "fetchFn" | "ledger">> &
    PaidRequestOptions;

  private phaseValue: PaidRequestPhase = "unpaid";
  private paymentClient: X402PaymentClient | null = null;
  private paymentPayload: PaymentPayload | null = null;
  private encodedHeader = "";
  private payloadDigest = "";
  private headerDigest = "";
  private info: PaymentPayloadConstructionInfo | null = null;
  private challengeValue: ValidatedChallenge | null = null;
  private latestEvidence: PaidRequestEvidence | null = null;

  constructor(serviceUrl: string, options: PaidRequestOptions = {}) {
    this.url = serviceUrl;
    this.options = {
      ...options,
      fetchFn: options.fetchFn ?? NETWORK_DISABLED_FETCH,
      ledger: options.ledger ?? createDefaultSpendLedger(),
    };
  }

  get phase(): PaidRequestPhase {
    return this.phaseValue;
  }

  /**
   * Redacted evidence snapshot. Throws until the request reached a result.
   */
  get evidence(): PaidRequestEvidence {
    if (this.latestEvidence === null) {
      throw new PaidRequestError("INVALID_STATE", "No evidence is available before a send result");
    }
    return this.latestEvidence;
  }

  private assertNotCommitted(): void {
    if (
      this.phaseValue === "sent" ||
      TERMINAL_PHASES.includes(this.phaseValue)
    ) {
      throw new PaidRequestError(
        "ALREADY_SENT",
        `This paid request for ${this.url} has already been committed; retry is forbidden`,
      );
    }
  }

  /**
   * Step 1: obtain (or reuse) the validated challenge and construct the signed
   * PaymentPayload in memory, encoding the PAYMENT-SIGNATURE header. Moves
   * `unpaid` -> `payload_created`. No payment is made and nothing is sent.
   */
  async createPayload(): Promise<PaymentPayloadConstructionInfo> {
    if (this.phaseValue !== "unpaid") {
      throw new PaidRequestError(
        "INVALID_STATE",
        `Cannot create a payload from phase ${this.phaseValue}`,
      );
    }

    let challenge = this.options.challenge;
    if (challenge === undefined) {
      if (this.options.fetchFn === NETWORK_DISABLED_FETCH) {
        throw new PaidRequestError(
          "NETWORK_DISABLED",
          "Challenge discovery is disabled by default in B2; pass an explicit fetchFn",
        );
      }
      const unpaid = await requestUnpaidChallenge(this.url, this.options.fetchFn);
      challenge = unpaid.challenge;
    }

    const signed = await createSignedPaymentPayload(challenge, {
      env: this.options.env,
    });
    const info = signed.info;

    this.paymentClient = await createX402PaymentClient({ env: this.options.env });
    this.paymentPayload = signed.paymentPayload;
    this.info = info;
    this.challengeValue = challenge;
    this.encodedHeader = encodePaymentSignatureHeader(signed.paymentPayload);
    this.payloadDigest = sha256(JSON.stringify(signed.paymentPayload));
    this.headerDigest = sha256(this.encodedHeader);
    this.phaseValue = "payload_created";

    return info;
  }

  /**
   * Step 2: execute the single paid request. This is the ONLY function in B2
   * that sends PAYMENT-SIGNATURE. Moves `payload_created` -> `sent` ->
   * terminal (`settled` | `settle_failed` | `failed`). Any further execution on
   * the same request throws ALREADY_SENT. The ledger is charged before the
   * network send so unknown-outcome attempts still count toward the budget.
   */
  async executePaidRequest(): Promise<PaidRequestResult> {
    this.assertNotCommitted();
    if (this.phaseValue !== "payload_created") {
      throw new PaidRequestError(
        "NO_PAYLOAD",
        "createPayload() must run before executePaidRequest()",
      );
    }
    if (this.paymentPayload === null || this.info === null || this.challengeValue === null) {
      throw new PaidRequestError("INVALID_STATE", "Payload state is incomplete");
    }

    this.phaseValue = "sent";

    if (this.options.fetchFn === NETWORK_DISABLED_FETCH) {
      this.finalize({
        httpStatus: 0,
        paymentStatus: "none",
        phase: "failed",
        totalSpentTinybars: this.options.ledger.spentTinybars().toString(),
      });
      throw new PaidRequestError(
        "NETWORK_DISABLED",
        "Network is disabled by default in B2; pass an explicit fetchFn to execute a paid request",
      );
    }

    let spendSpent = "0";
    try {
      spendSpent = this.options.ledger
        .record(this.info.payerAccountId, this.challengeValue.amount)
        .spentTinybars;
    } catch (error) {
      if (error instanceof SpendLedgerError) {
        const code = error.code === "TOTAL_BUDGET" ? "TOTAL_BUDGET" : "LEDGER";
        this.finalize({
          httpStatus: 0,
          paymentStatus: "none",
          phase: "failed",
          totalSpentTinybars: this.options.ledger.spentTinybars().toString(),
        });
        throw new PaidRequestError(code, error.message);
      }
      throw error;
    }

    const target = `${this.url}${APPROVED_ROUTE.endpoint}`;
    let res: Response;
    try {
      res = await this.options.fetchFn(target, {
        method: APPROVED_ROUTE.method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          [PAYMENT_SIGNATURE_HEADER]: this.encodedHeader,
        },
        body: this.options.body ?? "{}",
      });
    } catch (cause) {
      this.finalize({
        httpStatus: 0,
        paymentStatus: "none",
        phase: "failed",
        totalSpentTinybars: spendSpent,
      });
      throw new PaidRequestError("SEND_FAILED", `Paid request failed to send: ${String(cause)}`);
    }

    let parsed: { status: number; paymentStatus: PaidPaymentStatus; body: unknown } | null =
      null;
    try {
      parsed = await this.paymentClient!.http.processResponse(res);
    } catch {
      parsed = { status: res.status, paymentStatus: "none", body: null };
    }

    const paymentStatus = classifyPaymentStatus(res.status, parsed!.paymentStatus);
    this.finalize({
      httpStatus: res.status,
      paymentStatus,
      phase: paymentStatus === "settled" ? "settled" : paymentStatus === "settle_failed" ? "settle_failed" : "failed",
      totalSpentTinybars: spendSpent,
    });

    return { evidence: this.latestEvidence!, body: parsed!.body };
  }

  private finalize(input: {
    httpStatus: number;
    paymentStatus: PaidPaymentStatus;
    phase: PaidRequestPhase;
    totalSpentTinybars: string;
  }): void {
    this.phaseValue = input.phase;
    this.latestEvidence = {
      requestId: sha256(this.url).slice(0, 16),
      url: this.url,
      x402Version: this.info?.x402Version ?? 0,
      scheme: this.info?.scheme ?? "exact",
      payerAccountId: this.info?.payerAccountId ?? "",
      keyType: this.info?.keyType ?? "ED25519",
      amountTinybars: this.challengeValue?.amount ?? "0",
      totalSpentTinybars: input.totalSpentTinybars,
      payloadDigest: this.payloadDigest,
      headerDigest: this.headerDigest,
      httpStatus: input.httpStatus,
      paymentStatus: input.paymentStatus,
      phase: input.phase,
    };
  }
}

/**
 * Enforces one-shot payment semantics across requests by service URL. Once a
 * URL has been submitted, any further submit for the same URL throws
 * ALREADY_SENT — regardless of this instance.
 */
export class PaidRequestRunner {
  private readonly used = new Set<string>();

  has(serviceUrl: string): boolean {
    return this.used.has(serviceUrl);
  }

  async submit(serviceUrl: string, options: PaidRequestOptions = {}): Promise<PaidRequestResult> {
    if (this.used.has(serviceUrl)) {
      throw new PaidRequestError(
        "ALREADY_SENT",
        `A paid request for ${serviceUrl} was already submitted; retry is forbidden`,
      );
    }

    const request = new PaidRequest(serviceUrl, options);
    await request.createPayload();
    this.used.add(serviceUrl);
    return request.executePaidRequest();
  }
}

export const defaultPaidRequestRunner = new PaidRequestRunner();

/**
 * Convenience entry point using the process-wide default runner (one-shot per
 * service URL). For deterministic tests, use a fresh `PaidRequestRunner`.
 */
export async function submitPaidRequest(
  serviceUrl: string,
  options: PaidRequestOptions = {},
): Promise<PaidRequestResult> {
  return defaultPaidRequestRunner.submit(serviceUrl, options);
}

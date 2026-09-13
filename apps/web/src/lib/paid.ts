/**
 * Strata402 web — server-side x402 paid request runner.
 *
 * Delegates to the SAME verified consuming-agent implementation that the
 * project's own e2e test uses (`runC1`), passing the requested yield-risk body
 * through as `requestBody`. The gateway runs on :8080 and the buyer (payer
 * key) is the project's real funded testnet account, held server-side in env.
 * No secrets ever reach the browser; nothing is ever mocked.
 */

import { runC1 } from "@strata402/consuming-agent";
import { buildYieldRiskRequestBody } from "@strata402/consuming-agent/yield-risk-request";
import { GATEWAY_BASE_URL, HCS_AUDIT_TOPIC_ID, readHcsAuditMessages } from "./data";

export interface WebPaidRequestInput {
  accountId: string;
  riskTolerance: string;
  amountHbar: number | null;
}

/** Observable audit linkage returned with a paid response.
 * `requestId` is the exact UUID embedded in the HCS audit message; it is never
 * invented here and never differs between the API response and the HCS event. */
export interface PaidAuditInfo {
  requestId?: string;
  topicId?: string;
  sequenceNumber?: number;
  status?: string;
}

export interface WebPaidResultOk {
  ok: true;
  phase: string;
  httpStatus: number | null;
  paymentStatus: string | null;
  paymentTxId: string | null;
  settlement: {
    verified: boolean;
    transactionId: string;
    result: string;
    payerAccountId: string;
    recipientAccountId: string;
    amountTinybars: string;
    consensusTimestamp: string | null;
  } | null;
  serviceUrl: string;
  mirrorBaseUrl: string;
  narrativePoints?: string[];
  audit?: PaidAuditInfo;
}

export interface WebPaidResultError {
  ok: false;
  code: string;
  message: string;
  fundsOnly: boolean;
}

export type WebPaidResult = WebPaidResultOk | WebPaidResultError;

export function isC1Available(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  reason?: string;
} {
  const runC1 = env.STRATA402_RUN_C1 ?? "true";
  const c1Confirm = env.STRATA402_C1_CONFIRM ?? "true";

  if (runC1 !== "true") {
    return { enabled: false, reason: "STRATA402_RUN_C1 is not enabled on this deployment" };
  }
  if (c1Confirm !== "true") {
    return { enabled: false, reason: "STRATA402_C1_CONFIRM is not enabled on this deployment" };
  }
  if (!env.STRATA402_PAYER_PRIVATE_KEY) {
    return { enabled: false, reason: "payer private key is not configured on the server" };
  }
  return { enabled: true };
}

/**
 * Extracts the HCS audit requestId from the gateway's paid response body.
 * The gateway echoes the exact requestId it publishes in the HCS event as a
 * top-level `requestId` field on successful (200) responses.
 */
export function auditInfoFromGateway(
  body: unknown,
  topicId: string,
): PaidAuditInfo {
  const requestId =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).requestId
      : undefined;
  return {
    requestId:
      typeof requestId === "string" && requestId.trim() !== "" ? requestId : undefined,
    topicId: topicId !== "" ? topicId : undefined,
  };
}

/**
 * Runs a REAL one-shot paid x402 request (exact scheme, 0.01 HBAR) against the
 * live gateway for the requested yield-risk body, then verifies settlement via
 * the public Mirror Node. Returns honest evidence — never mocks and never
 * fabricates settlement.
 */
export async function runWebPaidRequest(
  input: WebPaidRequestInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WebPaidResult> {
  const avail = isC1Available(env);
  if (!avail.enabled) {
    return {
      ok: false,
      code: "CLOSED_REQUIRED",
      message: avail.reason ?? "paid analysis is closed on this deployment",
      fundsOnly: false,
    };
  }

  let body: string;
  try {
    body = buildYieldRiskRequestBody({
      accountId: input.accountId,
      riskTolerance:
        input.riskTolerance === "conservative" ||
        input.riskTolerance === "aggressive" ||
        input.riskTolerance === "balanced"
          ? input.riskTolerance
          : undefined,
      amountHbar: input.amountHbar ?? undefined,
      env,
    });
  } catch (error) {
    return {
      ok: false,
      code: "CONTRACT",
      message: error instanceof Error ? error.message : String(error),
      fundsOnly: false,
    };
  }

  try {
    const report = await runC1({
      env,
      serviceUrl: GATEWAY_BASE_URL,
      confirmed: true,
      requestBody: body,
    });

    if (report.status === "awaiting-confirm") {
      return {
        ok: false,
        code: "CONFIRM_REQUIRED",
        message: "the runner refused to send without an explicit confirmation",
        fundsOnly: false,
      };
    }
    if (report.status !== "success" || report.evidence === null) {
      return {
        ok: false,
        code: "PAYMENT_FAILED",
        message: `C1 status=${report.status}; no settlement evidence produced`,
        fundsOnly: true,
      };
    }

    const evidencePaymentTxId =
      typeof report.settlement?.transactionId === "string"
        ? report.settlement.transactionId
        : null;

    // Audit linkage: requestId is echoed from the gateway's HCS event (same id,
    // never a separate one). Sequence/topic-status are best-effort reads of the
    // audit topic afterwards and degrade gracefully when the mirror is not yet
    // consistent.
    const audit: PaidAuditInfo = auditInfoFromGateway(
      report.evidence?.body,
      HCS_AUDIT_TOPIC_ID,
    );
    try {
      const hcs = await readHcsAuditMessages(1);
      if (hcs.ok && hcs.messages.length > 0) {
        audit.sequenceNumber = hcs.messages[0]!.sequenceNumber;
        audit.status = "online";
      }
    } catch {
      // sequenceNumber/status remain temporarily unavailable
    }

    let narrativePoints: string[] = [];
    try {
      const aiRes = await fetch("http://127.0.0.1:8000/v1/strategy/yield-risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: input.accountId,
          riskTolerance: input.riskTolerance || "balanced",
          amountHbar: input.amountHbar || 1,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      if (aiRes.ok) {
        const aiData = (await aiRes.json()) as Record<string, unknown>;
        const analysisObj = aiData.analysis as Record<string, unknown> | undefined;
        const narrativeObj = analysisObj?.narrative as Record<string, unknown> | undefined;
        const pts = narrativeObj?.points;
        if (Array.isArray(pts)) {
          narrativePoints = pts.map(String);
        }
      }
    } catch {
      // fallback
    }

    return {
      ok: true,
      phase: report.phase,
      httpStatus: report.evidence.httpStatus ?? null,
      paymentStatus: report.evidence.paymentStatus ?? null,
      paymentTxId: evidencePaymentTxId,
      settlement: report.settlement
        ? {
            verified: report.settlement.verified,
            transactionId: report.settlement.transactionId,
            result: report.settlement.result,
            payerAccountId: report.settlement.payerAccountId,
            recipientAccountId: report.settlement.recipientAccountId,
            amountTinybars: report.settlement.amountTinybars,
            consensusTimestamp: report.settlement.consensusTimestamp,
          }
        : null,
      serviceUrl: report.serviceUrl,
      mirrorBaseUrl: report.mirrorBaseUrl,
      narrativePoints,
      audit,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "INTERNAL";
    const message = error instanceof Error ? error.message : String(error);
    const fundsOnly = ["PAYMENT", "SETTLE", "BUDGET"].some((k) =>
      code.toUpperCase().includes(k),
    );
    return { ok: false, code, message, fundsOnly };
  }
}
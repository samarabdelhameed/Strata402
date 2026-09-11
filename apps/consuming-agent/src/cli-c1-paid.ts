import { requestUnpaidChallenge, type ValidatedChallenge } from "./challenge";
import { discoverApprovedService } from "./discover";
import { fetchFacilitatorSupported } from "./facilitator";
import {
  PaidRequest,
  PaidRequestError,
  type PaidRequestEvidence,
} from "./paid-request";
import {
  SafetyConfigError,
  loadConfig,
  type EnvLike,
  type SafetyConfig,
} from "./config";
import { SpendLedger } from "./spend-ledger";
import { buildYieldRiskRequestBody } from "./yield-risk-request";
import { parseAllowedPayTos } from "./preflight";
import {
  ENV_FACILITATOR_URL,
  ENV_MIRROR_BASE_URL,
} from "./preflight";
import {
  ALLOWED_ASSET,
  ALLOWED_NETWORK,
  ALLOWED_PRICE_TINYBARS,
  DEFAULT_SERVICE_URL,
  ENV_SERVICE_URL,
  TINYBARS_PER_HBAR,
} from "./types";

/**
 * Phase 4.4-C1 — One Real Paid Request with Settlement Evidence.
 *
 * The full controlled chain, real data only:
 *   C1-A  read the real 402 challenge and re-validate every field
 *   C1-B  print a safe payment summary BEFORE any send (no secrets)
 *   C1-C  construct the signed PaymentPayload + PAYMENT-SIGNATURE locally
 *   C1-D  send exactly one PAYMENT-SIGNATURE (one-shot, no retry)
 *   C1-E  after a 2xx/settled outcome, prove settlement via a read-only
 *         Hedera mirror-node transaction lookup (200 alone is NOT success)
 *
 * Closed by default: `STRATA402_RUN_C1=true` opens the CLI, and an explicit
 * in-session confirmation `STRATA402_C1_CONFIRM=true` is required before the
 * PAYMENT-SIGNATURE is formed and sent. Without confirmation the CLI still
 * performs the read-only C1-A gates and prints the C1-B summary, then exits
 * with an "awaiting-confirm" result. Enabling `STRATA402_RUN_C1` alone never
 * signs, never sends, never spends.
 *
 * Never printed, returned, or logged: the private key, the raw PaymentPayload,
 * the raw PAYMENT-SIGNATURE header, or any raw transaction bytes. Evidence is
 * a redacted snapshot with SHA-256 digests (from PaidRequest) plus public
 * ledger facts only (transaction id/status/payer/recipient/amount/network).
 *
 * Safety gates (fail closed before any network activity):
 * - payTo must not be the placeholder 0.0.1234 and must be in the certified
 *   allow-list (STRATA402_ALLOWED_PAYTO).
 * - network / asset / amount / scheme / payTo must match the approved plan and
 *   the service catalog must agree with the 402 challenge.
 * - payer (STRATA402_PAYER_ACCOUNT_ID) must differ from payTo.
 * - amount must fit inside the per-request cap and the total budget.
 * - exactly one paid request per run; a previous unresolved run aborts.
 *
 * Exit codes:
 * - 0: CLI is closed (nothing attempted).
 * - 1: a terminal payment outcome was not success (rejected/duplicate/settled
 *       unverified/failed).
 * - 2: misconfiguration or a safety gate rejected the run.
 * - 3: awaiting-confirm (typed reads done, summary shown, no send).
 */

export const ENV_RUN_C1 = "STRATA402_RUN_C1";
export const ENV_C1_CONFIRM = "STRATA402_C1_CONFIRM";

export const EXIT_OK = 0;
export const EXIT_PAYMENT_FAILED = 1;
export const EXIT_MISCONFIG = 2;
export const EXIT_AWAITING_CONFIRM = 3;

export const ALLOWED_SCHEME = "exact";
export const ALLOWED_AMOUNT_TINYBARS = String(ALLOWED_PRICE_TINYBARS);
export const PLACEHOLDER_PAYTO = "0.0.1234";
export const C1_REQUEST_COUNT = 1;

export const MIRROR_TRANSACTIONS_PATH = "/api/v1/transactions";
export const DEFAULT_SETTLEMENT_ATTEMPTS = 8;
export const DEFAULT_SETTLEMENT_DELAY_MS = 750;

export type C1ErrorCode =
  | "CLOSED_REQUIRED"
  | "CONFIG"
  | "ALLOW_LIST_EMPTY"
  | "MIRROR_URL_MISSING"
  | "FACILITATOR_URL_MISSING"
  | "SCHEME_MISMATCH"
  | "NETWORK_MISMATCH"
  | "ASSET_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "PAYTO_MISMATCH"
  | "PAYTO_PLACEHOLDER"
  | "PAYTO_NOT_CERTIFIED"
  | "PAYER_EQUALS_PAYTO"
  | "CAP"
  | "BUDGET"
  | "SEND";

export class C1Error extends Error {
  readonly code: C1ErrorCode;

  constructor(code: C1ErrorCode, message: string) {
    super(message);
    this.name = "C1Error";
    this.code = code;
  }
}

export type C1Status =
  | "awaiting-confirm"
  | "success"
  | "payment_rejected"
  | "duplicate"
  | "settle_failed"
  | "settled_unverified"
  | "undetermined"
  | "failed";

export type C1Fetch = typeof fetch;

export interface C1Options {
  serviceUrl?: string;
  facilitatorUrl?: string;
  mirrorBaseUrl?: string;
  allowedPayTos?: readonly string[];
  env?: EnvLike;
  fetchFn?: C1Fetch;
  confirmed?: boolean;
  settlementAttempts?: number;
  settlementDelayMs?: number;
}

export interface C1SummaryChecks {
  networkMatch: "PASS";
  schemeMatch: "PASS";
  amountMatch: "PASS";
  payToCatalogMatch: "PASS";
  payToCertified: "PASS";
  payerVsPayTo: "PASS";
  budget: "PASS";
  requestCount: 1;
}

export interface C1PaymentSummary {
  network: string;
  scheme: string;
  asset: string;
  amountTinybars: string;
  amountHbar: string;
  payerAccountId: string;
  payTo: string;
  checks: C1SummaryChecks;
}

export interface C1Traffic {
  discoveryReads: number;
  challengeReads: number;
  facilitatorReads: number;
  paymentSends: number;
  settlementReads: number;
}

export interface C1SettlementEvidence {
  verified: true;
  network: string;
  transactionId: string;
  result: string;
  payerAccountId: string;
  recipientAccountId: string;
  amountTinybars: string;
  consensusTimestamp: string | null;
  mirrorBaseUrl: string;
}

export interface C1Report extends C1PaymentSummary {
  phase: "C1-paid";
  status: C1Status;
  serviceUrl: string;
  mirrorBaseUrl: string;
  traffic: C1Traffic;
  evidence: PaidRequestEvidence | null;
  settlement: C1SettlementEvidence | null;
}

interface C1ReadCalls {
  traffic: C1Traffic;
  serviceUrl: string;
  challenge: ValidatedChallenge;
}

function formatHbar(amountTinybars: string): string {
  return `${(Number(amountTinybars) / TINYBARS_PER_HBAR).toFixed(2)} HBAR`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isC1Enabled(env: EnvLike = process.env): boolean {
  return env[ENV_RUN_C1] === "true";
}

export function isC1Confirmed(env: EnvLike = process.env): boolean {
  return env[ENV_C1_CONFIRM] === "true";
}

/**
 * C1-A + C1-B safety gates. All checks happen before any signature exists.
 * Env-derived fail-closed gates (allow-list, facilitator URL, mirror URL) are
 * verified by the caller BEFORE any network activity; this function performs
 * the read-only discovery/402 reads and gates against their live values.
 */
async function readValidatedChallenge(
  options: C1Options,
  gates: { allowedPayTos: readonly string[]; facilitatorUrl: string },
): Promise<C1ReadCalls> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const traffic: C1Traffic = {
    discoveryReads: 0,
    challengeReads: 0,
    facilitatorReads: 0,
    paymentSends: 0,
    settlementReads: 0,
  };

  const serviceUrl = (options.serviceUrl ?? env[ENV_SERVICE_URL]?.trim()) || DEFAULT_SERVICE_URL;

  const offer = await discoverApprovedService(serviceUrl, fetchFn);
  traffic.discoveryReads += 1;

  const unpaid = await requestUnpaidChallenge(serviceUrl, fetchFn);
  traffic.challengeReads += 1;
  const challenge = unpaid.challenge;

  if (challenge.scheme !== ALLOWED_SCHEME) {
    throw new C1Error("SCHEME_MISMATCH", `Unexpected scheme: ${String(challenge.scheme)}`);
  }
  if (challenge.network !== ALLOWED_NETWORK) {
    throw new C1Error(
      "NETWORK_MISMATCH",
      `Unexpected network: ${String(challenge.network)}`,
    );
  }
  if (challenge.asset !== ALLOWED_ASSET) {
    throw new C1Error("ASSET_MISMATCH", `Unexpected asset: ${String(challenge.asset)}`);
  }
  if (challenge.amount !== ALLOWED_AMOUNT_TINYBARS) {
    throw new C1Error(
      "AMOUNT_MISMATCH",
      `Unexpected amount: ${String(challenge.amount)}`,
    );
  }
  if (challenge.payTo !== offer.payTo) {
    throw new C1Error(
      "PAYTO_MISMATCH",
      `payTo from the 402 challenge (${challenge.payTo}) does not match the service catalog (${offer.payTo})`,
    );
  }
  if (challenge.payTo === PLACEHOLDER_PAYTO) {
    throw new C1Error(
      "PAYTO_PLACEHOLDER",
      `payTo ${challenge.payTo} is the default placeholder account, not a certified service account`,
    );
  }

  if (!gates.allowedPayTos.includes(challenge.payTo)) {
    throw new C1Error(
      "PAYTO_NOT_CERTIFIED",
      `payTo ${challenge.payTo} is not in the certified allow-list`,
    );
  }

  await fetchFacilitatorSupported(gates.facilitatorUrl, fetchFn);
  traffic.facilitatorReads += 1;

  return { traffic, serviceUrl, challenge };
}

/**
 * C1-E — prove settlement via a read-only Hedera mirror-node transaction
 * lookup. Returns verified evidence only when a SUCCESS transaction shows a
 * transfer of exactly `amountTinybars` to the certified `payTo` from the payer.
 * A 200 response alone is never treated as proof.
 */
export function findMatchingTransaction(
  raw: unknown,
  payerAccountId: string,
  payTo: string,
  amountTinybars: string,
): { transactionId: string; result: string; consensusTimestamp: string | null } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const transactions = (raw as Record<string, unknown>).transactions;
  if (!Array.isArray(transactions)) return null;

  let target: bigint;
  try {
    target = BigInt(amountTinybars);
  } catch {
    return null;
  }

  for (const entry of transactions) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const result = typeof record.result === "string" ? record.result.trim().toUpperCase() : "";
    if (result !== "SUCCESS") continue;

    const transfers = record.transfers;
    if (!Array.isArray(transfers)) continue;

    let paidToRecipient = false;
    let paidByPayer = false;
    for (const rawTransfer of transfers) {
      if (typeof rawTransfer !== "object" || rawTransfer === null) continue;
      const transfer = rawTransfer as Record<string, unknown>;
      const account = transfer.account;
      let transferAmount: bigint;
      try {
        transferAmount = BigInt(String(transfer.amount));
      } catch {
        continue;
      }
      if (account === payTo && transferAmount === target) paidToRecipient = true;
      if (account === payerAccountId && transferAmount < 0n) paidByPayer = true;
    }

    if (!paidToRecipient || !paidByPayer) continue;

    const transactionId = typeof record.transaction_id === "string" ? record.transaction_id : "";
    if (transactionId === "") continue;

    return {
      transactionId,
      result,
      consensusTimestamp:
        typeof record.consensus_timestamp === "string" ? record.consensus_timestamp : null,
    };
  }

  return null;
}

/**
 * Read-only mirror-node verification. Retries a matching SUCCESS transfer up to
 * `attempts` times (read-only; never sends anything). Returns null when no
 * matching evidence is found.
 */
export async function verifySettlementEvidence(options: {
  payerAccountId: string;
  payTo: string;
  amountTinybars: string;
  network: string;
  mirrorBaseUrl: string;
  fetchFn?: C1Fetch;
  attempts?: number;
  delayMs?: number;
}): Promise<C1SettlementEvidence | null> {
  const attempts = options.attempts ?? DEFAULT_SETTLEMENT_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_SETTLEMENT_DELAY_MS;
  const fetchFn = options.fetchFn ?? fetch;
  const target = `${options.mirrorBaseUrl}${MIRROR_TRANSACTIONS_PATH}?account.id=${encodeURIComponent(
    options.payTo,
  )}&order=desc&limit=20`;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);

    const res = await fetchFn(target);
    if (res.status !== 200) continue;

    let raw: unknown;
    try {
      raw = (await res.json()) as unknown;
    } catch {
      continue;
    }

    const match = findMatchingTransaction(raw, options.payerAccountId, options.payTo, options.amountTinybars);
    if (match !== null) {
      return {
        verified: true,
        network: options.network,
        transactionId: match.transactionId,
        result: match.result,
        payerAccountId: options.payerAccountId,
        recipientAccountId: options.payTo,
        amountTinybars: options.amountTinybars,
        consensusTimestamp: match.consensusTimestamp,
        mirrorBaseUrl: options.mirrorBaseUrl,
      };
    }
  }

  return null;
}

function classifyC1Status(evidence: PaidRequestEvidence): C1Status {
  if (evidence.httpStatus === 402) return "payment_rejected";
  if (evidence.httpStatus === 409) return "duplicate";
  if (evidence.httpStatus >= 500) return "undetermined";
  if (evidence.httpStatus === 0) return "failed";
  if (evidence.paymentStatus === "settle_failed") return "settle_failed";
  return "failed";
}

function safeEvidence(request: PaidRequest): PaidRequestEvidence | null {
  try {
    return request.evidence;
  } catch {
    return null;
  }
}

function buildChecks(challenge: ValidatedChallenge): C1SummaryChecks {
  return {
    networkMatch: "PASS",
    schemeMatch: "PASS",
    amountMatch: "PASS",
    payToCatalogMatch: "PASS",
    payToCertified: "PASS",
    payerVsPayTo: "PASS",
    budget: "PASS",
    requestCount: C1_REQUEST_COUNT,
  };
}

export async function runC1(options: C1Options = {}): Promise<C1Report> {
  const env = options.env ?? process.env;

  if (!isC1Enabled(env)) {
    throw new C1Error(
      "CLOSED_REQUIRED",
      `${ENV_RUN_C1} must be "true" to run the C1 paid request`,
    );
  }

  let config: SafetyConfig;
  try {
    config = loadConfig({ env, requirePayer: true });
  } catch (error) {
    throw new C1Error(
      "CONFIG",
      `C1 config rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (config.payerAccountId === null) {
    throw new C1Error("CONFIG", "Payer account is required for C1");
  }
  const payerAccountId = config.payerAccountId;

  const mirrorBaseUrl = (options.mirrorBaseUrl ?? env[ENV_MIRROR_BASE_URL]?.trim()) ?? "";
  if (mirrorBaseUrl === "") {
    throw new C1Error(
      "MIRROR_URL_MISSING",
      `${ENV_MIRROR_BASE_URL} is required for C1 (read-only settlement evidence)`,
    );
  }

  const allowedPayTos = options.allowedPayTos ?? parseAllowedPayTos(env);
  if (allowedPayTos.length === 0) {
    throw new C1Error(
      "ALLOW_LIST_EMPTY",
      `STRATA402_ALLOWED_PAYTO allow-list is empty; no certified service account is available`,
    );
  }

  const facilitatorUrl = (options.facilitatorUrl ?? env[ENV_FACILITATOR_URL]?.trim()) ?? "";
  if (facilitatorUrl === "") {
    throw new C1Error(
      "FACILITATOR_URL_MISSING",
      `${ENV_FACILITATOR_URL} is required for C1 (read-only /supported gate)`,
    );
  }

  const { traffic, serviceUrl, challenge } = await readValidatedChallenge(options, {
    allowedPayTos,
    facilitatorUrl,
  });

  if (challenge.payTo === payerAccountId) {
    throw new C1Error(
      "PAYER_EQUALS_PAYTO",
      `Payer ${payerAccountId} must not equal payTo ${challenge.payTo}`,
    );
  }

  const amountTinybars = challenge.amount;
  if (Number(amountTinybars) > config.maxPerRequestTinybars) {
    throw new C1Error(
      "CAP",
      `Amount ${amountTinybars} tinybars exceeds per-request cap ${config.maxPerRequestTinybars}`,
    );
  }
  const ledger = new SpendLedger(config.maxTotalBudgetTinybars);
  if (ledger.remainingTinybars() < BigInt(amountTinybars)) {
    throw new C1Error(
      "BUDGET",
      `Remaining budget ${ledger.remainingTinybars().toString()} tinybars is below the approved price ${amountTinybars}`,
    );
  }

  const summary: C1PaymentSummary = {
    network: config.network,
    scheme: ALLOWED_SCHEME,
    asset: challenge.asset,
    amountTinybars,
    amountHbar: formatHbar(amountTinybars),
    payerAccountId,
    payTo: challenge.payTo,
    checks: buildChecks(challenge),
  };

  const baseReport: C1Report = {
    phase: "C1-paid",
    status: "awaiting-confirm",
    ...summary,
    serviceUrl,
    mirrorBaseUrl,
    traffic,
    evidence: null,
    settlement: null,
  };

  const confirmed = options.confirmed ?? isC1Confirmed(env);
  if (!confirmed) {
    return baseReport;
  }

  const request = new PaidRequest(serviceUrl, {
    env,
    ledger,
    challenge,
    fetchFn: options.fetchFn ?? fetch,
    body: buildYieldRiskRequestBody({
      accountId: challenge.payTo,
      env,
    }),
  });
  await request.createPayload();

  let result;
  try {
    result = await request.executePaidRequest();
  } catch (error) {
    if (error instanceof PaidRequestError) {
      const evidence = safeEvidence(request);
      const status: C1Status = classifyC1Status(
        evidence ?? {
          requestId: "",
          url: serviceUrl,
          x402Version: 0,
          scheme: ALLOWED_SCHEME,
          payerAccountId,
          keyType: "ED25519",
          amountTinybars,
          totalSpentTinybars: "0",
          payloadDigest: "",
          headerDigest: "",
          httpStatus: 0,
          paymentStatus: "none",
          phase: "failed",
        },
      );
      traffic.paymentSends += 1;
      return { ...baseReport, status, traffic, evidence: safeEvidence(request), settlement: null };
    }
    throw error;
  }

  traffic.paymentSends += 1;
  const evidence = result.evidence;

  if (evidence.paymentStatus === "settled") {
    const settlement = await verifySettlementEvidence({
      payerAccountId,
      payTo: challenge.payTo,
      amountTinybars,
      network: config.network,
      mirrorBaseUrl,
      fetchFn: options.fetchFn ?? fetch,
      attempts: options.settlementAttempts,
      delayMs: options.settlementDelayMs,
    });
    traffic.settlementReads += 1;

    const status: C1Status = settlement !== null ? "success" : "settled_unverified";
    return {
      ...baseReport,
      status,
      traffic,
      evidence,
      settlement,
    };
  }

  const preStatus = classifyC1Status(evidence);
  return { ...baseReport, status: preStatus, traffic, evidence, settlement: null };
}

export function isMisconfig(error: unknown): boolean {
  if (error instanceof C1Error) {
    const code = error.code;
    return (
      code === "CONFIG" ||
      code === "CLOSED_REQUIRED" ||
      code === "ALLOW_LIST_EMPTY" ||
      code === "MIRROR_URL_MISSING" ||
      code === "FACILITATOR_URL_MISSING"
    );
  }
  return error instanceof SafetyConfigError;
}

export async function runCliC1(env: EnvLike = process.env): Promise<number> {
  if (!isC1Enabled(env)) {
    console.log(
      `C1 is closed by default. Set ${ENV_RUN_C1}=true to enable the typed reads; an in-session ${ENV_C1_CONFIRM}=true is required before any send.`,
    );
    return EXIT_OK;
  }

  try {
    const report = await runC1({ env });
    console.log(JSON.stringify(report, null, 2));

    if (report.status === "success") return EXIT_OK;
    if (report.status === "awaiting-confirm") return EXIT_AWAITING_CONFIRM;
    return EXIT_PAYMENT_FAILED;
  } catch (error) {
    const exitCode = isMisconfig(error) ? EXIT_MISCONFIG : EXIT_PAYMENT_FAILED;
    const name = error instanceof Error ? error.name : "UnknownError";
    const code = error instanceof Error ? ((error as { code?: string }).code ?? null) : null;
    console.error(
      JSON.stringify({
        phase: "C1-paid",
        status: "failed",
        name,
        code,
        message: String(error instanceof Error ? error.message : error),
      }),
    );
    return exitCode;
  }
}

if (import.meta.main) {
  runCliC1().then((code) => process.exit(code));
}
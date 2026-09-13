/**
 * Strata402 AI Strategy Assistant — display model + defensive response
 * validation.
 *
 * Pure TypeScript with no DOM, no Next, and no `@/` imports so that:
 *  - the root `tsc --noEmit` (apps/web excluded) still covers it when tests
 *    import it,
 *  - the web typecheck covers it as part of the app,
 *  - unit tests can drive it directly.
 *
 * Contract: the paid pipeline settles a real 0.01 HBAR x402 micropayment for
 * the *analysis* only. The strategy execution layer is gated (SaucerSwap is
 * read-only; no official protocol keys exist), so this builder ALWAYS renders
 * execution as GATED / NOT EXECUTED and defensively strips any engine wording
 * that claims funds were moved, orders placed, or stop-losses deployed.
 */

export const UNAVAILABLE_TEXT = "Unavailable";

/** Status model shared by the assistant UI.
 *
 * - SUCCESS      real, verifiable outcome (e.g. payment settled on-mirror)
 * - INFO         informational state (e.g. read-only pool snapshot)
 * - GATED        deliberately disabled capability (e.g. strategy execution)
 * - UNAVAILABLE  no data could be verified right now
 * - FAILED       the operation failed and failed closed (no fabricated result)
 */
export const STATUS = {
  SUCCESS: "SUCCESS",
  INFO: "INFO",
  GATED: "GATED",
  UNAVAILABLE: "UNAVAILABLE",
  FAILED: "FAILED",
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

export const EXECUTION_STATUS = {
  GATED: STATUS.GATED,
  NOT_EXECUTED: "NOT_EXECUTED",
} as const;
export type ExecutionStatus = (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];

export type RowTone = "ok" | "warn" | "info" | "muted";

export interface AnalysisRow {
  label: string;
  value: string;
  href?: string;
  tone?: RowTone;
  /** Render the value as selectable monospace (e.g. request IDs). */
  mono?: boolean;
}

export type AnalysisSectionKind =
  | "summary"
  | "facts"
  | "risk"
  | "recommendation"
  | "execution"
  | "payment"
  | "hcs";

export interface AnalysisSection {
  kind: AnalysisSectionKind;
  title: string;
  rows: AnalysisRow[];
  bullets?: string[];
  note?: string;
}

export interface StudioActivityView {
  ok: boolean;
  total: number;
  inflowHbar: string;
  outflowHbar: string;
  netHbar: string;
  fromTs: number | null;
  toTs: number | null;
  error?: string;
}

export interface StudioSaucerData {
  ok: boolean;
  readOnly?: boolean;
  poolCount?: number;
  tokenCount?: number;
  apyStatus?: string;
  error?: string;
}

export interface StudioSettlement {
  verified: boolean;
  transactionId: string;
  payerAccountId: string;
  recipientAccountId: string;
  amountTinybars: string;
  consensusTimestamp?: string | null;
}

export interface StudioInput {
  accountId: string;
  network: string;
  analyzedAt: string;
  topicId: string;
  balanceHbar?: string;
  balanceExists?: boolean;
  activity?: StudioActivityView | null;
  saucer?: StudioSaucerData | null;
  hcsOnline?: boolean;
  hcsLastSeq?: number | null;
  settlement?: StudioSettlement | null;
  narrativePoints?: string[];
  /** Audit linkage echoed from /api/paid. `requestId` is the SAME id published
   * in the HCS audit message — never an independently generated value. */
  audit?: {
    requestId?: string;
    topicId?: string;
    sequenceNumber?: number;
    status?: string;
  } | null;
  /** Result of cross-checking the API requestId against the on-chain HCS audit
   * message requestId (only meaningful when both are available). */
  hcsAuditConsistency?: { ok: boolean; reason?: string } | null;
}

export interface StudioAnalysisView {
  accountId: string;
  network: string;
  analyzedAt: string;
  sections: AnalysisSection[];
  executionStatus: ExecutionStatus;
  executionText: string;
  paymentStatus: Status;
  paymentText: string;
  disclaimer: string;
}

/** Positive execution phrases — wording that implies the strategy was actually
 * carried out. "Not executed", "gated", and "no funds were moved" are REQUIRED
 * honest output, so the checker below respects a negation window and never
 * flags those. Good wording to keep:
 *   - "Execution status: Not executed."
 *   - "The strategy execution layer is gated and no funds were moved."
 * Bad wording to strip:
 *   - "Executed." / "Order placed." / "Stop-loss deployed."
 *   - "Swap completed." / "Strategy executed." / "Funds were transferred."
 */
export const FORBIDDEN_EXECUTION_CLAIMS: ReadonlyArray<RegExp> = [
  /\border\s+placed\b/i,
  /\bstop[- ]loss\s+deployed\b/i,
  /\bswaps?\s+completed\b/i,
  /\bexecuted\b/i,
  /\bfunds?\s+moved\b/i,
  /\bfunds?\s+transferred\b/i,
  /\bfunds?\s+(?:were|are|have\s+been)\s+(?:moved|transferred)\b/i,
  /\btransaction[s]?\s+executed\b/i,
];

const NEGATION_TOKENS: ReadonlyArray<RegExp> = [
  /\bnot\b/i,
  /\bnever\b/i,
  /\bno\b/i,
  /\bwithout\b/i,
];

/** True when `text` contains at least one positive execution claim (i.e. NOT
 * merely "not executed" / "gated" / "no funds were moved"). */
function hasExecutionClaim(text: string): boolean {
  const lower = text.toLowerCase();
  let scanAt = 0;
  while (scanAt < lower.length) {
    let matchIndex = -1;
    let matchLen = 0;
    for (const re of FORBIDDEN_EXECUTION_CLAIMS) {
      const m = re.exec(lower.slice(scanAt));
      if (m && (matchIndex === -1 || m.index < matchIndex)) {
        matchIndex = scanAt + m.index;
        matchLen = m[0]?.length ?? 0;
      }
    }
    if (matchIndex === -1) return false;
    const window = lower.slice(Math.max(0, matchIndex - 40), matchIndex);
    const negated = NEGATION_TOKENS.some((neg) =>
      new RegExp(`${neg.source}[\\w\\s]{0,16}$`, "i").test(window),
    );
    if (!negated) return true;
    scanAt = matchIndex + Math.max(matchLen, 1);
  }
  return false;
}

/** True when `text` contains no positive execution claim. */
export function assertHasNoExecutionClaim(text: string): boolean {
  return !hasExecutionClaim(text);
}

/** Cross-checks the requestId returned by /api/paid against the requestId found
 * in the on-chain HCS audit message. Only a provable mismatch fails; when either
 * value is unavailable the check is unverifiable and never blocks the flow. */
export function requestIdConsistency(
  apiRequestId?: string | null,
  hcsRequestId?: string | null,
): { ok: boolean; reason?: string } {
  const api = typeof apiRequestId === "string" ? apiRequestId.trim() : "";
  const hcs = typeof hcsRequestId === "string" ? hcsRequestId.trim() : "";
  if (api === "" || hcs === "") {
    return { ok: true, reason: "unverifiable: API and/or HCS requestId unavailable" };
  }
  if (api === hcs) {
    return { ok: true, reason: "API and HCS audit requestId match" };
  }
  return {
    ok: false,
    reason: "MISMATCH: /api/paid requestId differs from the HCS audit message",
  };
}

/** Defensive pass over engine narrative points: drop blanks and any point that
 * implies the strategy executed. Never invents replacements. */
export function sanitizeNarrativePoints(
  points: ReadonlyArray<string> | null | undefined,
): string[] {
  if (!Array.isArray(points)) return [];
  const out: string[] = [];
  for (const raw of points) {
    const clean = typeof raw === "string" ? raw.trim() : String(raw).trim();
    if (clean === "") continue;
    if (!assertHasNoExecutionClaim(clean)) continue;
    out.push(clean);
  }
  return out;
}

function fmtHbar(tinybars: string | number): string {
  const n = typeof tinybars === "number" ? tinybars : Number(tinybars);
  if (!Number.isFinite(n)) return UNAVAILABLE_TEXT;
  return `${(n / 1e8).toFixed(2)} HBAR`;
}

function fmtSeq(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "—";
  return String(n);
}

function mirrorAccountUrl(accountId: string): string {
  return `https://hashscan.io/testnet/account/${encodeURIComponent(accountId)}`;
}

function mirrorTopicUrl(topicId: string): string {
  return `https://hashscan.io/testnet/topic/${encodeURIComponent(topicId)}`;
}

function mirrorTxUrl(transactionId: string): string {
  return `https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`;
}

function makeSummaryCard(input: StudioInput): AnalysisSection {
  const rows: AnalysisRow[] = [
    {
      label: "Account",
      value: input.accountId,
      href: mirrorAccountUrl(input.accountId),
    },
    { label: "Network", value: input.network },
    { label: "Data source", value: "hedera-mirror-node" },
    {
      label: "Payment price",
      value: input.settlement ? fmtHbar(input.settlement.amountTinybars) : UNAVAILABLE_TEXT,
    },
  ];
  return {
    kind: "summary",
    title: "Analysis Summary",
    rows,
    bullets: [
      "Risk assessment completed using live Hedera Mirror Node data.",
      "Deterministic engine — zero fabricated metrics.",
    ],
    note: "This output is informational DeFi risk intelligence, not financial advice. It relies on public on-chain data; no funds are moved by the analysis layer.",
  };
}

function makeFactsCard(input: StudioInput): AnalysisSection {
  const rows: AnalysisRow[] = [];
  if (input.balanceExists === true) {
    rows.push({
      label: "Balance",
      value: input.balanceHbar ? `${Number(input.balanceHbar).toFixed(4)} HBAR` : UNAVAILABLE_TEXT,
    });
  } else if (input.balanceExists === false) {
    rows.push({ label: "Account exists", value: "No", tone: "warn" });
  } else {
    rows.push({ label: "Balance", value: UNAVAILABLE_TEXT });
  }

  const activity = input.activity;
  rows.push({
    label: "Recent inflow (30D)",
    value: activity?.ok ? `${activity.inflowHbar} HBAR` : UNAVAILABLE_TEXT,
  });
  rows.push({
    label: "Recent outflow (30D)",
    value: activity?.ok ? `${activity.outflowHbar} HBAR` : UNAVAILABLE_TEXT,
  });
  rows.push({
    label: "Tx count (mirror)",
    value: activity?.ok ? String(activity.total) : UNAVAILABLE_TEXT,
  });

  const poolCount =
    input.saucer?.ok === true &&
    typeof input.saucer.poolCount === "number" &&
    input.saucer.poolCount > 0
      ? input.saucer.poolCount
      : 0;
  const poolsValue =
    poolCount > 0 ? `${poolCount} snapshot${poolCount === 1 ? "" : "s"}` : UNAVAILABLE_TEXT;

  const bullets = sanitizeNarrativePoints(input.narrativePoints);
  return {
    kind: "facts",
    title: "Live Account Facts",
    rows: [...rows, { label: "SaucerSwap pools (read-only)", value: poolsValue, tone: "info" }],
    bullets:
      bullets.length > 0
        ? bullets
        : ["Live facts loaded from the mirror without fabrication."],
  };
}

function makeRiskCard(input: StudioInput): AnalysisSection {
  const activity = input.activity;
  const hasObservedActivity = activity?.ok === true && activity.total > 0;
  const rows: AnalysisRow[] = [
    {
      label: "Volatility exposure",
      value: hasObservedActivity ? "Flagged (observational)" : UNAVAILABLE_TEXT,
      tone: hasObservedActivity ? "warn" : "muted",
    },
    {
      label: "Concentration risk",
      value: "Based on observable account activity",
      tone: "info",
    },
    {
      label: "Liquidity / protocol data",
      value: input.saucer?.ok === true ? "Read-only snapshot only" : UNAVAILABLE_TEXT,
      tone: "info",
    },
    {
      label: "APY / yield data",
      value: UNAVAILABLE_TEXT,
      tone: "muted",
    },
  ];
  return {
    kind: "risk",
    title: "Risk Observations",
    rows,
    note: "Risk labels are observational statements over real on-chain data; they are not scored predictions and never justify automatic execution.",
  };
}

function makeRecommendationCard(): AnalysisSection {
  return {
    kind: "recommendation",
    title: "Recommendation",
    rows: [
      { label: "Suggested action", value: "Review a stop-loss policy", tone: "info" },
      { label: "Execution implied", value: "No", tone: "muted" },
      { label: "Funds moved", value: "None", tone: "muted" },
    ],
    note: "Reference recommendation only. No order was placed and no funds were moved. Any stop-loss policy would require a separately wired, permissioned execution layer.",
  };
}

function makeExecutionCard(topicId: string): AnalysisSection {
  return {
    kind: "execution",
    title: "Execution Guard",
    rows: [
      { label: "Execution status", value: "GATED · Not executed", tone: "warn" },
      { label: "Funds moved", value: "No funds were moved", tone: "info" },
      { label: "Strategy actions", value: "None performed", tone: "info" },
    ],
    note: `The strategy execution layer is gated and read-only on this deployment (SaucerSwap is a read-only oracle; no official protocol keys exist). The 0.01 HBAR micropayment settles the *analysis* over Blocky402 — the analysis itself never trades, lends, or rebalances. Audit trail: HCS ${topicId}.`,
  };
}

function makePaymentCard(input: StudioInput): AnalysisSection {
  const s = input.settlement;
  const rows: AnalysisRow[] = [];
  if (s && s.verified === true) {
    rows.push(
      { label: "Payment status", value: `${STATUS.SUCCESS} · settled`, tone: "ok" },
      { label: "Amount", value: fmtHbar(s.amountTinybars) },
      {
        label: "Transaction",
        value: s.transactionId,
        href: mirrorTxUrl(s.transactionId),
      },
      { label: "From → To", value: `${s.payerAccountId} → ${s.recipientAccountId}` },
      { label: "Mirror verified", value: "true", tone: "ok" },
      {
        label: "Consensus timestamp",
        value: s.consensusTimestamp ?? UNAVAILABLE_TEXT,
      },
    );
  } else {
    rows.push({
      label: "Payment status",
      value: `${STATUS.UNAVAILABLE} · not settled`,
      tone: "muted",
    });
  }
  return {
    kind: "payment",
    title: "Payment Evidence",
    rows,
    note: "Settlement is verified against the public Hedera Mirror Node — a 200 OK alone is never treated as proof.",
  };
}

function makeHcsCard(input: StudioInput): AnalysisSection {
  const requestId = input.audit?.requestId?.trim() || "";
  const sequenceNumber =
    typeof input.audit?.sequenceNumber === "number" && input.audit.sequenceNumber > 0
      ? input.audit.sequenceNumber
      : undefined;
  const rows: AnalysisRow[] = [
    {
      label: "Request ID",
      value: requestId !== "" ? requestId : UNAVAILABLE_TEXT,
      tone: requestId !== "" ? "info" : "muted",
      mono: true,
    },
    {
      label: "Audit topic",
      value: input.topicId || UNAVAILABLE_TEXT,
      href: input.topicId ? mirrorTopicUrl(input.topicId) : undefined,
    },
    {
      label: "Latest sequence",
      value: fmtSeq(sequenceNumber ?? input.hcsLastSeq),
    },
    {
      label: "Topic status",
      value: input.hcsOnline === true ? `${STATUS.INFO} · online` : UNAVAILABLE_TEXT,
      tone: input.hcsOnline === true ? "info" : "muted",
    },
  ];
  if (input.hcsAuditConsistency) {
    const c = input.hcsAuditConsistency;
    rows.push({
      label: "Request ID ↔ HCS",
      value: c.ok ? "Matched" : "Mismatch",
      tone: c.ok ? "ok" : "warn",
    });
  }
  return {
    kind: "hcs",
    title: "HCS Audit Evidence",
    rows,
    note: "Each settled request is published (safe metadata only — no secrets) to the on-chain audit topic and is verifiable by anyone. The request ID shown is the exact ID inside the HCS audit message.",
  };
}

export function makeDisclaimer(): string {
  return [
    "Still not sure? This output is informational DeFi risk intelligence, not financial advice, and not an offer to buy or sell any asset.",
    "The analysis settles a 0.01 HBAR micropayment over Blocky402 (x402 exact scheme) on Hedera Testnet, then reads and verifies data via the public Mirror Node.",
    "Strategy execution is GATED — NOT EXECUTED — on this deployment. No funds are moved by the analysis layer.",
  ].join(" ");
}

/** Build the structured, sanitized view for a completed paid analysis. */
export function buildStudioAnalysisView(input: StudioInput): StudioAnalysisView {
  const sections: AnalysisSection[] = [
    makeSummaryCard(input),
    makeFactsCard(input),
    makeRiskCard(input),
    makeRecommendationCard(),
    makeExecutionCard(input.topicId),
    makePaymentCard(input),
    makeHcsCard(input),
  ];

  const settled = input.settlement != null && input.settlement.verified === true;

  return {
    accountId: input.accountId,
    network: input.network,
    analyzedAt: input.analyzedAt,
    sections,
    executionStatus: EXECUTION_STATUS.GATED,
    executionText:
      "Execution status: Not executed. The strategy execution layer is gated and no funds were moved.",
    paymentStatus: settled ? STATUS.SUCCESS : STATUS.UNAVAILABLE,
    paymentText: settled
      ? "Payment status: 0.01 HBAR settled successfully through Blocky402."
      : "Payment status: no verified settlement on this deployment.",
    disclaimer: makeDisclaimer(),
  };
}
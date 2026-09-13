"use client";

import {
  STATUS,
  EXECUTION_STATUS,
  sanitizeNarrativePoints,
  type AnalysisSection,
  type AnalysisRow,
  type StudioAnalysisView,
} from "@/lib/assistant";

const KIND_ICON: Record<AnalysisSection["kind"], string> = {
  summary: "◈",
  facts: "◉",
  risk: "☉",
  recommendation: "→",
  execution: "⚷",
  payment: "₸",
  hcs: "#",
};

function RowValue({ row }: { row: AnalysisRow }) {
  const toneClass = row.tone ? `tone-${row.tone}` : "";
  if (row.mono) {
    return <code className={`analysis-row-mono ${toneClass}`}>{row.value}</code>;
  }
  if (row.href) {
    return (
      <a className={`analysis-row-value hashscan-link ${toneClass}`} href={row.href} target="_blank" rel="noreferrer">
        {row.value}
      </a>
    );
  }
  return <span className={`analysis-row-value ${toneClass}`}>{row.value}</span>;
}

function AnalysisCard({ section }: { section: AnalysisSection }) {
  const execCard = section.kind === "execution";
  const cls = `analysis-card${execCard ? " exec-guard" : ""}`;
  return (
    <div className={cls}>
      <h4>
        <span>
          {KIND_ICON[section.kind]} {section.title}
        </span>
        {execCard ? <span className="status-chip chip-gated">GATED · NOT EXECUTED</span> : null}
      </h4>
      <div className="analysis-rows">
        {section.rows.map((row) => (
          <div className="analysis-row" key={row.label}>
            <span className="analysis-row-label">{row.label}</span>
            <RowValue row={row} />
          </div>
        ))}
      </div>
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="analysis-bullets">
          {section.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {section.note ? <div className="analysis-note">{section.note}</div> : null}
    </div>
  );
}

export default function PaidAnalysisResult({ analysis }: { analysis: StudioAnalysisView }) {
  const sanitized: AnalysisSection[] = analysis.sections.map((section) =>
    section.bullets
      ? {
          ...section,
          bullets: sanitizeNarrativePoints(section.bullets),
        }
      : section,
  );

  const paymentChip =
    analysis.paymentStatus === STATUS.SUCCESS ? "chip-settled" : "chip-unavailable";
  const executionPill =
    analysis.executionStatus === EXECUTION_STATUS.GATED ? "chip-gated" : "chip-unavailable";

  return (
    <div className="analysis-panel">
      <div className="analysis-head">
        <span>
          <span className={`status-chip ${paymentChip}`}>
            Payment settlement: {analysis.paymentStatus}
          </span>
          <span className={`status-chip ${executionPill}`}>
            Strategy execution: {analysis.executionStatus} · NOT EXECUTED
          </span>
        </span>
        <span className="analysis-account" title={analysis.network}>
          {analysis.accountId}
        </span>
      </div>

      <div className="analysis-grid">
        {sanitized.map((section) => (
          <AnalysisCard key={section.kind} section={section} />
        ))}
      </div>

      <div className="disclaimer-card">
        <strong>Disclaimer:</strong> {analysis.disclaimer}
      </div>
    </div>
  );
}
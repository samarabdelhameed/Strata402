"use client";

import { Shell } from "@/components/Shell";
import { useApi } from "@/hooks/useApi";

interface HcsRead {
  ok: boolean;
  topicId: string;
  messages: Array<{
    sequenceNumber: number;
    consensusTimestamp: string;
    runningHash: string;
    message: string;
    payerAccountId: string | null;
  }>;
  error?: string;
}

export default function AuditPage() {
  const hcs = useApi<HcsRead>("/api/hcs?limit=25", 10_000);

  return (
    <Shell>
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">HCS Audit Explorer</h1>
            <p className="mt-1 text-sm text-[#8a93a3]">
              Immutable audit trail of paid requests — read live from the Hedera Consensus
              Service topic on the public Mirror Node.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost !py-1.5 !text-xs" onClick={hcs.refresh}>
              Refresh feed
            </button>
            {hcs.data?.topicId ? (
              <a
                href={`https://hashscan.io/testnet/topic/${hcs.data.topicId}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost !py-1.5 !text-xs"
              >
                View topic on HashScan ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className="mono mt-4 inline-flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-[#00F2FE]">
          TOPIC {hcs.data?.topicId ?? "—"}
          <span className={hcs.data?.ok ? "chips chip-live" : "chips chip-warn"}>
            {hcs.data?.ok ? "live" : "offline"}
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-[#5d6573]">
              <tr>
                <th className="px-4 py-3">Seq</th>
                <th className="px-4 py-3">Consensus timestamp</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Running hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hcs.loading && hcs.data === null ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <div className="skeleton h-4 w-full" />
                  </td>
                </tr>
              ) : null}
              {hcs.data?.messages.map((m) => (
                <tr key={m.sequenceNumber} className="align-top hover:bg-white/[0.02]">
                  <td className="mono px-4 py-3 text-[#00F2FE]">{m.sequenceNumber}</td>
                  <td className="mono px-4 py-3 text-xs text-[#c8d1de]">{m.consensusTimestamp}</td>
                  <td className="mono px-4 py-3 text-xs text-[#8a93a3]">
                    {m.payerAccountId ?? "—"}
                  </td>
                  <td className="mono px-4 py-3 text-xs text-[#9de8e4]">{m.message}</td>
                  <td className="mono px-4 py-3 text-xs text-[#6b7280]">
                    0x{m.runningHash.slice(0, 10)}…{m.runningHash.slice(-6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hcs.data?.ok && hcs.data.messages.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#5d6573]">
              No messages published to this topic yet.
            </div>
          ) : null}
        </div>

        {hcs.data && !hcs.data.ok ? (
          <div className="glass mt-4 border-[#FF5252]/40 p-4 text-sm text-[#FFB259]">
            {hcs.data.error}
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
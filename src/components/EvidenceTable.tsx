"use client";
import type { EvidenceRecord } from "@/lib/types";

export function EvidenceTable({ evidence }: { evidence: EvidenceRecord[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface1 p-6 text-sm text-inksubtle">
        No evidence registered yet. Upload files or load the demo case.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-inksubtle">
            <th className="px-4 py-3 font-medium">Evidence ID</th>
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">SHA-256</th>
            <th className="px-4 py-3 font-medium">Parser</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => (
            <tr key={e.evidenceId} className="border-b border-hairline last:border-0">
              <td className="mono px-4 py-3 text-ink">{e.evidenceId}</td>
              <td className="px-4 py-3 text-inkmuted">
                {e.fileName}
                <span className="mono block text-[11px] text-inktertiary">
                  {(e.fileSize / 1024).toFixed(1)} KB · {new Date(e.registeredAt).toLocaleTimeString()}
                </span>
              </td>
              <td className="px-4 py-3 text-inkmuted">{e.fileType}</td>
              <td className="mono max-w-[220px] truncate px-4 py-3 text-[12px] text-inkmuted" title={e.sha256}>
                {e.sha256}
              </td>
              <td className="mono px-4 py-3 text-[12px] text-inksubtle">{e.parserVersion}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    e.status === "verified"
                      ? "bg-surface3 text-[#4ade80]"
                      : "bg-surface3 text-red-400"
                  }`}
                >
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

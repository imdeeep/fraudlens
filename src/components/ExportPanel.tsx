"use client";
import type { AnalyzeResponse, EvidenceRecord } from "@/lib/types";
import { buildJsonReport, buildManifest, downloadJson, generatePdfBrief } from "@/lib/report";

type Props = {
  caseId: string;
  caseTitle: string;
  evidence: EvidenceRecord[];
  result: AnalyzeResponse;
};

export function ExportPanel({ caseId, caseTitle, evidence, result }: Props) {
  return (
    <div className="rounded-xl border border-hairline bg-surface1 p-6">
      <h3 className="text-lg font-semibold tracking-tight text-ink">Export</h3>
      <p className="mt-1 text-sm text-inksubtle">
        JSON report, one-page PDF brief, and evidence manifest. All generated locally in your
        browser.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => downloadJson(`fraudlens-${caseId}-report.json`, buildJsonReport(caseId, caseTitle, evidence, result))}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryhover"
        >
          Download JSON report
        </button>
        <button
          onClick={() => generatePdfBrief({ caseId, caseTitle, evidence, result })}
          className="rounded-md border border-hairlinestrong bg-surface2 px-4 py-2 text-sm font-medium text-ink hover:bg-surface3"
        >
          Download PDF brief
        </button>
        <button
          onClick={() => downloadJson(`fraudlens-${caseId}-manifest.json`, buildManifest(caseId, evidence))}
          className="rounded-md border border-hairlinestrong bg-surface2 px-4 py-2 text-sm font-medium text-ink hover:bg-surface3"
        >
          Download manifest
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-hairline bg-surface2 p-3">
        <p className="text-xs font-medium text-inkmuted">Transaction chain</p>
        <p className="mono mt-1 text-sm text-ink">
          {result.transactionChain.length > 0 ? result.transactionChain.join(" -> ") : "-"}
        </p>
        <p className="mt-2 text-xs font-medium text-inkmuted">Investigative leads</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-inkmuted">
          {result.investigativeLeads.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

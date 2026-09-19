"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { EvidenceTable } from "@/components/EvidenceTable";
import { processFiles, type ParseReport } from "@/components/upload";
import { CASE_ID, CASE_TITLE } from "@/lib/demo-data";
import { saveCase } from "@/lib/case-store";
import type { EvidenceRecord, NormalizedRecord } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [caseId, setCaseId] = useState(CASE_ID);
  const [caseTitle, setCaseTitle] = useState(CASE_TITLE);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [records, setRecords] = useState<NormalizedRecord[]>([]);
  const [reports, setReports] = useState<ParseReport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const step = evidence.length > 0 ? 2 : 1;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const out = await processFiles(arr, evidence.length);
      setEvidence((p) => [...p, ...out.evidence]);
      setRecords((p) => [...p, ...out.records]);
      setReports((p) => [...p, ...out.reports]);
      setErrors((p) => [...p, ...out.errors]);
    },
    [evidence.length]
  );

  const openDashboard = useCallback(
    (ev: EvidenceRecord[], rec: NormalizedRecord[], id: string, title: string) => {
      if (ev.length === 0 || rec.length === 0) {
        setErrors((p) => [...p, "Upload at least one supported file before analyzing."]);
        return;
      }
      try {
        saveCase({ caseId: id, caseTitle: title, evidence: ev, records: rec });
        router.push("/dashboard");
      } catch (e) {
        setErrors((p) => [...p, e instanceof Error ? e.message : "Could not open dashboard."]);
      }
    },
    [router]
  );

  const reset = useCallback(() => {
    setEvidence([]);
    setRecords([]);
    setReports([]);
    setErrors([]);
  }, []);

  const totals = useMemo(() => {
    const accepted = reports.reduce((s, r) => s + r.accepted, 0);
    const rejected = reports.reduce((s, r) => s + r.rejected, 0);
    const skipped = reports.reduce((s, r) => s + r.skipped, 0);
    return { accepted, rejected, skipped };
  }, [reports]);

  return (
    <div className="flex min-h-full flex-col bg-canvas text-ink">
      <TopNav step={step} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {/* Hero */}
        <div className="max-w-3xl">
          <p className="text-[13px] font-medium tracking-wide text-inksubtle">
            UNIFIED CYBER FRAUD ANALYSIS
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink md:text-[40px] md:leading-[1.15]">
            From fragmented evidence to one investigation graph.
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-inkmuted">
            Upload CDR, IPDR, bank and device files. FraudLens hashes, normalizes, correlates
            shared identifiers, scores risk, and reconstructs the victim → mule → cash-out chain.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <div className="ml-auto flex gap-2">
            <button
              onClick={reset}
              className="rounded-md border border-hairlinestrong bg-surface1 px-4 py-2 text-sm font-medium text-ink hover:bg-surface2"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 1 · Case setup + upload */}
        <section className="mt-6 rounded-xl border border-hairline bg-surface1 p-6">
          <h2 className="text-xl font-medium tracking-tight text-ink">1 · Case setup & upload</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-inkmuted">Case ID</span>
              <input
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-surface1 px-3 py-2 text-sm text-ink"
                placeholder="CASE-001"
              />
            </label>
            <label className="block">
              <span className="text-sm text-inkmuted">Case title</span>
              <input
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-surface1 px-3 py-2 text-sm text-ink"
                placeholder="Rapid Mule Account Routing"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              { label: "CDR (.csv)", accept: ".csv" },
              { label: "IPDR (.csv)", accept: ".csv" },
              { label: "Bank transactions (.csv)", accept: ".csv" },
              { label: "Device (.json)", accept: ".json,application/json" },
            ].map((slot) => (
              <label
                key={slot.label}
                className="cursor-pointer rounded-lg border border-hairline bg-surface2 p-4 text-center hover:bg-surface3"
              >
                <span className="block text-sm font-medium text-ink">{slot.label}</span>
                <span className="mono mt-1 block text-[11px] text-inksubtle">
                  click to choose file
                </span>
                <input
                  type="file"
                  accept={slot.accept}
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-hairline bg-surface2 p-3">
            <p className="text-xs font-medium text-ink">Need the demo files?</p>
            <p className="mt-1 text-xs text-inksubtle">
              Download the synthetic evidence files, then upload them above to demonstrate the
              manual workflow.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {[
                ["cdr.csv", "/samples/cdr.csv"],
                ["ipdr.csv", "/samples/ipdr.csv"],
                ["bank_transactions.csv", "/samples/bank_transactions.csv"],
                ["device.json", "/samples/device.json"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  download
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Download {label}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => openDashboard(evidence, records, caseId, caseTitle)}
              disabled={evidence.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryhover disabled:opacity-50"
            >
              Analyze on dashboard ({records.length} records) →
            </button>
            <p className="text-xs text-inksubtle">
              Supported: cdr.csv · ipdr.csv · bank_transactions.csv · device.json · Browser-side
              SHA-256 + parsing. Accepted {totals.accepted} · Rejected {totals.rejected} ·
              Skipped {totals.skipped}.
            </p>
          </div>
          {errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3">
              <p className="text-xs font-medium text-red-300">Notices ({errors.length})</p>
              <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-red-200/90">
                {errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 2 · Evidence verification */}
        {evidence.length > 0 && (
          <section id="evidence" className="mt-6 scroll-mt-20">
            <h2 className="text-xl font-medium tracking-tight text-ink">2 · Evidence verification</h2>
            <p className="mt-1 text-sm text-inksubtle">
              Every file gets a reproducible SHA-256 and Evidence ID (EVD001…).
            </p>
            <div className="mt-3">
              <EvidenceTable evidence={evidence} />
            </div>
            {reports.length > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                {reports.map((r) => (
                  <div key={r.fileName} className="rounded-lg border border-hairline bg-surface1 p-3">
                    <p className="mono truncate text-xs text-ink">{r.fileName}</p>
                    <p className="mt-1 text-[11px] text-inksubtle">
                      {r.kind} · ✓ {r.accepted} · ✗ {r.rejected} · ○ {r.skipped}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 border-t border-hairline py-6">
          <p className="text-xs text-inktertiary">
            FraudLens AI · Secure evidence handling · Deterministic correlation · Exportable case
            briefs.
          </p>
        </footer>
      </main>
    </div>
  );
}

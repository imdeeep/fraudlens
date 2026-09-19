"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { EvidenceTable } from "@/components/EvidenceTable";
import { DashboardStats } from "@/components/DashboardStats";
import { GraphView } from "@/components/GraphView";
import { TimelineView, RiskPanel } from "@/components/TimelineRisk";
import { ExportPanel } from "@/components/ExportPanel";
import { AIInsights } from "@/components/AIInsights";
import { AnalysisLoader } from "@/components/AnalysisLoader";
import { loadCase, type StoredCase } from "@/lib/case-store";
import type { AnalyzeResponse } from "@/lib/types";

type Phase = "boot" | "running" | "done" | "empty" | "failed";

function ChainBanner({ result }: { result: AnalyzeResponse }) {
  const chain = result.transactionChain;
  if (chain.length < 2) return null;
  const pairAmount = new Map(
    result.transactions.map((t) => [`${t.senderAccount}→${t.receiverAccount}`, t.amount])
  );
  const riskOf = (label: string) => {
    const r = result.riskResults.find((x) => x.entityId === `acct:${label}`);
    return r ? `${r.score} · ${r.band}` : null;
  };
  return (
    <div className="rounded-xl border border-hairline bg-surface1 p-4">
      <p className="text-xs font-medium text-inksubtle">Victim → mule → cash-out chain</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {chain.map((label, i) => {
          const isFirst = i === 0;
          const isLast = i === chain.length - 1;
          const risk = riskOf(label);
          return (
            <span key={`${label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span className="flex flex-col items-center">
                  <span className="text-primaryhover">→</span>
                  {pairAmount.get(`${chain[i - 1]}→${label}`) != null && (
                    <span className="mono text-[10px] text-inksubtle">
                      ₹{pairAmount.get(`${chain[i - 1]}→${label}`)!.toLocaleString("en-IN")}
                    </span>
                  )}
                </span>
              )}
              <span
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  isFirst
                    ? "border-blue-900 bg-blue-950/40 text-blue-200"
                    : isLast
                      ? "border-red-900 bg-red-950/40 text-red-200"
                      : "border-orange-900 bg-orange-950/30 text-orange-200"
                }`}
                title={risk ?? ""}
              >
                <span className="mono">{label}</span>
                {risk && <span className="mono ml-2 text-[10px] opacity-70">{risk}</span>}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stored, setStored] = useState<StoredCase | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodeInfo, setNodeInfo] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onSelect = useCallback((id: string | null, info: string) => {
    setSelectedNode(id);
    setNodeInfo(info);
  }, []);

  const boot = useCallback(async () => {
    const c = loadCase();
    if (!c) {
      setPhase("empty");
      return;
    }
    setStored(c);
    setError(null);
    setResult(null);
    setPhase("running");
    setStage(0);
    timerRef.current = setInterval(() => {
      setStage((s) => (s < 4 ? s + 1 : s));
    }, 700);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: c.caseId, evidence: c.evidence, records: c.records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      if (timerRef.current) clearInterval(timerRef.current);
      setResult(data as AnalyzeResponse);
      setStage(5);
    } catch (e) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("failed");
    }
  }, []);

  // Kick off once on mount. The started-guard lives inside the effect
  // (never touched during render), so lint stays happy.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void boot();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [boot]);

  const handleAnalysisDone = useCallback((ok: boolean) => {
    setPhase(ok ? "done" : "failed");
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-canvas text-ink">
      <TopNav step={3} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {phase === "boot" && (
          <div className="flex items-center gap-3 py-20 text-sm text-inksubtle">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-hairlinestrong border-t-primary" />
            Loading case…
          </div>
        )}

        {phase === "running" && (
          <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
            <div className="w-full max-w-3xl">
              <AnalysisLoader activeStage={result ? 5 : stage} failed={null} />
            </div>
          </div>
        )}

        {phase === "empty" && (
          <div className="rounded-xl border border-hairline bg-surface1 p-8 text-center">
            <h1 className="text-xl font-semibold text-ink">No case loaded</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-inksubtle">
              Upload evidence first - the dashboard runs automatically once a case is handed off.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryhover"
            >
              ← Back to case setup
            </Link>
          </div>
        )}

        {phase === "done" && stored && (
          <div className="mb-4">
            <Link href="/" className="text-xs text-inksubtle hover:text-inkmuted">
              ← Case setup & evidence
            </Link>
          </div>
        )}

        {result && stored && (
          <div className={phase === "done" ? "" : "sr-only"}>
            <AIInsights
              key={`${stored.caseId}-${result.summary.highestRiskScore}-${result.summary.relationshipsDetected}`}
              caseId={stored.caseId}
              caseTitle={stored.caseTitle}
              result={result}
              autoGenerate={phase === "running"}
              onDone={handleAnalysisDone}
            />
          </div>
        )}

        {phase === "failed" && stored && (
          <div className="rounded-xl border border-red-900 bg-red-950/30 p-6">
            <p className="text-sm font-medium text-red-300">Analysis failed</p>
            <p className="mt-1 text-xs text-red-200/90">{error}</p>
            <button
              onClick={() => void boot()}
              className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryhover"
            >
              Retry
            </button>
          </div>
        )}

        {phase === "done" && stored && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Investigation dashboard
                </h1>
                <p className="mono mt-1 text-xs text-inksubtle">
                  {stored.caseId} · {stored.caseTitle} · {stored.evidence.length} files ·{" "}
                  {stored.records.length} records
                </p>
              </div>
              <button
                onClick={() => void boot()}
                className="rounded-md border border-hairlinestrong bg-surface1 px-4 py-2 text-sm font-medium text-ink hover:bg-surface2"
              >
                Re-run analysis
              </button>
            </div>

            {/* Results */}
            {result && (
              <>
                <DashboardStats result={result} />
                <ChainBanner result={result} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-hairline bg-surface1 p-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-ink">Network graph</h3>
                      <span className="mono text-[11px] text-inktertiary">
                        {result.entities.length} nodes · {result.relationships.length} edges
                      </span>
                    </div>
                    <div className="mt-2">
                      <GraphView result={result} onSelect={onSelect} />
                    </div>
                    {selectedNode && (
                      <pre className="mono mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-surface2 p-3 text-[11px] text-inkmuted">
                        {selectedNode}
                        {"\n"}
                        {nodeInfo}
                      </pre>
                    )}
                  </div>
                  <RiskPanel result={result} />
                </div>
                <TimelineView result={result} />

                <section id="export" className="scroll-mt-20">
                  <h2 className="text-xl font-medium tracking-tight text-ink">Export</h2>
                  <div className="mt-3">
                    <ExportPanel
                      caseId={stored.caseId}
                      caseTitle={stored.caseTitle}
                      evidence={stored.evidence}
                      result={result}
                    />
                  </div>
                </section>

                <details className="rounded-xl border border-hairline bg-surface1 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-inkmuted">
                    Evidence manifest ({stored.evidence.length} files)
                  </summary>
                  <div className="mt-3">
                    <EvidenceTable evidence={stored.evidence} />
                  </div>
                </details>
              </>
            )}
          </div>
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

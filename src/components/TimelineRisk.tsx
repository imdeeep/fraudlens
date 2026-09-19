"use client";
import type { AnalyzeResponse } from "@/lib/types";
import { bandColor } from "./DashboardStats";

export function TimelineView({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface1">
      <div className="border-b border-hairline px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Chronological timeline</h3>
      </div>
      <ol className="max-h-[420px] overflow-y-auto px-4 py-2">
        {result.timeline.map((t, i) => (
          <li key={i} className="flex gap-3 border-b border-hairline py-3 last:border-0">
            <div className="mono w-36 shrink-0 text-[11px] text-inksubtle">
              {t.time.startsWith("1970") ? "- (no time)" : new Date(t.time).toLocaleString()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="rounded-full bg-surface3 px-2 py-0.5 text-[11px] text-inkmuted">
                {t.eventType}
              </span>
              <p className="mt-1 text-sm text-ink">{t.description}</p>
              <p className="mono mt-1 text-[11px] text-inktertiary">
                {t.entityOrTransaction} · {t.evidenceId}
                {t.amount ? ` · ₹${t.amount.toLocaleString("en-IN")}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RiskPanel({ result }: { result: AnalyzeResponse }) {
  if (result.riskResults.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface1 p-4 text-sm text-inksubtle">
        No risk indicators fired.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-hairline bg-surface1">
      <div className="border-b border-hairline px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Risk explanation (0-100, deterministic)</h3>
      </div>
      <div className="space-y-3 px-4 py-3">
        {result.riskResults.slice(0, 6).map((r) => (
          <div key={r.entityId} className="rounded-lg border border-hairline bg-surface2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="mono truncate text-xs text-ink">{r.entityId}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${bandColor(r.band)}`}
              >
                {r.score} · {r.band}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface3">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, r.score)}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {r.indicators.map((ind) => (
                <li key={ind.name} className="text-xs text-inkmuted">
                  <span className="font-medium text-ink">+{ind.points} {ind.name}</span> -{" "}
                  {ind.explanation}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

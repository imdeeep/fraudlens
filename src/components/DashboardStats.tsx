"use client";
import type { AnalyzeResponse } from "@/lib/types";

export function DashboardStats({ result }: { result: AnalyzeResponse }) {
  const s = result.summary;
  const cards = [
    { label: "Files processed", value: String(s.filesProcessed) },
    { label: "Entities extracted", value: String(s.entitiesExtracted) },
    { label: "Relationships", value: String(s.relationshipsDetected) },
    { label: "Transactions", value: String(s.transactionsAnalysed) },
    {
      label: "Highest risk",
      value: `${s.highestRiskScore}`,
      sub: s.highestRiskEntityId ?? "",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-hairline bg-surface1 p-4">
          <p className="text-xs text-inksubtle">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{c.value}</p>
          {c.sub ? <p className="mono mt-1 truncate text-[11px] text-inkmuted">{c.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function bandColor(band: string): string {
  if (band === "Critical") return "text-red-400 border-red-900 bg-red-950/40";
  if (band === "High") return "text-orange-300 border-orange-900 bg-orange-950/30";
  if (band === "Medium") return "text-yellow-200 border-yellow-900 bg-yellow-950/30";
  return "text-emerald-300 border-emerald-900 bg-emerald-950/30";
}

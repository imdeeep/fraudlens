"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";

type Props = {
  caseId: string;
  caseTitle: string;
  result: AnalyzeResponse;
  /** When true, generation starts automatically on mount (dashboard flow). */
  autoGenerate?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onDone?: (ok: boolean) => void;
};

// Minimal markdown renderer: headers, bold, bullets, ordered fallback to paragraphs.
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const els: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = (key: string) => {
    if (listBuf.length === 0) return;
    els.push(
      <ul key={key} className="mt-1 list-disc space-y-1 pl-5 text-sm text-inkmuted">
        {listBuf.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </ul>
    );
    listBuf = [];
  };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-ink font-medium'>$1</strong>")
      .replace(/`(.+?)`/g, "<code class='mono text-[12px] text-ink'>$1</code>");

  const isTableRow = (t: string) => /^\|.+\|$/.test(t);
  const isSeparatorRow = (t: string) => /^\|?[\s:|-]+\|?[\s:|.-]*$/.test(t) && t.includes("---");
  let tableBuf: string[][] = [];
  const flushTable = (key: string) => {
    if (tableBuf.length === 0) return;
    const [head, ...rest] = tableBuf;
    const body = rest.filter((r) => !isSeparatorRow(`|${r.join("|")}|`));
    els.push(
      <div key={key} className="mt-2 overflow-x-auto rounded-lg border border-hairline">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-surface3">
              {head.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-3 py-2 font-medium text-ink"
                  dangerouslySetInnerHTML={{ __html: inline(c.trim()) }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i} className="border-t border-hairline">
                {row.map((c, j) => (
                  <td
                    key={j}
                    className="mono whitespace-nowrap px-3 py-1.5 text-[12px] text-inkmuted"
                    dangerouslySetInnerHTML={{ __html: inline(c.trim()) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuf = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (isTableRow(t)) {
      flushList(`ul-${i}`);
      tableBuf.push(t.slice(1, -1).split("|"));
      return;
    }
    flushTable(`tbl-${i}`);
    if (t.startsWith("## ")) {
      flushList(`ul-${i}`);
      els.push(
        <h4 key={i} className="mt-4 text-sm font-semibold text-ink first:mt-0">
          {t.slice(3)}
        </h4>
      );
    } else if (t.startsWith("### ")) {
      flushList(`ul-${i}`);
      els.push(
        <h5 key={i} className="mt-3 text-[13px] font-semibold text-ink">
          {t.slice(4)}
        </h5>
      );
    } else if (/^[-*] /.test(t)) {
      listBuf.push(t.slice(2));
    } else if (/^\d+\. /.test(t)) {
      listBuf.push(t.replace(/^\d+\. /, ""));
    } else if (t === "") {
      flushList(`ul-${i}`);
    } else {
      flushList(`ul-${i}`);
      els.push(
        <p
          key={i}
          className="mt-1.5 text-sm leading-relaxed text-inkmuted"
          dangerouslySetInnerHTML={{ __html: inline(t) }}
        />
      );
    }
  });
  flushList("ul-end");
  flushTable("tbl-end");
  return els;
}

export function AIInsights({ caseId, caseTitle, result, autoGenerate, onLoadingChange, onDone }: Props) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Parent remounts this component (via key) whenever a new analysis arrives,
  // so no reset effect is needed here.

  const setBusy = useCallback(
    (v: boolean) => {
      setLoading(v);
      onLoadingChange?.(v);
    },
    [onLoadingChange]
  );

  const generate = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, caseTitle, result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis generation failed");
      setInsight(data.insight as string);
      onDone?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis generation failed");
      onDone?.(false);
    } finally {
      setBusy(false);
    }
  }, [caseId, caseTitle, result, setBusy, onDone]);

  // Auto-start once on mount for the dashboard flow. The started-guard lives
  // inside the effect (never touched during render), so lint stays happy.
  const startedRef = useRef(false);
  useEffect(() => {
    if (autoGenerate && !startedRef.current) {
      startedRef.current = true;
      void generate();
    }
  }, [autoGenerate, generate]);

  return (
    <div className="rounded-xl border border-hairline bg-surface1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-white">
              F
            </span>
            Investigation Analysis
          </h3>
          <p className="mt-1 text-xs text-inksubtle">
            Pipeline: deterministic correlation → risk scoring → investigation analysis.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryhover disabled:opacity-60"
        >
          {loading ? "Analyzing…" : insight ? "Regenerate" : "Generate analysis"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-hairlinestrong bg-surface2 p-3 text-xs text-inkmuted">
          {error}
          {error.includes("GROQ_API_KEY") && (
            <span className="mono mt-1 block text-[11px] text-inksubtle">
              Add GROQ_API_KEY=… to .env.local (see .env.example), restart dev, retry. On Vercel:
              Project → Settings → Environment Variables.
            </span>
          )}
        </div>
      )}

      {insight ? (
        <div className="mt-3 rounded-lg border border-hairline bg-surface2 p-4">
          {renderMarkdown(insight)}
          <p className="mt-3 border-t border-hairline pt-2 text-[11px] text-inktertiary">
            Analysis supplements deterministic rules - verify against cited Evidence IDs before
            action.
          </p>
        </div>
      ) : loading ? (
        <div className="mt-3 rounded-lg border border-hairline bg-surface2 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-hairlinestrong border-t-primary" />
            Generating analysis<span className="animate-pulse">…</span>
          </p>
          <p className="mt-1 text-xs text-inksubtle">
            Reading engine findings, tracing the money trail, drafting the brief.
          </p>
          <div className="mt-3 space-y-2" aria-hidden>
            {[92, 78, 85, 64, 88, 71].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-surface3"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      ) : (
        !error && (
          <p className="mt-3 text-xs text-inktertiary">
            No analysis summary yet. Run deterministic analysis first, then generate - executive
            summary, money trail, linkages, risk justification, next steps, limitations.
          </p>
        )
      )}
    </div>
  );
}

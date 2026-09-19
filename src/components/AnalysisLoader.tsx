"use client";

export const PIPELINE_STAGES = [
  "Verifying evidence integrity",
  "Extracting entities",
  "Correlating identifiers",
  "Scoring risk",
  "Reconstructing money trail",
  "Preparing investigation analysis",
] as const;

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hairlinestrong border-t-primary"
      aria-hidden
    />
  );
}

function Check() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
      ✓
    </span>
  );
}

function PendingDot() {
  return <span className="h-4 w-4 shrink-0 rounded-full border border-hairlinestrong" />;
}

export function AnalysisLoader({
  activeStage,
  failed,
}: {
  activeStage: number;
  failed?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface1">
      <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          <span className="absolute inset-0 animate-ping rounded-lg bg-primary opacity-20" />
          F
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {failed ? "Analysis halted" : "Generating analysis…"}
          </p>
          <p className="text-xs text-inksubtle">
            {failed ?? "Deterministic pipeline → investigation analysis. This usually takes seconds."}
          </p>
        </div>
      </div>
      <ol className="grid gap-1 p-4 sm:grid-cols-2">
        {PIPELINE_STAGES.map((label, i) => {
          const done = i < activeStage;
          const active = i === activeStage && !failed;
          return (
            <li
              key={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${
                done
                  ? "text-inkmuted"
                  : active
                    ? "bg-surface2 text-ink"
                    : "text-inktertiary"
              }`}
            >
              {done ? <Check /> : active ? <Spinner /> : <PendingDot />}
              <span className={active ? "font-medium" : ""}>
                {label}
                {active && <span className="animate-pulse">…</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {/* shimmer bar */}
      {!failed && (
        <div className="h-1 w-full overflow-hidden bg-surface2">
          <div
            className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-primary"
            style={{ animationName: "loaderSlide" }}
          />
        </div>
      )}
      <style>{`@keyframes loaderSlide { 0% { margin-left: -33%; } 100% { margin-left: 100%; } }`}</style>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-hairline bg-surface1 p-4">
          <div className="h-3 w-20 rounded bg-surface3" />
          <div className="mt-2 h-7 w-12 rounded bg-surface3" />
        </div>
      ))}
    </div>
  );
}

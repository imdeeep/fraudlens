import { NextResponse } from "next/server";
import { analyzeCase } from "@/lib/analysis";
import type { AnalyzeRequest } from "@/lib/types";

// POST /api/analyze - deterministic correlation + scoring (spec §19)
// Body is small normalized JSON (browser already hashed + parsed raw files).
export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    // Vercel 4.5MB guard with margin
    if (contentLength > 4_000_000) {
      return NextResponse.json(
        { error: "Request too large. Parse files in the browser and send normalized JSON only." },
        { status: 413 }
      );
    }
    const body = (await req.json()) as Partial<AnalyzeRequest>;
    if (!body || typeof body.caseId !== "string" || !Array.isArray(body.records) || !Array.isArray(body.evidence)) {
      return NextResponse.json(
        { error: "Invalid request: need { caseId, evidence[], records[] }." },
        { status: 400 }
      );
    }
    if (body.records.length > 20000) {
      return NextResponse.json(
        { error: "Too many records for POC (max 20000)." },
        { status: 413 }
      );
    }
    const result = analyzeCase({
      caseId: body.caseId,
      evidence: body.evidence,
      records: body.records,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze] failed (no PII logged)");
    return NextResponse.json(
      { error: "Analysis failed.", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/groq";
import type { AnalyzeResponse } from "@/lib/types";

// POST /api/insights - AI narrative layer over deterministic engine output.
// Body: { caseId, caseTitle, result }. Only normalized findings are forwarded
// to Groq (never raw evidence files). Key stays server-side via GROQ_API_KEY.
export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Analysis service is not configured. Set GROQ_API_KEY in .env.local (or Vercel env) to enable.",
        },
        { status: 503 }
      );
    }
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 4_000_000) {
      return NextResponse.json({ error: "Insight request too large." }, { status: 413 });
    }
    const body = (await req.json()) as {
      caseId?: string;
      caseTitle?: string;
      result?: AnalyzeResponse;
    };
    if (!body?.caseId || !body?.result?.summary) {
      return NextResponse.json(
        { error: "Invalid request: need { caseId, caseTitle, result }." },
        { status: 400 }
      );
    }
    const { insight, model } = await generateInsights({
      caseId: body.caseId,
      caseTitle: body.caseTitle ?? body.caseId,
      result: body.result,
    });
    console.log(`[insights] case=${body.caseId} model=${model} chars=${insight.length}`);
    return NextResponse.json({ insight, model, generatedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[insights] failed:", msg.slice(0, 200));
    const status = msg.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: "Analysis generation failed.", detail: msg }, { status });
  }
}

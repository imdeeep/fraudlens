// Server-only Groq insight layer - supplements (never replaces) the deterministic engine.
// Env: GROQ_API_KEY (required), GROQ_MODEL (optional, default llama-3.3-70b-versatile).
// Uses Groq's OpenAI-compatible endpoint. Key stays server-side.
import type { AnalyzeResponse } from "./types";

export const GROQ_MODEL_DEFAULT = "llama-3.1-8b-instant";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// Fallback chain: Groq retires model IDs periodically, so if the configured
// model is gone we automatically retry with known-good alternatives.
const FALLBACK_MODELS = [
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct",
];

function candidateModels(): string[] {
  const configured = process.env.GROQ_MODEL || GROQ_MODEL_DEFAULT;
  return [...new Set([configured, ...FALLBACK_MODELS])];
}

export const AI_SYSTEM_PROMPT = `You are FraudLens Senior Fraud Analyst, an expert in cyber financial-crime investigation: UPI mule networks, CDR/IPDR correlation, device fingerprinting (IMEI/IMSI), and fund-flow reconstruction.

You receive GROUND-TRUTH output from a deterministic correlation engine: entities, relationships (each with a confidence score and supporting Evidence IDs like EVD001), explainable risk scores with point reasons, a directed transaction chain, a chronological timeline, and rule-based leads.

STRICT RULES:
1. Treat the engine output as ground truth. NEVER invent entities, IDs, amounts, timestamps, hashes, or evidence references not present in the input.
2. Cite Evidence IDs (e.g. EVD001) and confidence values for every linkage claim.
3. A shared IMEI/IMSI/account/UPI (confidence 1.00) is a STRONG device/account link - say so. A shared IP (confidence 0.75 or 0.30) is CONTEXTUAL ONLY - explicitly state it is not proof of identity and needs CGNAT/NAT corroboration.
4. NEVER declare guilt, name a suspect as guilty, or claim court-admissibility. Frame everything as investigative leads requiring officer verification.
5. Be officer-ready and concise: 300-450 words, markdown, fixed sections below. No preamble about being an AI.

OUTPUT FORMAT (exact headers):
## Executive Summary
(3-4 sentences: what happened, scale, top risk entity + score)

## Money Trail
(walk the victim → mule → cash-out chain hop by hop with amounts, timestamps, and evidence IDs)

## Key Linkages
(bullets: shared IMEI, shared IP with window, UPI/account reuse - each with confidence + EVD IDs)

## Risk Justification
(why the top score is what it is, mapping each indicator to evidence)

## What to Verify Next
(4-6 concrete prioritized steps: KYC, bank/UPI record preservation, device examination, IP corroboration, hash re-verification)

## Limitations
(2-3 bullets: what the data cannot prove, gaps, corroboration needed)`;

export type InsightInput = {
  caseId: string;
  caseTitle: string;
  result: AnalyzeResponse;
};

function compactResult(result: AnalyzeResponse) {
  return {
    summary: result.summary,
    transactionChain: result.transactionChain ?? [],
    topRisks: (result.riskResults ?? []).slice(0, 5),
    keyRelationships: (result.relationships ?? []).slice(0, 20),
    timeline: (result.timeline ?? []).slice(0, 20),
    investigativeLeads: result.investigativeLeads ?? [],
  };
}

export async function generateInsights(input: InsightInput): Promise<{ insight: string; model: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  const userPayload = JSON.stringify(
    {
      case_id: input.caseId,
      case_title: input.caseTitle,
      engine_output: compactResult(input.result),
    },
    null,
    1
  );

  let lastError = "";
  for (const model of candidateModels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1400,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Analyze this case using ONLY the engine output below. Follow the output format exactly.\n\n${userPayload}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Retired/renamed model → try next candidate
        if (res.status === 404 && text.includes("model")) {
          lastError = `model ${model} not found, trying fallback`;
          continue;
        }
        throw new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const insight = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!insight) throw new Error("Groq returned an empty response");
      return { insight, model };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`No working Groq model found. ${lastError}`);
}

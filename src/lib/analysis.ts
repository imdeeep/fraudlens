// Shared analysis orchestrator - used by /api/analyze (runs on server, no browser APIs)
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  Entity,
  NormalizedRecord,
} from "./types";
import { extractEntities, correlate } from "./correlation";
import { detectTransactionChain, scoreRisk, buildLeads } from "./risk";
import { buildTimeline } from "./timeline";

function mask(v?: string): string {
  // Never log full identifiers server-side (spec §22)
  if (!v) return "?";
  if (v.length <= 4) return "***";
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

export function analyzeCase(req: AnalyzeRequest): AnalyzeResponse {
  const records: NormalizedRecord[] = req.records ?? [];
  const entities: Entity[] = extractEntities(records);
  const relationships = correlate(records);
  const transactions = records.filter((r) => r.recordType === "transaction");
  const chain = detectTransactionChain(transactions);
  const riskResults = scoreRisk(entities, records, relationships, chain);
  const timeline = buildTimeline(records);
  const investigativeLeads = buildLeads(chain, relationships, riskResults);

  // Attach risk to entities (copy)
  const riskById = new Map(riskResults.map((r) => [r.entityId, r]));
  const entitiesWithRisk = entities.map((e) => {
    const rr = riskById.get(e.id);
    if (!rr) return e;
    return { ...e, riskScore: rr.score, riskBand: rr.band };
  });

  const highest = riskResults[0];
  // Minimal server log without PII
  console.log(
    `[analyze] case=${req.caseId} files=${req.evidence.length} entities=${entities.length} rels=${relationships.length} txns=${transactions.length} top=${highest?.score ?? 0} sample=${mask(transactions[0]?.senderAccount)}`
  );

  return {
    summary: {
      filesProcessed: req.evidence.length,
      entitiesExtracted: entities.length,
      relationshipsDetected: relationships.length,
      transactionsAnalysed: transactions.length,
      highestRiskScore: highest?.score ?? 0,
      highestRiskEntityId: highest?.entityId,
    },
    entities: entitiesWithRisk,
    relationships,
    transactions,
    timeline,
    riskResults,
    investigativeLeads,
    transactionChain: chain,
  };
}

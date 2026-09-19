// Report builders: JSON + manifest + one-page PDF brief (spec §16-17, client-side)
import { jsPDF } from "jspdf";
import type {
  AnalyzeResponse,
  EvidenceRecord,
} from "./types";

export function buildJsonReport(
  caseId: string,
  caseTitle: string,
  evidence: EvidenceRecord[],
  result: AnalyzeResponse
): object {
  return {
    case_id: caseId,
    case_title: caseTitle,
    generated_at: new Date().toISOString(),
    evidence,
    entities: result.entities,
    relationships: result.relationships,
    transactions: result.transactions,
    timeline: result.timeline,
    risk_results: result.riskResults,
    investigative_leads: result.investigativeLeads,
    transaction_chain: result.transactionChain,
    summary: result.summary,
    disclaimer: "Automated findings are investigative leads requiring officer verification.",
  };
}

export function buildManifest(
  caseId: string,
  evidence: EvidenceRecord[]
): object {
  return {
    case_id: caseId,
    generated_at: new Date().toISOString(),
    parser_version: evidence[0]?.parserVersion ?? "fraudlens-parser-v1.0.0",
    evidence: evidence.map((e) => ({
      evidence_id: e.evidenceId,
      file_name: e.fileName,
      file_type: e.fileType,
      file_size: e.fileSize,
      sha256: e.sha256,
      registered_at: e.registeredAt,
      status: e.status,
    })),
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generatePdfBrief(opts: {
  caseId: string;
  caseTitle: string;
  evidence: EvidenceRecord[];
  result: AnalyzeResponse;
}): void {
  const { caseId, caseTitle, evidence, result } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595;
  let y = 44;
  const line = (dy = 6) => {
    y += dy;
  };

  doc.setFillColor(1, 1, 2);
  doc.rect(0, 0, W, 800, "F");
  doc.setTextColor(247, 248, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`FraudLens AI - Investigative Brief`, 40, y);
  line(18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(208, 214, 224);
  doc.text(`${caseId} · ${caseTitle} · ${new Date().toISOString()}`, 40, y);
  line(16);

  const top = result.riskResults[0];
  doc.setTextColor(247, 248, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Executive summary", 40, y);
  line(14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(208, 214, 224);
  const summary =
    `Analysed ${result.summary.filesProcessed} files, ${result.summary.entitiesExtracted} entities, ` +
    `${result.summary.relationshipsDetected} links, ${result.summary.transactionsAnalysed} transactions. ` +
    `Highest risk ${result.summary.highestRiskScore} (${top?.band ?? "Low"}) on ${result.summary.highestRiskEntityId ?? "-"}. ` +
    `Chain: ${result.transactionChain.join(" -> ") || "-"}.`;
  const wrapped = doc.splitTextToSize(summary, W - 80);
  doc.text(wrapped, 40, y);
  y += wrapped.length * 12 + 8;

  const section = (title: string, body: string[]) => {
    doc.setTextColor(247, 248, 248);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 40, y);
    line(13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(208, 214, 224);
    for (const b of body) {
      const w = doc.splitTextToSize(`• ${b}`, W - 80);
      if (y + w.length * 11 > 800) break;
      doc.text(w, 40, y);
      y += w.length * 11 + 3;
    }
    line(6);
  };

  section("Highest-risk entities", result.riskResults.slice(0, 3).map((r) => `${r.entityId} - ${r.score} (${r.band}): ${r.indicators.map((i) => `${i.name}+${i.points}`).join(", ")}`));
  section("Key linked identifiers", [
    ...result.relationships.slice(0, 4).map((r) => `${r.sourceEntityId} ↔ ${r.targetEntityId} [${r.relationshipType}, conf ${r.confidence}]`),
    "Shared IP is contextual only - not proof of identity.",
  ]);
  section("Timeline (major)", result.timeline.slice(0, 6).map((t) => `${t.time} - ${t.description} [${t.evidenceId}]`));
  section("Follow-up recommendations", result.investigativeLeads.slice(0, 5));
  section("Evidence manifest", evidence.map((e) => `${e.evidenceId} ${e.fileName} SHA256:${e.sha256.slice(0, 16)}… ${e.status}`));

  doc.setFontSize(7.5);
  doc.setTextColor(138, 143, 152);
  doc.text(
    "Disclaimer: supports investigation only; does not establish guilt or court admissibility. Requires officer verification.",
    40,
    810
  );
  doc.save(`fraudlens-${caseId}-brief.pdf`);
}

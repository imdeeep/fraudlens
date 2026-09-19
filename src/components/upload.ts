"use client";
import type { EvidenceRecord, NormalizedRecord, ParseCounts } from "@/lib/types";
import { PARSER_VERSION } from "@/lib/types";
import { sha256Hex, evidenceIdFor } from "@/lib/hash";
import {
  parseCdrCsv,
  parseIpdrCsv,
  parseBankCsv,
  parseDeviceJson,
  detectFileKind,
} from "@/lib/parsers";

export type ParseReport = ParseCounts & { fileName: string; kind: string };

type UploadResult = {
  evidence: EvidenceRecord[];
  records: NormalizedRecord[];
  reports: ParseReport[];
  errors: string[];
};

const te = new TextEncoder();

export async function processFiles(files: File[], startIndex: number): Promise<UploadResult> {
  const evidence: EvidenceRecord[] = [];
  const records: NormalizedRecord[] = [];
  const reports: ParseReport[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const idx = startIndex + i;
    const evId = evidenceIdFor(idx);
    try {
      if (file.size > 4_500_000) {
        errors.push(`${file.name}: file too large (>4.5MB). Keep POC files small.`);
        evidence.push({
          evidenceId: evId,
          fileName: file.name,
          fileType: file.type || "unknown",
          fileSize: file.size,
          sha256: "oversize-skipped",
          registeredAt: new Date().toISOString(),
          parserVersion: PARSER_VERSION,
          status: "failed",
        });
        reports.push({ fileName: file.name, kind: "unknown", accepted: 0, rejected: 0, skipped: 0, errors: ["oversize"] });
        continue;
      }
      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf.slice(0));
      const text = new TextDecoder().decode(buf);
      const kind = detectFileKind(file.name, text);
      let parsed = { records: [] as NormalizedRecord[], counts: { accepted: 0, rejected: 0, skipped: 0, errors: [] as string[] } };
      const ftype = file.name.toLowerCase().endsWith(".json") ? "device/json" : "csv";
      if (kind === "cdr") parsed = parseCdrCsv(text, evId, file.name);
      else if (kind === "ipdr") parsed = parseIpdrCsv(text, evId, file.name);
      else if (kind === "bank") parsed = parseBankCsv(text, evId, file.name);
      else if (kind === "device") parsed = parseDeviceJson(text, evId, file.name);
      else {
        errors.push(`${file.name}: unsupported file type. Expected CDR/IPDR/bank CSV or device JSON.`);
        evidence.push({
          evidenceId: evId,
          fileName: file.name,
          fileType: file.type || "unknown",
          fileSize: file.size,
          sha256: hash,
          registeredAt: new Date().toISOString(),
          parserVersion: PARSER_VERSION,
          status: "failed",
        });
        reports.push({ fileName: file.name, kind: "unknown", accepted: 0, rejected: 1, skipped: 0, errors: ["unsupported type"] });
        continue;
      }
      evidence.push({
        evidenceId: evId,
        fileName: file.name,
        fileType: ftype,
        fileSize: file.size,
        sha256: hash,
        registeredAt: new Date().toISOString(),
        parserVersion: PARSER_VERSION,
        status: "verified",
      });
      records.push(...parsed.records);
      reports.push({ fileName: file.name, kind, ...parsed.counts });
      for (const e of parsed.counts.errors) errors.push(`${file.name}: ${e}`);
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "read failed"}`);
      evidence.push({
        evidenceId: evId,
        fileName: file.name,
        fileType: "unknown",
        fileSize: file.size,
        sha256: "error",
        registeredAt: new Date().toISOString(),
        parserVersion: PARSER_VERSION,
        status: "failed",
      });
    }
  }
  void te;
  return { evidence, records, reports, errors };
}

export async function processDemoStrings(
  items: { fileName: string; fileType: string; text: string }[],
  startIndex: number
): Promise<UploadResult> {
  const files = items.map(
    (it) => new File([it.text], it.fileName, { type: it.fileType })
  );
  return processFiles(files, startIndex);
}

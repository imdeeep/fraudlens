// Parsers + normalizers (spec §6, §8, §21). Runs in browser; shared shapes with server.
import Papa from "papaparse";
import type { NormalizedRecord, ParseCounts } from "./types";

export function normalizePhone(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  // Remove spaces, hyphens, parentheses. Preserve leading + and country code.
  const cleaned = s.replace(/[\s\-()]/g, "");
  return cleaned || undefined;
}

export function normalizeTimestamp(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const d = new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function parseAmount(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export type ParsedFile = {
  records: NormalizedRecord[];
  counts: ParseCounts;
};

function emptyCounts(): ParseCounts {
  return { accepted: 0, rejected: 0, skipped: 0, errors: [] };
}

function requireColumns(
  row: Record<string, string>,
  required: string[],
  rowNum: number,
  counts: ParseCounts
): boolean {
  const missing = required.filter((c) => !(c in row) || row[c] === undefined || row[c] === "");
  if (missing.length > 0) {
    counts.rejected += 1;
    counts.errors.push(`Row ${rowNum}: missing required column(s): ${missing.join(", ")}`);
    return false;
  }
  return true;
}

export function parseCdrCsv(
  text: string,
  evidenceId: string,
  sourceFile: string
): ParsedFile {
  const counts = emptyCounts();
  const records: NormalizedRecord[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    counts.errors.push(`CSV parse error: ${parsed.errors[0].message}`);
  }
  const seenCallIds = new Set<string>();
  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row || Object.values(row).every((v) => v === "" || v === undefined)) {
      counts.skipped += 1;
      return;
    }
    if (
      !requireColumns(
        row,
        ["call_id", "phone_number", "timestamp", "imei", "imsi"],
        rowNum,
        counts
      )
    )
      return;
    const ts = normalizeTimestamp(row["timestamp"]);
    if (!ts) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: unparseable timestamp '${row["timestamp"]}'`);
      return;
    }
    const phone = normalizePhone(row["phone_number"]);
    if (!phone) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: invalid phone_number`);
      return;
    }
    const callId = asString(row["call_id"]) ?? `C-ROW${rowNum}`;
    if (seenCallIds.has(callId)) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: duplicate call_id '${callId}'`);
      return;
    }
    seenCallIds.add(callId);
    records.push({
      recordType: "call",
      timestamp: ts,
      phoneNumber: phone,
      otherParty: normalizePhone(row["other_party"]),
      imei: asString(row["imei"]),
      imsi: asString(row["imsi"]),
      evidenceId,
      sourceFile,
      sourceRow: rowNum,
    });
    counts.accepted += 1;
  });
  return { records, counts };
}

export function parseIpdrCsv(
  text: string,
  evidenceId: string,
  sourceFile: string
): ParsedFile {
  const counts = emptyCounts();
  const records: NormalizedRecord[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row || Object.values(row).every((v) => v === "" || v === undefined)) {
      counts.skipped += 1;
      return;
    }
    if (
      !requireColumns(row, ["session_id", "phone_number", "ip_address", "start_time"], rowNum, counts)
    )
      return;
    const start = normalizeTimestamp(row["start_time"]);
    if (!start) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: unparseable start_time '${row["start_time"]}'`);
      return;
    }
    const end = row["end_time"] ? normalizeTimestamp(row["end_time"]) : undefined;
    if (row["end_time"] && !end) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: unparseable end_time '${row["end_time"]}'`);
      return;
    }
    const phone = normalizePhone(row["phone_number"]);
    const ip = asString(row["ip_address"]);
    if (!phone || !ip) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: invalid phone_number or ip_address`);
      return;
    }
    records.push({
      recordType: "ip_session",
      timestamp: start,
      endTimestamp: end,
      phoneNumber: phone,
      ipAddress: ip,
      evidenceId,
      sourceFile,
      sourceRow: rowNum,
    });
    counts.accepted += 1;
  });
  return { records, counts };
}

export function parseBankCsv(
  text: string,
  evidenceId: string,
  sourceFile: string
): ParsedFile {
  const counts = emptyCounts();
  const records: NormalizedRecord[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const seenTxn = new Set<string>();
  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row || Object.values(row).every((v) => v === "" || v === undefined)) {
      counts.skipped += 1;
      return;
    }
    if (
      !requireColumns(
        row,
        ["transaction_id", "timestamp", "sender_account", "receiver_account", "amount"],
        rowNum,
        counts
      )
    )
      return;
    const txnId = asString(row["transaction_id"])!;
    if (seenTxn.has(txnId)) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: duplicate transaction_id '${txnId}'`);
      return;
    }
    seenTxn.add(txnId);
    const ts = normalizeTimestamp(row["timestamp"]);
    if (!ts) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: unparseable timestamp '${row["timestamp"]}'`);
      return;
    }
    const amount = parseAmount(row["amount"]);
    if (amount === undefined) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: invalid transaction amount '${row["amount"]}'`);
      return;
    }
    records.push({
      recordType: "transaction",
      timestamp: ts,
      transactionId: txnId,
      senderAccount: asString(row["sender_account"]),
      receiverAccount: asString(row["receiver_account"]),
      senderUpi: asString(row["sender_upi"]),
      receiverUpi: asString(row["receiver_upi"]),
      amount,
      currency: asString(row["currency"]) ?? "INR",
      evidenceId,
      sourceFile,
      sourceRow: rowNum,
    });
    counts.accepted += 1;
  });
  return { records, counts };
}

export type DeviceJsonRow = {
  phone_number?: string;
  imei?: string;
  imsi?: string;
  mac_address?: string;
  device_model?: string;
  installed_apps?: string[];
};

export function parseDeviceJson(
  text: string,
  evidenceId: string,
  sourceFile: string
): ParsedFile {
  const counts = emptyCounts();
  const records: NormalizedRecord[] = [];
  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    counts.rejected += 1;
    counts.errors.push("device.json: invalid JSON");
    return { records, counts };
  }
  if (!Array.isArray(arr)) {
    counts.rejected += 1;
    counts.errors.push("device.json: top-level JSON must be an array");
    return { records, counts };
  }
  (arr as DeviceJsonRow[]).forEach((row, i) => {
    const rowNum = i + 1;
    if (!row || typeof row !== "object") {
      counts.skipped += 1;
      return;
    }
    const phone = normalizePhone(row.phone_number);
    const imei = asString(row.imei);
    if (!phone && !imei) {
      counts.rejected += 1;
      counts.errors.push(`Row ${rowNum}: device record needs phone_number and/or imei`);
      return;
    }
    records.push({
      recordType: "device",
      phoneNumber: phone,
      imei,
      imsi: asString(row.imsi),
      macAddress: asString(row.mac_address),
      evidenceId,
      sourceFile,
      sourceRow: rowNum,
    });
    counts.accepted += 1;
  });
  return { records, counts };
}

export function detectFileKind(fileName: string, textHead: string): "cdr" | "ipdr" | "bank" | "device" | "unknown" {
  const name = fileName.toLowerCase();
  if (name.includes("cdr") && !name.includes("ipdr")) return "cdr";
  if (name.includes("ipdr")) return "ipdr";
  if (name.includes("bank") || name.includes("txn") || name.includes("transaction")) return "bank";
  if (name.endsWith(".json")) {
    try {
      const v = JSON.parse(textHead.slice(0, 2000));
      if (Array.isArray(v) && v[0] && (v[0].imei || v[0].phone_number)) return "device";
    } catch {
      /* fallthrough */
    }
    return "device";
  }
  const head = textHead.slice(0, 1000).toLowerCase();
  if (head.includes("call_id") || head.includes("other_party")) return "cdr";
  if (head.includes("session_id") || head.includes("ip_address")) return "ipdr";
  if (head.includes("transaction_id") || head.includes("sender_account")) return "bank";
  return "unknown";
}

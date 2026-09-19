// Handoff between the case-setup page (/) and the dashboard route (/dashboard).
// Normalized records are small (browser already hashed + parsed raw files),
// so sessionStorage easily holds POC-scale cases. Never put the API key here.
import type { EvidenceRecord, NormalizedRecord } from "./types";

export type StoredCase = {
  caseId: string;
  caseTitle: string;
  evidence: EvidenceRecord[];
  records: NormalizedRecord[];
  savedAt: string;
};

const KEY = "fraudlens-case-v1";

export function saveCase(c: Omit<StoredCase, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredCase = { ...c, savedAt: new Date().toISOString() };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    throw new Error(
      "Case is too large to hand off to the dashboard (browser storage full). Try smaller files or fewer rows."
    );
  }
}

export function loadCase(): StoredCase | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCase;
    if (!parsed || !Array.isArray(parsed.records) || !Array.isArray(parsed.evidence)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCase(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

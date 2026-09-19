// FraudLens AI - shared types (spec §7-11,19)
export type EvidenceRecord = {
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  sha256: string;
  registeredAt: string;
  parserVersion: string;
  status: "verified" | "failed";
};

export type NormalizedRecord = {
  recordType: "call" | "ip_session" | "transaction" | "device";
  timestamp?: string;
  endTimestamp?: string;
  phoneNumber?: string;
  otherParty?: string;
  imei?: string;
  imsi?: string;
  macAddress?: string;
  ipAddress?: string;
  bankAccount?: string;
  senderAccount?: string;
  receiverAccount?: string;
  upiId?: string;
  senderUpi?: string;
  receiverUpi?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  evidenceId: string;
  sourceFile: string;
  sourceRow?: number;
};

export type EntityType =
  | "person_or_party"
  | "phone"
  | "imei"
  | "imsi"
  | "device"
  | "ip"
  | "bank_account"
  | "upi"
  | "transaction";

export type Entity = {
  id: string;
  type: EntityType;
  label: string;
  riskScore?: number;
  riskBand?: "Low" | "Medium" | "High" | "Critical";
};

export type Relationship = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  confidence: number;
  evidenceIds: string[];
  sourceReferences: string[];
  timestamp?: string;
  amount?: number;
  direction?: "inbound" | "outbound" | "association";
};

export type RiskIndicator = {
  name: string;
  points: number;
  explanation: string;
};

export type RiskResult = {
  entityId: string;
  score: number;
  band: "Low" | "Medium" | "High" | "Critical";
  indicators: RiskIndicator[];
};

export type TimelineEvent = {
  time: string;
  eventType: string;
  description: string;
  entityOrTransaction: string;
  amount?: number;
  evidenceId: string;
};

export type AnalyzeRequest = {
  caseId: string;
  evidence: EvidenceRecord[];
  records: NormalizedRecord[];
};

export type AnalyzeResponse = {
  summary: {
    filesProcessed: number;
    entitiesExtracted: number;
    relationshipsDetected: number;
    transactionsAnalysed: number;
    highestRiskScore: number;
    highestRiskEntityId?: string;
  };
  entities: Entity[];
  relationships: Relationship[];
  transactions: NormalizedRecord[];
  timeline: TimelineEvent[];
  riskResults: RiskResult[];
  investigativeLeads: string[];
  transactionChain: string[];
};

export type ParseCounts = {
  accepted: number;
  rejected: number;
  skipped: number;
  errors: string[];
};

export const PARSER_VERSION = "fraudlens-parser-v1.0.0";

export function riskBandFor(score: number): RiskResult["band"] {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

# FraudLens AI
## Hackathon POC Build Specification for OpenCode

## 1. Purpose

Build a working web-based proof of concept for **FraudLens AI**, an AI-assisted unified cyber fraud analysis and digital artifact correlator.

The POC must demonstrate one complete investigation workflow using synthetic evidence:

```text
Upload evidence → Hash and register → Parse and normalize → Extract entities → Correlate links → Score risk → Show graph and timeline → Export report
```

This is a screening-round prototype, not a production forensic platform. Do not build live bank, telecom, police, or UPI integrations. Do not use real personal data. Do not claim that the generated report is automatically court-admissible.

## 2. Recommended Architecture

Use one Next.js application deployed to Vercel.

```text
Browser upload
    ↓
Browser-side SHA-256 hashing and parsing
    ↓
Normalized JSON sent to Next.js Route Handler
    ↓
Entity correlation and risk scoring
    ↓
Graph, timeline, findings, and report shown in the browser
```

### Why browser-side processing is required

The application should calculate hashes and parse small synthetic files in the browser. This reduces serverless payload and execution risk. Vercel Functions currently have a 4.5 MB request and response body limit, so the application must not depend on sending large raw files through a single API request.

The deployed Vercel version is an online demonstration. Keep the core analysis modules independent so they can later run locally for an offline deployment.

## 3. Technology Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Papa Parse for CSV files
- SheetJS only if Excel support is required
- Browser Web Crypto API for SHA-256
- Cytoscape.js for the investigation graph
- Recharts or native CSS for summary indicators, if needed
- jsPDF or `@react-pdf/renderer` for the PDF brief
- Next.js Route Handlers for backend logic
- Vercel for deployment

Avoid Python, FastAPI, a separate database, authentication, and external AI APIs in the first version. The core scoring engine should be deterministic and explainable.

## 4. POC Scope

### Must have

1. Upload mock CDR, IPDR, bank transaction, and device JSON files.
2. Calculate a reproducible SHA-256 hash for every file.
3. Assign an Evidence ID to each file.
4. Parse and normalize records into a common schema.
5. Extract phone numbers, IMEIs, IMSIs, IP addresses, bank accounts, UPI IDs, transaction IDs, and timestamps.
6. Detect at least one strong cross-source relationship.
7. Reconstruct the victim-to-mule-to-cash-out transaction chain.
8. Calculate an explainable 0–100 risk score.
9. Display a graph and chronological timeline.
10. Export a JSON report and a one-page PDF brief.

### Out of scope

- Live financial, telecom, police, or UPI integrations
- Real personal data
- Full APK reverse engineering or malware analysis
- Machine-learning model training
- Production authentication and multi-tenancy
- Automatic legal conclusions or automatic suspect identification

## 5. Synthetic Investigation Scenario

Create one coherent mock case called **CASE-001: Rapid Mule Account Routing**.

The case should show:

```text
Victim Account VICTIM-001
        ↓ ₹48,500
Mule Account MULE-001
        ↓ ₹47,000 within 8 minutes
Mule Account MULE-002
        ↓ ₹45,000 within 6 minutes
Cash-out Account CASHOUT-001
```

Telecom and device records should show that `+91-9000000001` and `+91-9000000002` used the same IMEI `356789012345678`.

IPDR records should show a shared IP address within a close time window. The shared IP must be labelled as a contextual signal, not proof of identity.

## 6. Input File Schemas

### `cdr.csv`

```csv
call_id,phone_number,other_party,timestamp,direction,duration_seconds,imei,imsi
C001,+919000000001,+919111111111,2026-09-18T10:01:00Z,OUTGOING,42,356789012345678,404010123456789
C002,+919000000002,+919111111111,2026-09-18T10:05:00Z,OUTGOING,31,356789012345678,404010987654321
```

### `ipdr.csv`

```csv
session_id,phone_number,ip_address,start_time,end_time,source_port,destination_ip
I001,+919000000001,103.21.45.10,2026-09-18T10:02:00Z,2026-09-18T10:12:00Z,51231,198.51.100.20
I002,+919000000002,103.21.45.10,2026-09-18T10:04:00Z,2026-09-18T10:14:00Z,51232,198.51.100.20
```

### `bank_transactions.csv`

```csv
transaction_id,timestamp,sender_account,receiver_account,sender_upi,receiver_upi,amount,currency,transaction_type,status
T001,2026-09-18T10:15:00Z,VICTIM-001,MULE-001,victim@upi,mulea@upi,48500,INR,UPI,CAPTURED
T002,2026-09-18T10:23:00Z,MULE-001,MULE-002,mulea@upi,muleb@upi,47000,INR,UPI,CAPTURED
T003,2026-09-18T10:29:00Z,MULE-002,CASHOUT-001,muleb@upi,cashout@upi,45000,INR,UPI,CAPTURED
```

### `device.json`

```json
[
  {
    "phone_number": "+919000000001",
    "imei": "356789012345678",
    "imsi": "404010123456789",
    "mac_address": "AA:BB:CC:11:22:33",
    "device_model": "Android-X1",
    "installed_apps": ["com.example.wallet", "com.example.remote"]
  },
  {
    "phone_number": "+919000000002",
    "imei": "356789012345678",
    "imsi": "404010987654321",
    "mac_address": "AA:BB:CC:44:55:66",
    "device_model": "Android-X1",
    "installed_apps": ["com.example.wallet"]
  }
]
```

## 7. Evidence Registration

When a file is selected:

1. Read it as an `ArrayBuffer`.
2. Calculate SHA-256 using `crypto.subtle.digest("SHA-256", buffer)`.
3. Convert the digest to lowercase hexadecimal.
4. Assign an Evidence ID such as `EVD001`.
5. Preserve the original file in browser memory for the current session.
6. Display filename, type, size, Evidence ID, hash, timestamp, and status.

Evidence record:

```ts
type EvidenceRecord = {
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  sha256: string;
  registeredAt: string;
  parserVersion: string;
  status: "verified" | "failed";
};
```

## 8. Common Normalized Schema

Normalize all sources into records that can be correlated consistently.

```ts
type NormalizedRecord = {
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
```

Normalize phone numbers by removing spaces, hyphens, and parentheses. Preserve the country code. Normalize timestamps to ISO 8601. Treat identifiers as strings so leading zeroes are not lost.

## 9. Entity Model

Create entities with stable IDs:

```ts
type EntityType =
  | "person_or_party"
  | "phone"
  | "imei"
  | "imsi"
  | "device"
  | "ip"
  | "bank_account"
  | "upi"
  | "transaction";

type Entity = {
  id: string;
  type: EntityType;
  label: string;
  riskScore?: number;
  riskBand?: "Low" | "Medium" | "High" | "Critical";
};
```

## 10. Correlation Rules

### Strong relationships

- Same IMEI across phone numbers: confidence `1.00`
- Same IMSI across records: confidence `1.00`
- Same bank account: confidence `1.00`
- Same UPI ID: confidence `1.00`
- Same transaction ID: confidence `1.00`

### Contextual relationships

- Same IP and overlapping or nearby timestamps: confidence `0.75`
- Same IP without time support: confidence `0.30`
- Same device model only: confidence `0.10`

Never present a shared IP alone as proof that two entities belong to the same person.

```ts
type Relationship = {
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
```

## 11. Risk Scoring

Apply these configurable indicators:

| Indicator | Points |
|---|---:|
| Shared IMEI | 25 |
| Multiple victims linked to one account | 20 |
| Rapid fund movement | 20 |
| Multi-hop transaction chain | 20 |
| Shared IP with close time window | 10 |
| Rapid SIM switching | 15 |

Cap the final score at 100.

Risk bands:

- 0–29: Low
- 30–59: Medium
- 60–79: High
- 80–100: Critical

Each score must return human-readable reasons:

```ts
type RiskResult = {
  entityId: string;
  score: number;
  band: "Low" | "Medium" | "High" | "Critical";
  indicators: { name: string; points: number; explanation: string }[];
};
```

## 12. Transaction Chain Detection

Use transaction timestamps and sender/receiver account IDs to identify directed paths. For the mock case, detect:

```text
VICTIM-001 → MULE-001 → MULE-002 → CASHOUT-001
```

Flag these patterns:

- Transfer to another account within 30 minutes
- More than one hop from the victim
- Amount decreases slightly at each hop
- Repeated beneficiary or UPI destination
- Multiple incoming victim transfers to one account

## 13. User Interface

### Page 1: Case setup and upload

- Case name and case ID
- Four upload controls
- Supported file types
- Analyze button
- Synthetic demo data button

### Page 2: Evidence verification

Show a table with:

```text
Evidence ID | File | Type | SHA-256 | Parser | Status
```

### Page 3: Investigation dashboard

Show:

- Files processed
- Entities extracted
- Relationships detected
- Transactions analysed
- Highest risk score
- Highest-risk entity
- Network graph
- Risk explanation panel
- Timeline

### Page 4: Export

- Download JSON report
- Download PDF investigative brief
- Download evidence manifest

## 14. Graph Design

Use Cytoscape.js.

Node colours:

- Victim: blue
- Phone or device: violet
- Bank account or UPI: purple
- IP address: cyan
- Mule account: orange
- High-risk entity: red
- Cash-out point: dark red

Edge styles:

- Transaction: thick directional arrow
- Shared identifier: solid association line
- Contextual IP link: dashed line

Clicking a node should show its type, label, risk score, linked entities, and supporting Evidence IDs.

## 15. Timeline

Sort events by timestamp and show:

- Event time
- Event type
- Description
- Entity or transaction involved
- Amount, when applicable
- Evidence ID

Example events:

```text
10:01  Call from phone +919000000001
10:05  Second phone uses same IMEI
10:15  Victim sends ₹48,500 to MULE-001
10:23  MULE-001 sends ₹47,000 to MULE-002
10:29  MULE-002 sends ₹45,000 to CASHOUT-001
```

## 16. JSON Output

The JSON export should contain:

```json
{
  "case_id": "CASE-001",
  "case_title": "Rapid Mule Account Routing",
  "generated_at": "ISO_TIMESTAMP",
  "evidence": [],
  "entities": [],
  "relationships": [],
  "transactions": [],
  "timeline": [],
  "risk_results": [],
  "investigative_leads": [],
  "disclaimer": "Automated findings are investigative leads requiring officer verification."
}
```

## 17. PDF Brief

Generate a one-page report with:

- Case ID and generated timestamp
- Executive summary
- Overall risk band
- Highest-risk entities
- Victim-to-cash-out transaction chain
- Key linked identifiers
- Timeline of major events
- Risk-score reasons
- Evidence manifest summary
- Immediate follow-up recommendations
- Disclaimer that the report supports investigation and does not by itself establish guilt or legal admissibility

## 18. Suggested Follow-up Recommendations

Generate recommendations based on detected indicators:

- Verify subscriber and KYC details for linked phone numbers.
- Request or preserve relevant bank and UPI account records.
- Investigate the shared-device relationship across phone numbers.
- Review the rapid transaction chain and beneficiary history.
- Preserve original evidence and verify hashes before further handling.
- Treat shared IP evidence as contextual unless independently corroborated.

## 19. API Contract

Create a route handler at `/api/analyze`.

### Request

```ts
{
  caseId: string;
  evidence: EvidenceRecord[];
  records: NormalizedRecord[];
}
```

### Response

```ts
{
  summary: {
    filesProcessed: number;
    entitiesExtracted: number;
    relationshipsDetected: number;
    transactionsAnalysed: number;
    highestRiskScore: number;
  };
  entities: Entity[];
  relationships: Relationship[];
  transactions: NormalizedRecord[];
  timeline: unknown[];
  riskResults: RiskResult[];
  investigativeLeads: string[];
}
```

## 20. Demo Mode

Include a **Load Demo Case** button. It should load the synthetic files or equivalent in-memory records and run the complete workflow immediately.

The demo should always produce:

- At least one shared-IMEI relationship
- At least one contextual IP relationship
- One three-hop transaction chain
- One high or critical risk entity
- A visible timeline
- A downloadable JSON report
- A downloadable PDF brief

## 21. Error Handling

Show clear messages when:

- A required column is missing
- A timestamp cannot be parsed
- A file type is unsupported
- A transaction amount is invalid
- A duplicate transaction ID is found
- The request is too large
- Analysis fails

Do not silently drop malformed rows. Show the number of accepted, rejected, and skipped rows.

## 22. Security and Privacy Rules

- Use only synthetic data in the deployed demonstration.
- Do not log full phone numbers, account numbers, or file contents to server logs.
- Do not permanently store uploaded evidence for the screening POC.
- Do not send evidence to external AI services.
- Display a clear notice that results require officer verification.
- Keep the original evidence separate from normalized working data.

## 23. Acceptance Criteria

The POC is complete when:

1. A user can load the demo case or upload the four supported files.
2. Every file receives a SHA-256 hash and Evidence ID.
3. The system detects the shared IMEI.
4. The system detects the contextual IP relationship without treating it as conclusive.
5. The system reconstructs the victim-to-mule-to-cash-out chain.
6. The system produces an explainable risk score.
7. The graph clearly shows directional money movement.
8. The timeline is chronological and readable.
9. JSON and PDF exports work.
10. The application deploys successfully to Vercel.

## 24. Demo Video Sequence

Keep the demonstration under three minutes:

```text
0:00–0:20  Explain the fragmented-evidence problem
0:20–0:40  Load the demo case or upload files
0:40–1:00  Show SHA-256 hashes and Evidence IDs
1:00–1:25  Show extracted entities and detected links
1:25–1:55  Show the transaction network graph
1:55–2:20  Show risk score and reasons
2:20–2:45  Show timeline and evidence references
2:45–3:00  Export the PDF and JSON brief
```

## 25. Final instruction to OpenCode

Build the smallest polished end-to-end POC that satisfies the acceptance criteria. Prioritize a reliable demo flow, clear investigator-facing visuals, deterministic rules, evidence traceability, and readable output. Use mock data and make every major function visible in the interface. Do not add unnecessary production infrastructure before the complete demo workflow works.

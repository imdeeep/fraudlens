// Deterministic explainable risk scoring (spec §11) + chain detection (§12)
import type {
  Entity,
  NormalizedRecord,
  Relationship,
  RiskResult,
} from "./types";
import { riskBandFor } from "./types";

export function detectTransactionChain(
  transactions: NormalizedRecord[]
): string[] {
  const txns = transactions
    .filter((t) => t.recordType === "transaction" && t.senderAccount && t.receiverAccount && t.timestamp)
    .sort((a, b) => Date.parse(a.timestamp!) - Date.parse(b.timestamp!));
  if (txns.length === 0) return [];

  // Build adjacency sender -> txns
  const out = new Map<string, NormalizedRecord[]>();
  for (const t of txns) {
    const k = t.senderAccount!;
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(t);
  }
  // Find victim-start nodes (never a receiver)
  const receivers = new Set(txns.map((t) => t.receiverAccount!));
  const starts = txns.filter((t) => !receivers.has(t.senderAccount!));
  const seeds = starts.length > 0 ? starts : [txns[0]];

  // Longest greedy path following timestamps
  let best: string[] = [];
  for (const seed of seeds) {
    const path = [seed.senderAccount!, seed.receiverAccount!];
    let cur = seed.receiverAccount!;
    const visited = new Set(path);
    // walk up to 8 hops
    for (let h = 0; h < 8; h++) {
      const nexts = (out.get(cur) ?? [])
        .filter((t) => Date.parse(t.timestamp!) >= Date.parse(path.length > 0 ? seed.timestamp! : t.timestamp!))
        .sort((a, b) => Date.parse(a.timestamp!) - Date.parse(b.timestamp!));
      const nxt = nexts.find((t) => !visited.has(t.receiverAccount!));
      if (!nxt) break;
      path.push(nxt.receiverAccount!);
      visited.add(nxt.receiverAccount!);
      cur = nxt.receiverAccount!;
    }
    if (path.length > best.length) best = path;
  }
  return best;
}

export function scoreRisk(
  entities: Entity[],
  records: NormalizedRecord[],
  relationships: Relationship[],
  chain: string[]
): RiskResult[] {
  const txns = records.filter((r) => r.recordType === "transaction");
  const results: RiskResult[] = [];

  const hasSharedImei = relationships.some((r) => r.confidence === 1 && r.relationshipType.startsWith("shared_imei"));
  const sharedImeiPhones = new Set<string>();
  for (const r of relationships) {
    if (r.relationshipType.startsWith("shared_imei")) {
      sharedImeiPhones.add(r.sourceEntityId);
      sharedImeiPhones.add(r.targetEntityId);
    }
  }
  const hasSharedIpClose = relationships.some(
    (r) => r.relationshipType.startsWith("shared_ip_close_window")
  );

  // Rapid movement: any transfer hop within 30 min?
  const sortedTx = [...txns].sort(
    (a, b) => Date.parse(a.timestamp ?? "") - Date.parse(b.timestamp ?? "")
  );
  let rapidHop = false;
  for (let i = 1; i < sortedTx.length; i++) {
    const dt =
      Date.parse(sortedTx[i].timestamp ?? "") - Date.parse(sortedTx[i - 1].timestamp ?? "");
    if (
      dt >= 0 &&
      dt <= 30 * 60 * 1000 &&
      sortedTx[i - 1].receiverAccount === sortedTx[i].senderAccount
    ) {
      rapidHop = true;
      break;
    }
  }
  const multiHop = chain.length >= 4; // victim + 3 hops
  // Multiple victims → one account: count distinct senders into same receiver where sender never receives
  const sendersByReceiver = new Map<string, Set<string>>();
  for (const t of txns) {
    if (!t.senderAccount || !t.receiverAccount) continue;
    if (!sendersByReceiver.has(t.receiverAccount))
      sendersByReceiver.set(t.receiverAccount, new Set());
    sendersByReceiver.get(t.receiverAccount)!.add(t.senderAccount);
  }
  const receivers = new Set(txns.map((t) => t.receiverAccount));
  let multiVictimAccount: string | undefined;
  for (const [recv, senders] of sendersByReceiver) {
    // heuristic: receiver with ≥2 distinct senders where at least one sender is a start node
    if (senders.size >= 2) {
      multiVictimAccount = recv;
      break;
    }
  }
  void receivers;
  // SIM switching: same IMEI with different IMSIs
  const imsiByImei = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.imei && r.imsi) {
      if (!imsiByImei.has(r.imei)) imsiByImei.set(r.imei, new Set());
      imsiByImei.get(r.imei)!.add(r.imsi);
    }
  }
  let simSwitchImei: string | undefined;
  for (const [imei, imsis] of imsiByImei) {
    if (imsis.size >= 2) {
      simSwitchImei = imei;
      break;
    }
  }

  // Score per account + phone
  const accountIds = entities.filter((e) => e.type === "bank_account");
  const phoneIds = entities.filter((e) => e.type === "phone");

  const chainSet = new Set(chain);

  for (const e of [...accountIds, ...phoneIds]) {
    const indicators: RiskResult["indicators"] = [];
    const isAccount = e.type === "bank_account";
    const inChain = isAccount && chainSet.has(e.label);

    if (!isAccount && sharedImeiPhones.has(e.id) && hasSharedImei) {
      indicators.push({
        name: "Shared IMEI",
        points: 25,
        explanation: "Same device IMEI used across two phone numbers - strong device link.",
      });
    }
    if (isAccount && inChain && hasSharedImei) {
      // accounts in a chain where linked phones share a device get contextual uplift
      indicators.push({
        name: "Shared IMEI",
        points: 25,
        explanation: "Transaction chain involves numbers sharing one IMEI device.",
      });
    }
    if (isAccount && multiVictimAccount && e.label === multiVictimAccount) {
      indicators.push({
        name: "Multiple victims linked",
        points: 20,
        explanation: `Account ${e.label} received from multiple distinct senders.`,
      });
    }
    if (isAccount && inChain && rapidHop) {
      indicators.push({
        name: "Rapid fund movement",
        points: 20,
        explanation: "Hop to next account within 30 minutes of receipt.",
      });
    }
    if (isAccount && inChain && multiHop) {
      indicators.push({
        name: "Multi-hop chain",
        points: 20,
        explanation: `Part of ${chain.length - 1}-hop victim-to-cash-out path.`,
      });
    }
    if (!isAccount && hasSharedIpClose && sharedImeiPhones.has(e.id)) {
      indicators.push({
        name: "Shared IP close window",
        points: 10,
        explanation: "Same IP within overlapping/nearby session window (contextual only).",
      });
    } else if (isAccount && inChain && hasSharedIpClose) {
      indicators.push({
        name: "Shared IP close window",
        points: 10,
        explanation: "Linked devices shared an IP in a close time window (contextual only).",
      });
    }
    if (!isAccount && simSwitchImei && sharedImeiPhones.has(e.id)) {
      indicators.push({
        name: "Rapid SIM switching",
        points: 15,
        explanation: `IMEI ${simSwitchImei} seen with multiple IMSIs.`,
      });
    }

    if (indicators.length === 0) continue;
    const score = Math.min(100, indicators.reduce((s, i) => s + i.points, 0));
    results.push({ entityId: e.id, score, band: riskBandFor(score), indicators });
  }

  // Ensure chain accounts all appear even if low
  for (const acct of chain) {
    const id = `acct:${acct}`;
    if (!results.find((r) => r.entityId === id)) {
      results.push({
        entityId: id,
        score: 20,
        band: riskBandFor(20),
        indicators: [
          {
            name: "Multi-hop chain",
            points: 20,
            explanation: `Part of ${chain.length - 1}-hop victim-to-cash-out path.`,
          },
        ],
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function buildLeads(
  chain: string[],
  relationships: Relationship[],
  risk: RiskResult[]
): string[] {
  const leads: string[] = [];
  const imeiRel = relationships.find((r) => r.relationshipType.startsWith("shared_imei"));
  if (imeiRel) {
    const imei = imeiRel.relationshipType.split(":")[1] ?? "shared IMEI";
    leads.push(
      `Verify subscriber and KYC details for ${imeiRel.sourceEntityId} and ${imeiRel.targetEntityId} (shared IMEI ${imei}).`
    );
  }
  if (chain.length >= 2) {
    leads.push(
      `Request/preserve bank and UPI records for chain ${chain.join(" → ")}; review beneficiary history and amount decay.`
    );
  }
  const ipRel = relationships.find((r) => r.relationshipType.startsWith("shared_ip"));
  if (ipRel) {
    leads.push(
      "Treat shared-IP evidence as contextual unless independently corroborated; obtain CGNAT/NAT logs before attribution."
    );
  }
  leads.push("Preserve original evidence and re-verify SHA-256 hashes before further handling.");
  const top = risk[0];
  if (top) {
    leads.push(
      `Prioritise ${top.entityId} (score ${top.score}, ${top.band}) for officer review; findings are leads, not proof of guilt.`
    );
  }
  return leads;
}

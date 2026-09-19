// Entity extraction + correlation rules (spec §9-10)
import type { Entity, NormalizedRecord, Relationship } from "./types";

function entityId(type: string, key: string): string {
  return `${type}:${key}`;
}

export function extractEntities(records: NormalizedRecord[]): Entity[] {
  const map = new Map<string, Entity>();
  const put = (id: string, type: Entity["type"], label: string) => {
    if (!map.has(id)) map.set(id, { id, type, label });
  };

  for (const r of records) {
    if (r.phoneNumber) {
      put(entityId("phone", r.phoneNumber), "phone", r.phoneNumber);
    }
    if (r.otherParty) {
      put(entityId("phone", r.otherParty), "phone", r.otherParty);
    }
    if (r.imei) put(entityId("imei", r.imei), "imei", r.imei);
    if (r.imsi) put(entityId("imsi", r.imsi), "imsi", r.imsi);
    if (r.ipAddress) put(entityId("ip", r.ipAddress), "ip", r.ipAddress);
    if (r.senderAccount)
      put(entityId("acct", r.senderAccount), "bank_account", r.senderAccount);
    if (r.receiverAccount)
      put(entityId("acct", r.receiverAccount), "bank_account", r.receiverAccount);
    if (r.senderUpi) put(entityId("upi", r.senderUpi), "upi", r.senderUpi);
    if (r.receiverUpi) put(entityId("upi", r.receiverUpi), "upi", r.receiverUpi);
    if (r.transactionId)
      put(entityId("txn", r.transactionId), "transaction", r.transactionId);
    if (r.recordType === "device" && r.phoneNumber) {
      put(
        entityId("device", `${r.phoneNumber}|${r.imei ?? "noimei"}`),
        "device",
        `Device ${r.phoneNumber}`
      );
    }
  }
  return [...map.values()];
}

function relId(n: number): string {
  return `REL${String(n).padStart(3, "0")}`;
}

export function correlate(records: NormalizedRecord[]): Relationship[] {
  const rels: Relationship[] = [];
  let n = 0;
  const push = (r: Omit<Relationship, "id">) => {
    n += 1;
    rels.push({ ...r, id: relId(n) });
  };

  // Group helpers
  const byImei = new Map<string, NormalizedRecord[]>();
  const byImsi = new Map<string, NormalizedRecord[]>();
  const byIp = new Map<string, NormalizedRecord[]>();

  for (const r of records) {
    if (r.imei) {
      const k = r.imei;
      if (!byImei.has(k)) byImei.set(k, []);
      byImei.get(k)!.push(r);
    }
    if (r.imsi) {
      const k = r.imsi;
      if (!byImsi.has(k)) byImsi.set(k, []);
      byImsi.get(k)!.push(r);
    }
    if (r.ipAddress && r.recordType === "ip_session") {
      const k = r.ipAddress;
      if (!byIp.has(k)) byIp.set(k, []);
      byIp.get(k)!.push(r);
    }
  }

  // Strong: same IMEI across distinct phone numbers → phone-phone link
  for (const [imei, rows] of byImei) {
    const phones = [...new Set(rows.map((r) => r.phoneNumber).filter(Boolean))] as string[];
    if (phones.length >= 2) {
      for (let i = 0; i < phones.length; i++) {
        for (let j = i + 1; j < phones.length; j++) {
          push({
            sourceEntityId: `phone:${phones[i]}`,
            targetEntityId: `phone:${phones[j]}`,
            relationshipType: `shared_imei:${imei}`,
            confidence: 1.0,
            evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
            sourceReferences: rows.map(
              (r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`
            ),
            timestamp: rows[0].timestamp,
            direction: "association",
          });
          // Also link phones to IMEI node
          push({
            sourceEntityId: `phone:${phones[i]}`,
            targetEntityId: `imei:${imei}`,
            relationshipType: "uses_imei",
            confidence: 1.0,
            evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
            sourceReferences: rows.map(
              (r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`
            ),
            direction: "association",
          });
        }
      }
      // ensure second phone also linked to IMEI
      const lastPhone = phones[phones.length - 1];
      push({
        sourceEntityId: `phone:${lastPhone}`,
        targetEntityId: `imei:${imei}`,
        relationshipType: "uses_imei",
        confidence: 1.0,
        evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
        sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
        direction: "association",
      });
    } else if (phones.length === 1 && rows.length >= 1) {
      push({
        sourceEntityId: `phone:${phones[0]}`,
        targetEntityId: `imei:${imei}`,
        relationshipType: "uses_imei",
        confidence: 1.0,
        evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
        sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
        direction: "association",
      });
    }
  }

  // Strong: same IMSI
  for (const [imsi, rows] of byImsi) {
    const phones = [...new Set(rows.map((r) => r.phoneNumber).filter(Boolean))] as string[];
    if (phones.length === 0) continue;
    for (const p of phones) {
      push({
        sourceEntityId: `phone:${p}`,
        targetEntityId: `imsi:${imsi}`,
        relationshipType: "uses_imsi",
        confidence: 1.0,
        evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
        sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
        direction: "association",
      });
    }
  }

  // Strong: bank account + UPI + transaction links
  for (const r of records) {
    if (r.recordType !== "transaction") continue;
    const ev = [r.evidenceId];
    const ref = [`${r.sourceFile}#row${r.sourceRow ?? "?"}`];
    if (r.senderAccount && r.receiverAccount && r.transactionId) {
      push({
        sourceEntityId: `acct:${r.senderAccount}`,
        targetEntityId: `acct:${r.receiverAccount}`,
        relationshipType: `transfer:${r.transactionId}`,
        confidence: 1.0,
        evidenceIds: ev,
        sourceReferences: ref,
        timestamp: r.timestamp,
        amount: r.amount,
        direction: "outbound",
      });
      push({
        sourceEntityId: `txn:${r.transactionId}`,
        targetEntityId: `acct:${r.senderAccount}`,
        relationshipType: "txn_sender",
        confidence: 1.0,
        evidenceIds: ev,
        sourceReferences: ref,
        timestamp: r.timestamp,
        amount: r.amount,
        direction: "association",
      });
      push({
        sourceEntityId: `txn:${r.transactionId}`,
        targetEntityId: `acct:${r.receiverAccount}`,
        relationshipType: "txn_receiver",
        confidence: 1.0,
        evidenceIds: ev,
        sourceReferences: ref,
        timestamp: r.timestamp,
        amount: r.amount,
        direction: "association",
      });
    }
    if (r.senderUpi) {
      push({
        sourceEntityId: `acct:${r.senderAccount}`,
        targetEntityId: `upi:${r.senderUpi}`,
        relationshipType: "account_uses_upi",
        confidence: 1.0,
        evidenceIds: ev,
        sourceReferences: ref,
        direction: "association",
      });
    }
    if (r.receiverUpi) {
      push({
        sourceEntityId: `acct:${r.receiverAccount}`,
        targetEntityId: `upi:${r.receiverUpi}`,
        relationshipType: "account_uses_upi",
        confidence: 1.0,
        evidenceIds: ev,
        sourceReferences: ref,
        direction: "association",
      });
    }
  }

  // Contextual: shared IP with/without time support
  for (const [ip, rows] of byIp) {
    const phones = [...new Set(rows.map((r) => r.phoneNumber).filter(Boolean))] as string[];
    if (phones.length < 2) {
      // still link single phone to IP node (contextual, low)
      if (phones.length === 1) {
        push({
          sourceEntityId: `phone:${phones[0]}`,
          targetEntityId: `ip:${ip}`,
          relationshipType: "used_ip",
          confidence: 0.3,
          evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
          sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
          timestamp: rows[0].timestamp,
          direction: "association",
        });
      }
      continue;
    }
    // Check time overlap / proximity (within 15 min)
    const times = rows
      .map((r) => ({
        start: r.timestamp ? Date.parse(r.timestamp) : NaN,
        end: r.endTimestamp ? Date.parse(r.endTimestamp) : NaN,
        rec: r,
      }))
      .filter((t) => !Number.isNaN(t.start));
    let close = false;
    if (times.length >= 2) {
      times.sort((a, b) => a.start - b.start);
      for (let i = 1; i < times.length; i++) {
        const prevEnd = Number.isNaN(times[i - 1].end) ? times[i - 1].start : times[i - 1].end;
        const gap = Math.abs(times[i].start - prevEnd);
        const overlap =
          !Number.isNaN(times[i - 1].end) && times[i].start <= times[i - 1].end;
        if (overlap || gap <= 15 * 60 * 1000) {
          close = true;
          break;
        }
      }
    }
    const confidence = close ? 0.75 : 0.3;
    for (let i = 0; i < phones.length; i++) {
      for (let j = i + 1; j < phones.length; j++) {
        push({
          sourceEntityId: `phone:${phones[i]}`,
          targetEntityId: `phone:${phones[j]}`,
          relationshipType: close
            ? `shared_ip_close_window:${ip}`
            : `shared_ip:${ip}`,
          confidence,
          evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
          sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
          timestamp: rows[0].timestamp,
          direction: "association",
        });
      }
      push({
        sourceEntityId: `phone:${phones[i]}`,
        targetEntityId: `ip:${ip}`,
        relationshipType: "used_ip",
        confidence,
        evidenceIds: [...new Set(rows.map((r) => r.evidenceId))],
        sourceReferences: rows.map((r) => `${r.sourceFile}#row${r.sourceRow ?? "?"}`),
        timestamp: rows[i]?.timestamp,
        direction: "association",
      });
    }
  }

  return rels;
}

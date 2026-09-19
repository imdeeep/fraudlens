// Timeline builder (spec §15)
import type { NormalizedRecord, TimelineEvent } from "./types";

export function buildTimeline(records: NormalizedRecord[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const r of records) {
    if (r.recordType === "call") {
      events.push({
        time: r.timestamp ?? "",
        eventType: "Call",
        description: `Call from ${r.phoneNumber ?? "?"} to ${r.otherParty ?? "?"} (IMEI ${r.imei ?? "?"})`,
        entityOrTransaction: r.phoneNumber ?? "",
        evidenceId: r.evidenceId,
      });
    } else if (r.recordType === "ip_session") {
      events.push({
        time: r.timestamp ?? "",
        eventType: "IP session",
        description: `${r.phoneNumber ?? "?"} used IP ${r.ipAddress ?? "?"}`,
        entityOrTransaction: r.phoneNumber ?? "",
        evidenceId: r.evidenceId,
      });
    } else if (r.recordType === "transaction") {
      events.push({
        time: r.timestamp ?? "",
        eventType: "Transaction",
        description: `${r.senderAccount ?? "?"} sends ₹${(r.amount ?? 0).toLocaleString("en-IN")} to ${r.receiverAccount ?? "?"}`,
        entityOrTransaction: r.transactionId ?? "",
        amount: r.amount,
        evidenceId: r.evidenceId,
      });
    } else if (r.recordType === "device") {
      events.push({
        time: r.timestamp ?? "1970-01-01T00:00:00.000Z",
        eventType: "Device record",
        description: `${r.phoneNumber ?? "?"} associated with IMEI ${r.imei ?? "?"} / IMSI ${r.imsi ?? "?"}`,
        entityOrTransaction: r.phoneNumber ?? "",
        evidenceId: r.evidenceId,
      });
    }
  }
  // Device records without timestamps go last; rest chronological
  events.sort((a, b) => {
    if (a.time.startsWith("1970") && !b.time.startsWith("1970")) return 1;
    if (b.time.startsWith("1970") && !a.time.startsWith("1970")) return -1;
    return Date.parse(a.time) - Date.parse(b.time);
  });
  return events;
}

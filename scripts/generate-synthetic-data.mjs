import { mkdir, writeFile } from "node:fs/promises";

// Generates larger, deterministic, fictional evidence files for the FraudLens demo.
// All addresses, accounts, phones, and names are synthetic; do not replace them with
// real investigative data for the public demo.

const outputDir = new URL("../public/samples/", import.meta.url);
const base = Date.parse("2026-09-18T08:00:00Z");
const iso = (minutes) => new Date(base + minutes * 60_000).toISOString();

const cdr = [
  "call_id,phone_number,other_party,timestamp,direction,duration_seconds,imei,imsi",
  "C001,+919000000001,+919111111111,2026-09-18T10:01:00Z,OUTGOING,42,356789012345678,404010123456789",
  "C002,+919000000002,+919111111111,2026-09-18T10:05:00Z,OUTGOING,31,356789012345678,404010987654321",
];

for (let i = 3; i <= 120; i += 1) {
  const phone = `+91900000${String(i).padStart(4, "0")}`;
  const other = `+919111${String(1000 + (i % 40)).padStart(6, "0")}`;
  const imei = `356789${String(100000000 + i).slice(-9)}`;
  const imsi = `404010${String(100000000 + i).slice(-9)}`;
  cdr.push(`C${String(i).padStart(3, "0")},${phone},${other},${iso(10 + i * 3)},${i % 3 === 0 ? "INCOMING" : "OUTGOING"},${20 + (i % 80)},${imei},${imsi}`);
}

const ipdr = [
  "session_id,phone_number,ip_address,start_time,end_time,source_port,destination_ip",
  "I001,+919000000001,103.21.45.10,2026-09-18T10:02:00Z,2026-09-18T10:12:00Z,51231,198.51.100.20",
  "I002,+919000000002,103.21.45.10,2026-09-18T10:04:00Z,2026-09-18T10:14:00Z,51232,198.51.100.20",
];

for (let i = 3; i <= 120; i += 1) {
  const phone = `+91900000${String(i).padStart(4, "0")}`;
  const ip = `198.51.100.${10 + (i % 35)}`;
  const start = 12 + i * 3;
  ipdr.push(`I${String(i).padStart(3, "0")},${phone},${ip},${iso(start)},${iso(start + 8 + (i % 12))},${51000 + i},203.0.113.${10 + (i % 30)}`);
}

const bank = [
  "transaction_id,timestamp,sender_account,receiver_account,sender_upi,receiver_upi,amount,currency,transaction_type,status",
  "T001,2026-09-18T10:15:00Z,VICTIM-001,MULE-001,victim@upi,mulea@upi,48500,INR,UPI,CAPTURED",
  "T002,2026-09-18T10:23:00Z,MULE-001,MULE-002,mulea@upi,muleb@upi,47000,INR,UPI,CAPTURED",
  "T003,2026-09-18T10:29:00Z,MULE-002,CASHOUT-001,muleb@upi,cashout@upi,45000,INR,UPI,CAPTURED",
  "T004,2026-09-18T10:17:00Z,VICTIM-002,MULE-001,victim2@upi,mulea@upi,32000,INR,UPI,CAPTURED",
  "T005,2026-09-18T10:18:00Z,VICTIM-003,MULE-001,victim3@upi,mulea@upi,27500,INR,UPI,CAPTURED",
  "T006,2026-09-18T10:25:00Z,MULE-001,MULE-003,mulea@upi,mulec@upi,30000,INR,UPI,CAPTURED",
];

for (let i = 7; i <= 100; i += 1) {
  const sender = `CUSTOMER-${String(i - 6).padStart(3, "0")}`;
  const receiver = `MERCHANT-${String((i % 24) + 1).padStart(3, "0")}`;
  const senderUpi = `customer${i - 6}@upi`;
  const receiverUpi = `merchant${(i % 24) + 1}@upi`;
  const amount = 750 + ((i * 137) % 16000);
  bank.push(`T${String(i).padStart(3, "0")},${iso(180 + i * 7)},${sender},${receiver},${senderUpi},${receiverUpi},${amount},INR,UPI,CAPTURED`);
}

const devices = [
  {
    phone_number: "+919000000001",
    imei: "356789012345678",
    imsi: "404010123456789",
    mac_address: "AA:BB:CC:11:22:33",
    device_model: "Android-X1",
    installed_apps: ["com.example.wallet", "com.example.remote"],
  },
  {
    phone_number: "+919000000002",
    imei: "356789012345678",
    imsi: "404010987654321",
    mac_address: "AA:BB:CC:44:55:66",
    device_model: "Android-X1",
    installed_apps: ["com.example.wallet"],
  },
];

for (let i = 3; i <= 80; i += 1) {
  devices.push({
    phone_number: `+91900000${String(i).padStart(4, "0")}`,
    imei: `356789${String(100000000 + i).slice(-9)}`,
    imsi: `404010${String(100000000 + i).slice(-9)}`,
    mac_address: `AA:BB:${String((i * 3) % 90).padStart(2, "0")}:${String(i).padStart(2, "0")}:${String((i * 7) % 90).padStart(2, "0")}:${String((i * 11) % 90).padStart(2, "0")}`,
    device_model: i % 4 === 0 ? "Android-X2" : "Android-X1",
    installed_apps: i % 5 === 0 ? ["com.example.wallet", "com.example.remote"] : ["com.example.wallet"],
  });
}

await mkdir(outputDir, { recursive: true });
await writeFile(new URL("cdr.csv", outputDir), `${cdr.join("\n")}\n`);
await writeFile(new URL("ipdr.csv", outputDir), `${ipdr.join("\n")}\n`);
await writeFile(new URL("bank_transactions.csv", outputDir), `${bank.join("\n")}\n`);
await writeFile(new URL("device.json", outputDir), `${JSON.stringify(devices, null, 2)}\n`);

console.log(`Generated ${cdr.length - 1} CDR, ${ipdr.length - 1} IPDR, ${bank.length - 1} bank, and ${devices.length} device records.`);

// Browser-side SHA-256 via Web Crypto API (spec §7)
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashFile(file: File): Promise<{ hash: string; bytes: ArrayBuffer }> {
  const bytes = await file.arrayBuffer();
  // Clone for hashing so the caller can still use the bytes for parsing
  const hash = await sha256Hex(bytes.slice(0));
  return { hash, bytes };
}

export function evidenceIdFor(index: number): string {
  return `EVD${String(index + 1).padStart(3, "0")}`;
}

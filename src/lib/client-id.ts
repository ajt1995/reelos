let fallbackCounter = 0;

/** Non-authoritative UI identity that also works on plain-HTTP household LANs. */
export function createClientId(prefix = "") {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return `${prefix}${webCrypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") webCrypto.getRandomValues(bytes);
  else {
    fallbackCounter += 1;
    const seed = `${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = seed.charCodeAt(index % seed.length) ^ (index * 29);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${prefix}${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

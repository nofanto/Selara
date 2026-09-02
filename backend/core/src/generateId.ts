// Web Crypto's getRandomValues is available unmodified in Node 18+, Cloudflare
// Workers, and browsers, so this needs no platform-specific implementation.
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generates a UUID v4 using the Web Crypto API (available in WebView contexts) */
export function generateId(): string {
  return crypto.randomUUID();
}


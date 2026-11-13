/**
 * Only allow redirects to same-site relative paths. Blocks open redirects such
 * as "//evil.example", "https://evil.example", or "/\\evil.example".
 */
export function safeRelativePath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(candidate)) return fallback;
  return candidate;
}

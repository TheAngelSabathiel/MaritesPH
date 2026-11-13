/** Text extraction helpers (pure). PDF bytes are handled by the server fetcher with unpdf. */
import { createHash } from "node:crypto";

export const MAX_TEXT = 200_000;
/** Below this many characters of text, a PDF is probably scanned: mark needs_ocr. */
export const MIN_USEFUL_TEXT = 200;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n") // no stray spaces at line edges
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, MAX_TEXT);
}

export function sha256(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex");
}

export function extractionStatus(text: string, kind: "pdf" | "html"): "ok" | "needs_ocr" | "failed" {
  if (text.trim().length >= MIN_USEFUL_TEXT) return "ok";
  return kind === "pdf" ? "needs_ocr" : "failed";
}

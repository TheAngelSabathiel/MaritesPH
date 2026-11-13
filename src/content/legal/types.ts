/**
 * Legal page content. Plain data (no Markdown parser dependency).
 * STATUS: TO REVIEW by a Philippine lawyer before launch. Bracketed values
 * like [OPERATOR NAME] are placeholders the founder must fill in.
 */
export type LegalSection = { heading: string; paragraphs?: string[]; items?: string[] };
export type LegalDoc = { en: LegalSection[]; fil: LegalSection[] };

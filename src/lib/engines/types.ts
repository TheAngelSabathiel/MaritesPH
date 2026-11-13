/**
 * Shared types for the planning engines. The catalog is a plain snapshot of
 * PUBLISHED content (built by getPlannerCatalog in src/lib/content/public.ts),
 * so the engines are pure functions: no database, no AI, fully unit-testable.
 */
import type { PublicOffice } from "@/lib/content/offices";

export type CatalogRequirementItem = {
  id: string;
  groupKey: string;
  optionKey: string;
  /** Another document this requirement needs, or null for a free-text requirement. */
  documentId: string | null;
  text: string | null;
  quantity: number;
};

export type CatalogDocument = {
  id: string;
  slug: string;
  name: string;
  agencyName: string | null;
  feeMin: number | null;
  feeMax: number | null;
  processingDaysMin: number | null;
  processingDaysMax: number | null;
  purposes: string[];
  requirements: CatalogRequirementItem[];
  /** Published steps; is_online drives the in-person visit estimate. */
  steps: { id: string; isOnline: boolean }[];
  lastVerifiedAt: string | null;
};

export type Catalog = {
  documents: CatalogDocument[];
  offices: PublicOffice[];
  /** Median reported wait (minutes) per office id, from approved tips. Optional. */
  waitMinutes?: Record<string, number>;
};

export type Goal = { kind: "document"; documentId: string } | { kind: "purpose"; purpose: string };

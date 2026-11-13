/**
 * Live context check: "Ano'ng bago?" on guide pages. Two groups that are NEVER
 * mixed: official updates (government domains) and Chika sa Pila community
 * experience (community domains). Each group is cached per guide and language
 * (official 24h, community 12h by default). When the AI is off or over budget,
 * stale cached results are shown, or nothing. An official update that may
 * conflict with the verified guide raises a system flag for admin review;
 * nothing on the guide itself changes.
 */
import { z } from "zod";
import type { AiRunner } from "@/lib/ai/client";
import { extractJson, groundedUrl } from "@/lib/ai/core";
import { communityContextPrompt, officialContextPrompt } from "@/lib/ai/prompts/live-context";

const officialSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        issuingBody: z.string().trim().max(200).default(""),
        issuanceNumber: z.string().trim().max(80).nullable().default(null),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
        url: z.string(),
        summary: z.string().trim().max(400).default(""),
        conflicts: z.boolean().default(false),
        conflictNote: z.string().trim().max(300).nullable().default(null),
      }),
    )
    .max(6),
});
const communitySchema = z.object({
  items: z
    .array(z.object({ url: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), summary: z.string().trim().min(1).max(300) }))
    .max(6),
});

export type OfficialItem = z.infer<typeof officialSchema>["items"][number] & { sourceTitle: string };
export type CommunityItem = z.infer<typeof communitySchema>["items"][number] & { sourceTitle: string };
export type ContextGroup<T> = { items: T[]; fetchedAt: string; stale: boolean } | null;
export type LiveContext = { official: ContextGroup<OfficialItem>; community: ContextGroup<CommunityItem> };

export const cachedOfficialSchema = z.object({ items: z.array(officialSchema.shape.items.element.extend({ sourceTitle: z.string() })) });
export const cachedCommunitySchema = z.object({ items: z.array(communitySchema.shape.items.element.extend({ sourceTitle: z.string() })) });

type Kind = "official" | "community";
export type LiveDeps = {
  run: AiRunner;
  domains: { official: string[]; community: string[] };
  ttlHours: { official: number; community: number };
  readCache: (kind: Kind) => Promise<{ results: unknown; fetchedAt: string; expiresAt: string } | null>;
  writeCache: (kind: Kind, results: unknown, expiresAt: Date) => Promise<void>;
  flagConflict: (note: string, url: string) => Promise<void>;
  /** Rate limiting: may this request trigger an AI call? */
  allowAiCall: () => Promise<boolean>;
  now: () => Date;
};

export type LiveTarget = { documentName: string; agencyName: string | null; lastVerified: string; verifiedSummary: string; locale: "en" | "fil" };

async function group<T>(kind: Kind, deps: LiveDeps, target: LiveTarget, cachedSchema: z.ZodType<{ items: T[] }>, fresh: () => Promise<T[] | null>): Promise<ContextGroup<T>> {
  const cached = await deps.readCache(kind);
  const parsedCache = cached ? cachedSchema.safeParse(cached.results) : null;
  const now = deps.now();
  if (cached && parsedCache?.success && new Date(cached.expiresAt) > now) {
    return { items: parsedCache.data.items, fetchedAt: cached.fetchedAt, stale: false };
  }
  const items = (await deps.allowAiCall()) ? await fresh() : null;
  if (items) {
    const ttl = kind === "official" ? deps.ttlHours.official : deps.ttlHours.community;
    await deps.writeCache(kind, { items }, new Date(now.getTime() + ttl * 3_600_000));
    return { items, fetchedAt: now.toISOString(), stale: false };
  }
  // AI off, over budget, rate-limited, or failed: show the last known results, marked stale.
  return cached && parsedCache?.success ? { items: parsedCache.data.items, fetchedAt: cached.fetchedAt, stale: true } : null;
}

export async function getLiveContext(target: LiveTarget, deps: LiveDeps): Promise<LiveContext> {
  const official = await group<OfficialItem>("official", deps, target, cachedOfficialSchema as z.ZodType<{ items: OfficialItem[] }>, async () => {
    const { system, prompt } = officialContextPrompt(target);
    const res = await deps.run({ purpose: "live_context", system, prompt, maxTokens: 1200, webSearch: { domains: deps.domains.official, maxUses: 3 } });
    if (res.status !== "ok") return null;
    const parsed = officialSchema.safeParse(extractJson(res.text));
    if (!parsed.success) return null;
    const items = parsed.data.items.flatMap((i) => {
      const src = groundedUrl(i.url, res.sources, deps.domains.official);
      return src ? [{ ...i, url: src.url, sourceTitle: src.title }] : [];
    });
    for (const i of items.filter((x) => x.conflicts)) await deps.flagConflict(i.conflictNote ?? i.title, i.url);
    return items;
  });

  const community = await group<CommunityItem>("community", deps, target, cachedCommunitySchema as z.ZodType<{ items: CommunityItem[] }>, async () => {
    const { system, prompt } = communityContextPrompt(target);
    const res = await deps.run({ purpose: "live_context", system, prompt, maxTokens: 900, webSearch: { domains: deps.domains.community, maxUses: 3 } });
    if (res.status !== "ok") return null;
    const parsed = communitySchema.safeParse(extractJson(res.text));
    if (!parsed.success) return null;
    return parsed.data.items.flatMap((i) => {
      const src = groundedUrl(i.url, res.sources, deps.domains.community);
      return src ? [{ ...i, url: src.url, sourceTitle: src.title }] : [];
    });
  });

  return { official, community };
}

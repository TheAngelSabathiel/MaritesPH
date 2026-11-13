/**
 * GET /api/context?type=document&slug=<guide slug>&locale=en
 * "Ano'ng bago?" live context for a published guide: official updates and
 * community experience, kept apart. Served from cache when fresh; AI calls on
 * a cache miss are rate-limited per hashed IP (20/hour). Possible conflicts
 * with the verified guide create one open system flag per source link.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runAi } from "@/lib/ai/client";
import { aiSettings } from "@/lib/ai/config";
import { getFreshness } from "@/lib/content/freshness";
import { getGuide } from "@/lib/content/public";
import { getLiveContext } from "@/lib/context/live";
import { serverEnv } from "@/lib/env.server";
import { checkRateLimit, clientIp, hashIp } from "@/lib/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const query = z.object({ type: z.literal("document"), slug: z.string().regex(/^[a-z0-9-]{1,100}$/), locale: z.enum(["en", "fil"]) });

export async function GET(request: NextRequest) {
  const q = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const guide = await getGuide(q.data.slug);
  if (!guide) return NextResponse.json({ error: "not found" }, { status: 404 });

  const service = createSupabaseServiceClient();
  const settings = aiSettings();
  const { document: doc } = guide;
  const key = { target_type: "document", target_id: doc.id, locale: q.data.locale };

  const verifiedSummary = [
    doc.fee_min != null ? `Fee: ${doc.fee_min}${doc.fee_max != null && doc.fee_max !== doc.fee_min ? ` to ${doc.fee_max}` : ""} PHP` : null,
    doc.validity_text ? `Validity: ${doc.validity_text}` : null,
    ...guide.requirementGroups.flatMap((g) => g.options.flatMap((o) => o.items.map((i) => `Requirement: ${i.requiredDocument?.name ?? i.requirement_text}`))),
    ...guide.steps.map((s) => `Step ${s.step_order}: ${s.title}`),
  ]
    .filter(Boolean)
    .join("\n");

  const ctx = await getLiveContext(
    { documentName: doc.name, agencyName: guide.agency?.name ?? null, lastVerified: (guide.oldestVerifiedAt ?? new Date().toISOString()).slice(0, 10), verifiedSummary, locale: q.data.locale },
    {
      run: runAi,
      domains: { official: settings.officialDomains, community: settings.communityDomains },
      ttlHours: { official: settings.officialTtlHours, community: settings.communityTtlHours },
      now: () => new Date(),
      readCache: async (kind) => {
        if (!service) return null;
        const { data } = await service.from("live_context_cache").select("results, fetched_at, expires_at").match({ ...key, kind }).maybeSingle();
        return data ? { results: data.results, fetchedAt: String(data.fetched_at), expiresAt: String(data.expires_at) } : null;
      },
      writeCache: async (kind, results, expiresAt) => {
        await service?.from("live_context_cache").upsert({ ...key, kind, results, fetched_at: new Date().toISOString(), expires_at: expiresAt.toISOString() });
      },
      flagConflict: async (note, url) => {
        if (!service) return;
        const { data } = await service.from("content_flags").select("id").match({ target_type: "document", target_id: doc.id, status: "open", source: "system", evidence_url: url }).limit(1);
        if (data?.length) return;
        await service.from("content_flags").insert({ source: "system", target_type: "document", target_id: doc.id, reason: "outdated", details: `Live check: ${note}`.slice(0, 1000), evidence_url: url });
      },
      allowAiCall: async () => {
        if (!settings.enabled) return false;
        const salt = serverEnv().RATE_LIMIT_SALT;
        const ip = clientIp((n) => request.headers.get(n));
        if (!salt || !ip) return false;
        return (await checkRateLimit(`ctx:ip:${hashIp(ip, salt)}`, 20, 3600)) === "allowed";
      },
    },
  );

  const stale = getFreshness(guide.oldestVerifiedAt, new Date(), serverEnv().CONTENT_STALE_DAYS).state === "stale";
  return NextResponse.json(
    { ...ctx, conflict: Boolean(ctx.official?.items.some((i) => i.conflicts)), guideStale: stale },
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}

/**
 * The one place the app talks to Claude. Server-only.
 *   1. AI enabled? (aiSettings)          otherwise { status: "disabled" }
 *   2. Monthly budget left?              otherwise { status: "over_budget" }
 *   3. Call the Messages API, optionally with web search limited to allowed domains.
 *   4. Log tokens, searches, estimated cost, and outcome to ai_usage_log.
 * Prompts never include account details (email, name) and are never logged.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { aiSettings } from "./config";
import { estimateCost, type SearchSource, type Usage } from "./core";

export type AiPurpose = "plan_summary" | "troubleshoot" | "live_context" | "monitoring";

export type AiRequest = {
  purpose: AiPurpose;
  system: string;
  prompt: string;
  maxTokens: number;
  webSearch?: { domains: string[]; maxUses: number };
  userId?: string | null;
};

export type AiResult =
  | { status: "ok"; text: string; sources: SearchSource[]; usage: Usage }
  | { status: "disabled" | "over_budget" | "error" };

/** Injected into the engines so they can be tested without the network. */
export type AiRunner = (req: AiRequest) => Promise<AiResult>;

async function log(req: AiRequest, model: string, usage: Usage, cost: number, outcome: "ok" | "rejected" | "error") {
  const service = createSupabaseServiceClient();
  if (!service) return;
  const { error } = await service.from("ai_usage_log").insert({
    purpose: req.purpose,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_estimate: cost,
    outcome,
    user_id: req.userId ?? null,
  });
  if (error) console.error("ai usage log failed", error.code);
}

export async function spendThisMonth(): Promise<number | null> {
  const service = createSupabaseServiceClient();
  if (!service) return null;
  const { data, error } = await service.rpc("ai_spend_this_month");
  return error ? null : Number(data ?? 0);
}

export const runAi: AiRunner = async (req) => {
  const s = aiSettings();
  if (!s.enabled || !s.apiKey || !s.model) return { status: "disabled" };

  // Budget check needs the service client; without it we can't enforce the cap, so stay off.
  const spent = await spendThisMonth();
  if (spent == null) return { status: "disabled" };
  if (spent >= s.monthlyBudgetUsd) return { status: "over_budget" };

  const client = new Anthropic({ apiKey: s.apiKey });
  const usage: Usage = { inputTokens: 0, outputTokens: 0, webSearches: 0 };
  try {
    const response = await client.messages.create({
      model: s.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      ...(req.webSearch
        ? {
            tools: [
              {
                type: "web_search_20250305" as const,
                name: "web_search" as const,
                allowed_domains: req.webSearch.domains,
                max_uses: req.webSearch.maxUses,
              },
            ],
          }
        : {}),
    });

    usage.inputTokens = response.usage.input_tokens;
    usage.outputTokens = response.usage.output_tokens;
    usage.webSearches = response.usage.server_tool_use?.web_search_requests ?? 0;

    const sources: SearchSource[] = [];
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result") sources.push({ url: r.url, title: r.title, pageAge: r.page_age ?? null });
        }
      }
    }
    await log(req, s.model, usage, estimateCost(usage, s.prices), "ok");
    return { status: "ok", text, sources, usage };
  } catch (err) {
    console.error("ai call failed", err instanceof Anthropic.APIError ? err.status : "unknown");
    await log(req, s.model, usage, estimateCost(usage, s.prices), "error");
    return { status: "error" };
  }
};

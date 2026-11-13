"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const consentInput = z.object({ locale: z.string().refine(isLocale) });

/** Record privacy consent for a signed-in user whose consent is missing or outdated. */
export async function giveConsent(formData: FormData) {
  const parsed = consentInput.safeParse({ locale: formData.get("locale") });
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("record_privacy_consent", { p_version: PRIVACY_POLICY_VERSION });
  if (error) console.error("record_privacy_consent failed", error.code);

  revalidatePath(`/${parsed.data.locale}/account`);
}

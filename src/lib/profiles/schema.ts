import { z } from "zod";

/** Shape of the profile fields the app reads. Validates DB rows at the boundary. */
export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string().nullable(),
  language_pref: z.enum(["en", "fil"]),
  region: z.string().nullable(),
  city: z.string().nullable(),
  role: z.enum(["user", "admin", "cpa"]),
  privacy_consent_at: z.string().nullable(),
  privacy_consent_version: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

export const PROFILE_COLUMNS =
  "id, display_name, language_pref, region, city, role, privacy_consent_at, privacy_consent_version";

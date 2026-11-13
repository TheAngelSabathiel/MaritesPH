/**
 * URL slugs: "Parañaque City Hall" -> "paranaque-city-hall".
 * Mirrors public.slugify() in the database (migration 5); tests keep them aligned.
 */
const FROM = "ñáàâäãéèêëíìîïóòôöõúùûüç";
const TO = "naaaaaeeeeiiiiooooouuuuc";

export function slugify(text: string | null | undefined): string {
  const lower = (text ?? "").toLowerCase();
  let mapped = "";
  for (const ch of lower) {
    const i = FROM.indexOf(ch);
    mapped += i >= 0 ? TO[i] : ch;
  }
  return mapped.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

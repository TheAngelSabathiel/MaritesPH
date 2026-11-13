/**
 * Server-side dictionary loader (Next.js native i18n pattern).
 * Messages never ship to the browser as a whole; Client Components receive only
 * the strings they need as props. This keeps client JS small for low-end phones.
 *
 * All UI copy, including the playful "Marites" brand voice, lives in
 * src/i18n/messages/*.json so tone can change without code changes.
 */
import "server-only";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { isLocale, type Locale } from "./config";
import type en from "./messages/en.json";

export type Messages = typeof en;

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("./messages/en.json").then((m) => m.default),
  fil: () => import("./messages/fil.json").then((m) => m.default),
};

/** Current request's locale from the [locale] root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

/** Dictionary for the current route's locale (Server Components only). */
export async function getDictionary(): Promise<Messages> {
  return loaders[await getLocale()]();
}

/** Dictionary for an explicit locale (route handlers, server actions, emails). */
export async function getDictionaryFor(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}

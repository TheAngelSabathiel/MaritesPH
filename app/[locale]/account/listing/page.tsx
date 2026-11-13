import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/dictionaries";
import { saveListing } from "@/lib/marketplace/actions";
import { myListing } from "@/lib/marketplace/data";
import { SERVICES } from "@/lib/marketplace/rules";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { robots: { index: false, follow: false } };
type Props = PageProps<"/[locale]/account/listing">;
const ERR = ["invalid", "contact", "save"] as const;

export default function ListingPage(props: Props) {
  return <div className="mx-auto max-w-2xl space-y-5"><Suspense fallback={null}><Body params={props.params} searchParams={props.searchParams} /></Suspense></div>;
}

async function Body({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUserClaims();
  if (!user) redirect(`/${locale}/login`);
  const [t, listing, sp, supabase] = await Promise.all([getDictionaryFor(locale), myListing(user.id), searchParams, createSupabaseServerClient()]);
  const m = t.market;
  const f = m.listingFields;
  const { data: settings } = supabase ? await supabase.from("marketplace_settings").select("fee_rate").maybeSingle() : { data: null };
  const err = ERR.find((k) => k === sp.error);
  const inputCls = "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base";
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">{m.listingTitle}</h1>
      <p>{m.listingIntro}</p>
      {listing ? <p className="font-semibold">{m.listingStatus[listing.status as keyof typeof m.listingStatus]}{listing.admin_note ? ` · ${listing.admin_note}` : ""}</p> : null}
      {sp.saved ? <Alert tone="success">{m.listingSaved}</Alert> : null}
      {err ? <Alert tone="caution">{m.listingErrors[err]}</Alert> : null}
      <form action={saveListing} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.display_name}</span><Input name="display_name" required defaultValue={listing?.display_name ?? ""} /></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.profession}</span><select name="profession" defaultValue={listing?.profession ?? "cpa"} className={inputCls}><option value="cpa">{m.profession.cpa}</option><option value="bookkeeper">{m.profession.bookkeeper}</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.prc_license_no}</span><Input name="prc_license_no" inputMode="numeric" defaultValue={listing?.prc_license_no ?? ""} /></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.license_valid_until}</span><Input name="license_valid_until" type="date" defaultValue={listing?.license_valid_until ?? ""} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">{f.firm_name}</span><Input name="firm_name" defaultValue={listing?.firm_name ?? ""} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">{f.bio}</span><textarea name="bio" rows={4} maxLength={1500} defaultValue={listing?.bio ?? ""} className={`${inputCls} min-h-24`} /></label>
        <fieldset className="min-w-0 space-y-1 sm:col-span-2"><legend className="text-sm font-semibold">{f.services}</legend>
          {SERVICES.map((s) => <label key={s} className="flex min-h-11 items-center gap-3"><input type="checkbox" name="services" value={s} defaultChecked={listing?.services.includes(s)} className="size-5" />{m.services[s]}</label>)}
        </fieldset>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">{f.cities}</span><Input name="cities" defaultValue={listing?.cities.join(", ") ?? ""} /></label>
        <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" name="online_only" defaultChecked={listing?.online_only} className="size-5" />{f.online_only}</label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.starting_fee_php}</span><Input name="starting_fee_php" inputMode="decimal" defaultValue={listing?.starting_fee_php ?? ""} /></label>
        <label className="space-y-1 text-sm"><span className="font-semibold">{f.contact_email}</span><Input name="contact_email" type="email" required defaultValue={listing?.contact_email ?? user.email ?? ""} /></label>
        <Button type="submit" className="sm:col-span-2 sm:w-auto">{m.saveListing}</Button>
      </form>
      {settings ? <p className="text-sm text-muted-foreground">{m.feeNote.replace("{rate}", String(Number(settings.fee_rate) * 100))}</p> : null}
      <Alert tone="info">{m.disclaimer}</Alert>
    </>
  );
}

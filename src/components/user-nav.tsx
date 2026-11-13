import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { createSupabaseServerClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";

/** Sign-in link for visitors; account (and Admin, for admins) when signed in. Server Component. */
export async function UserNav({ locale, t }: { locale: Locale; t: Messages }) {
  const user = await getCurrentUserClaims();
  if (!user) {
    return (
      <Link href={`/${locale}/login`} className={buttonVariants({ size: "sm" })}>
        {t.nav.signIn}
      </Link>
    );
  }

  // RLS lets users read only their own profile row.
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <>
      {data?.role === "cpa" ? (
        <Link href={`/${locale}/cpa`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          CPA
        </Link>
      ) : null}
      {data?.role === "admin" ? (
        <Link href={`/${locale}/admin`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t.nav.admin}
        </Link>
      ) : null}
      <Link href={`/${locale}/account`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {t.nav.account}
      </Link>
    </>
  );
}

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Shown when a freelancer page needs sign-in. */
export function SignInPrompt({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-6">
      <p>{text}</p>
      <Link href={href} className={buttonVariants()}>{label}</Link>
    </div>
  );
}

/** Shown to signed-in users without a plan that includes Marites Freelancer. */
export function UpgradePrompt({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="space-y-3 rounded-lg border-2 border-dashed border-folder p-6">
      <p>{text}</p>
      <Link href={href} className={buttonVariants()}>{label}</Link>
    </div>
  );
}

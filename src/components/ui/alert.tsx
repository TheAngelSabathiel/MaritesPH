import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui Alert with app-specific tones. "caution" is for outdated/unverified info.
const alertVariants = cva("rounded-md border px-4 py-3 text-sm leading-relaxed", {
  variants: {
    tone: {
      info: "border-border bg-muted text-foreground",
      caution: "border-caution/40 bg-caution-soft text-foreground",
      success: "border-stamp/40 bg-stamp-soft text-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Alert({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="status" className={cn(alertVariants({ tone }), className)} {...props} />;
}

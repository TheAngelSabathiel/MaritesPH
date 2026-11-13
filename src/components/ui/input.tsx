import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Input. 16px text prevents iOS zoom-on-focus.
export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

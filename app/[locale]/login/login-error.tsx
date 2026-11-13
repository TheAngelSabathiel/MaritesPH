"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";

/** Shows the callback error when the auth routes redirect back with ?error=callback. */
export function LoginError({ message }: { message: string }) {
  const params = useSearchParams();
  if (params.get("error") !== "callback") return null;
  return <Alert tone="caution">{message}</Alert>;
}

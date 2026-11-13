"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";

/** Shows ?notice= / ?error= set by admin actions after a redirect. */
export function AdminMessages() {
  const params = useSearchParams();
  const notice = params.get("notice");
  const error = params.get("error");
  if (!notice && !error) return null;
  return (
    <div className="space-y-2">
      {error ? <Alert tone="caution">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
    </div>
  );
}

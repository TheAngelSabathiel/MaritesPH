"use client";

/** "Show map" button that loads the Leaflet map only when pressed. */
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MapPoint } from "./office-map";

const OfficeMap = dynamic(() => import("./office-map").then((m) => m.OfficeMap), { ssr: false });

export function MapToggle({ points, labels }: { points: MapPoint[]; labels: { show: string; hide: string; loading: string; note: string } }) {
  const [open, setOpen] = useState(false);
  if (points.length === 0) return null;
  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? labels.hide : labels.show}
      </Button>
      {open ? <OfficeMap points={points} loadingLabel={labels.loading} note={labels.note} height={260} /> : null}
    </div>
  );
}

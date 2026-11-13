"use client";

/**
 * OpenStreetMap map of offices, using Leaflet. Leaflet (JS + CSS) is
 * downloaded only when this component mounts, which happens only after the
 * visitor asks for the map, so list-only visits stay light on data.
 * Circle markers avoid Leaflet's image-based marker icons.
 */
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapPoint = { id: string; name: string; lat: number; lng: number; href: string };

export function OfficeMap({ points, loadingLabel, note, height = 320 }: { points: MapPoint[]; loadingLabel: string; note: string; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !container.current) return;
      if (!map.current) {
        map.current = L.map(container.current, { scrollWheelZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current);
      }
      const m = map.current;
      m.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) m.removeLayer(layer);
      });
      const style = getComputedStyle(document.documentElement);
      const color = style.getPropertyValue("--primary").trim() || "#1d3a72";
      for (const p of points) {
        const link = document.createElement("a");
        link.href = p.href;
        link.textContent = p.name;
        L.circleMarker([p.lat, p.lng], { radius: 9, color, weight: 3, fillOpacity: 0.6 }).bindPopup(link).addTo(m);
      }
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 16);
      else if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24] });
      else m.setView([12.88, 121.77], 5); // whole Philippines
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div className="space-y-1">
      <div className="relative overflow-hidden rounded-lg border" style={{ height }}>
        {!ready ? <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{loadingLabel}</p> : null}
        <div ref={container} className="h-full w-full" />
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

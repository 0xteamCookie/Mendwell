import { useEffect, useRef } from "react";
import type { Row } from "../lib/types";
import { TIER, tierByFraction } from "../lib/theme";
import { loadLeaflet, TILES, TILE_ATTR } from "../lib/cdn";

export function MapView({ points, selectedId, onSelect }: { points: Row[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!points.length) return;
    let cancelled = false;
    let map: any;
    const total = points.length;
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current) return;
      map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([16.51, 80.62], 11);
      mapRef.current = map;
      L.tileLayer(TILES, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      map.on("click", () => onSelectRef.current(null));
      markersRef.current = new Map();

      [...points].sort((a, b) => b.priority_rank - a.priority_rank).forEach((p) => {
        const tier = tierByFraction(p.priority_rank / total);
        const base = tier === "high" ? 8 : tier === "medium" ? 6.5 : 5;
        const m = L.circleMarker([p.latitude, p.longitude], {
          radius: base, color: "#ffffff", weight: 1.5, fillColor: TIER[tier].color, fillOpacity: 0.9,
        }).addTo(map);
        (m as any)._base = base;
        m.bindTooltip(`#${p.priority_rank} ${p.location_id}`, { direction: "top" });
        m.on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(p.location_id);
        });
        markersRef.current.set(p.location_id, m);
      });
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    });
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [points]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const sel = id === selectedId;
      m.setStyle({ radius: sel ? m._base + 6 : m._base, weight: sel ? 3 : 1.5, color: sel ? "#0f172a" : "#ffffff" });
      if (sel) {
        m.bringToFront();
        const map = mapRef.current;
        if (map) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 12), { duration: 0.6 });
      }
    });
  }, [selectedId, points]);

  return <div ref={hostRef} className="h-full w-full" />;
}

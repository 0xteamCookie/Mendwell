import { useEffect, useMemo, useRef, useState } from "react";
import type { Row, LatLng, Crew, RouteRes } from "../lib/types";
import { TEAL, TIER, clean, tierByFraction } from "../lib/theme";
import { loadLeaflet, TILES, TILE_ATTR } from "../lib/cdn";
import { buildPlan, densify, indexStops, fmtHours } from "../lib/tsp";
import { Icon } from "./icons";
import { Card, Kpi } from "./ui";

export function DeployMap({ ranked, total }: { ranked: Row[]; total: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layers = useRef<{ preview: any; plan: any; depot: any } | null>(null);
  const rafRef = useRef<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [nStops, setNStops] = useState(12);
  const [nCrews, setNCrews] = useState(2);
  const [depot, setDepot] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<"idle" | "routing" | "drawing" | "done">("idle");
  const [plan, setPlan] = useState<{ crews: Crew[]; routes: RouteRes[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const [roadFail, setRoadFail] = useState(false);

  const stops = useMemo(() => ranked.slice(0, nStops), [ranked, nStops]);

  // default depot: centroid of selected sites
  useEffect(() => {
    if (depot || !stops.length) return;
    setDepot([stops.reduce((s, r) => s + r.latitude, 0) / stops.length, stops.reduce((s, r) => s + r.longitude, 0) / stops.length]);
  }, [stops, depot]);

  // init map
  useEffect(() => {
    if (!ranked.length) return;
    let cancelled = false;
    let map: any;
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current) return;
      map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([16.51, 80.62], 11);
      mapRef.current = map;
      L.tileLayer(TILES, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      layers.current = { preview: L.layerGroup().addTo(map), plan: L.layerGroup().addTo(map), depot: L.layerGroup().addTo(map) };
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (map) map.remove();
      mapRef.current = null;
      layers.current = null;
      setMapReady(false);
    };
  }, [ranked.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPlan = plan !== null;

  // preview markers (before a plan exists)
  useEffect(() => {
    const L = (window as any).L;
    if (!mapReady || !L || !layers.current || hasPlan) return;
    layers.current.preview.clearLayers();
    stops.forEach((r) => {
      const tier = tierByFraction(r.priority_rank / total);
      L.circleMarker([r.latitude, r.longitude], { radius: 8, color: "#fff", weight: 2, fillColor: TIER[tier].color, fillOpacity: 0.95 })
        .bindTooltip(`#${r.priority_rank} ${r.location_id}`)
        .addTo(layers.current!.preview);
    });
    const b = L.latLngBounds(stops.map((r) => [r.latitude, r.longitude]));
    if (b.isValid()) mapRef.current.fitBounds(b, { padding: [40, 40] });
  }, [mapReady, stops, total, hasPlan]);

  // depot marker (draggable until a plan exists)
  useEffect(() => {
    const L = (window as any).L;
    if (!mapReady || !L || !layers.current || !depot) return;
    layers.current.depot.clearLayers();
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#0f172a;color:#fff;font:700 11px sans-serif;padding:5px 8px;border-radius:6px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">DEPOT</div>`,
      iconSize: [54, 26],
      iconAnchor: [27, 13],
    });
    const m = L.marker(depot, { icon, draggable: !hasPlan, zIndexOffset: 1000 }).addTo(layers.current.depot);
    m.bindTooltip(hasPlan ? "Depot" : "Drag to move the depot");
    m.on("dragend", () => { const p = m.getLatLng(); setDepot([p.lat, p.lng]); });
  }, [mapReady, depot, hasPlan]);

  function reset() {
    cancelAnimationFrame(rafRef.current);
    layers.current?.plan.clearLayers();
    setPlan(null);
    setStatus("idle");
    setProgress(0);
    setRoadFail(false);
  }

  async function generate() {
    const L = (window as any).L;
    if (!L || !layers.current || !depot || !stops.length) return;
    cancelAnimationFrame(rafRef.current);
    layers.current.plan.clearLayers();
    layers.current.preview.clearLayers();
    setStatus("routing");
    setProgress(0);
    setRoadFail(false);

    const crews = buildPlan(stops, depot, nCrews);

    // real road geometry from OSRM, falling back to straight legs
    let failed = false;
    const routes: RouteRes[] = await Promise.all(
      crews.map(async (c) => {
        const wps: LatLng[] = [depot, ...c.order.map((o) => [o.latitude, o.longitude] as LatLng), depot];
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 9000);
          const url = `https://router.project-osrm.org/route/v1/driving/${wps.map((w) => `${w[1]},${w[0]}`).join(";")}?overview=full&geometries=geojson`;
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(to);
          const j = await res.json();
          if (j.code === "Ok" && j.routes?.[0]) {
            return { coords: j.routes[0].geometry.coordinates.map(([lo, la]: number[]) => [la, lo] as LatLng), km: j.routes[0].distance / 1000, road: true };
          }
        } catch { }
        failed = true;
        return { coords: densify(wps), km: c.straightKm, road: false };
      })
    );
    setRoadFail(failed);
    setPlan({ crews, routes });
    setStatus("drawing");

    // build layers
    const map = mapRef.current;
    const bounds = L.latLngBounds(routes.flatMap((r) => r.coords));
    bounds.extend(depot);
    map.fitBounds(bounds, { padding: [40, 40] });

    const parts = crews.map((c, ci) => {
      const r = routes[ci];
      L.polyline(r.coords, { color: c.color, weight: 3, opacity: 0.18, dashArray: "4 8" }).addTo(layers.current!.plan);
      const line = L.polyline([], { color: c.color, weight: 5, opacity: 0.95 }).addTo(layers.current!.plan);
      const head = L.circleMarker(r.coords[0], { radius: 7, color: "#fff", weight: 2, fillColor: c.color, fillOpacity: 1 }).addTo(layers.current!.plan);
      const idx = indexStops(r.coords, c.order.map((o) => [o.latitude, o.longitude] as LatLng));
      return { c, r, line, head, idx, shown: new Array(c.order.length).fill(false) as boolean[] };
    });

    const dur = 9000;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 2);
      parts.forEach((p) => {
        const upto = Math.max(2, Math.floor(eased * p.r.coords.length));
        p.line.setLatLngs(p.r.coords.slice(0, upto));
        p.head.setLatLng(p.r.coords[Math.min(upto, p.r.coords.length) - 1]);
        p.c.order.forEach((o, j) => {
          if (!p.shown[j] && upto >= p.idx[j]) {
            p.shown[j] = true;
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:26px;height:26px;border-radius:50%;background:${p.c.color};color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)">${j + 1}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });
            L.marker([o.latitude, o.longitude], { icon, zIndexOffset: 500 })
              .bindTooltip(`Crew ${p.c.id + 1}, stop ${j + 1}: ${o.location_id} (priority #${o.priority_rank})`)
              .addTo(layers.current!.plan);
          }
        });
      });
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        parts.forEach((p) => p.head.remove());
        setStatus("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const stats = useMemo(() => {
    if (!plan) return null;
    const straight = plan.crews.reduce((s, c) => s + c.straightKm, 0);
    const naive = plan.crews.reduce((s, c) => s + c.naiveKm, 0);
    const road = plan.routes.reduce((s, r) => s + r.km, 0);
    return { straight, naive, road, saved: naive > 0 ? Math.max(0, ((naive - straight) / naive) * 100) : 0 };
  }, [plan]);

  const busy = status === "routing" || status === "drawing";

  return (
    <Card
      title="Deployment plan (shortest route for repair crews)"
      right={<span className="text-xs text-slate-500">Travelling salesman route, optimised with nearest neighbour + 2-opt</span>}
    >
      <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="text-sm text-slate-600">
          <span className="block text-xs text-slate-400">Sites to fix (top priority first)</span>
          <div className="flex items-center gap-2">
            <input type="range" min={4} max={Math.min(30, ranked.length || 30)} value={nStops} disabled={busy} onChange={(e) => { reset(); setNStops(Number(e.target.value)); }} />
            <b className="w-6 text-slate-900">{nStops}</b>
          </div>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block text-xs text-slate-400">Repair crews</span>
          <select className="rounded-md border bg-white px-2 py-1 text-sm" style={{ borderColor: "var(--border)" }} value={nCrews} disabled={busy} onChange={(e) => { reset(); setNCrews(Number(e.target.value)); }}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "crew" : "crews"}</option>)}
          </select>
        </label>
        <button
          onClick={generate}
          disabled={busy || !mapReady}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: TEAL.deep }}
        >
          <Icon name="route" size={16} />
          {status === "routing" ? "Finding roads..." : status === "drawing" ? "Drawing network..." : plan ? "Regenerate plan" : "Generate deployment plan"}
        </button>
        {plan && !busy && (
          <button onClick={reset} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
            Clear
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-md" style={{ border: "1px solid var(--border)", height: 520 }}>
        <div ref={hostRef} className="h-full w-full" />
        {status === "drawing" && (
          <div className="absolute bottom-3 left-3 right-3 rounded-md bg-white/95 px-3 py-2 shadow" style={{ zIndex: 1000 }}>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: TEAL.deep }} />
            </div>
          </div>
        )}
        {!plan && (
          <div className="absolute left-3 top-3 rounded-md bg-white/95 px-3 py-2 text-xs text-slate-600 shadow" style={{ zIndex: 1000 }}>
            Drag the DEPOT marker to where crews start from, then generate the plan.
          </div>
        )}
      </div>

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi value={`${stats.road.toFixed(1)} km`} label={plan!.routes.every((r) => r.road) ? "Total driving distance" : "Total distance (straight-line)"} color={TEAL.deep} />
            <Kpi value={plan!.crews.reduce((s, c) => s + c.order.length, 0)} label="Sites covered" color={TIER.high.color} />
            <Kpi value={`${stats.saved.toFixed(0)}%`} label="Shorter than visiting in priority order" color={TIER.low.color} />
            <Kpi value={fmtHours(Math.max(...plan!.crews.map((c, i) => plan!.routes[i].km / 25 + (c.order.length * 20) / 60)))} label="Estimated finish (longest crew)" color={TIER.medium.color} />
          </div>
          {roadFail && <p className="mt-2 text-xs text-amber-700">Road routing service was unreachable for some crews, so those paths are straight lines between stops.</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {plan!.crews.map((c, ci) => {
              const rt = plan!.routes[ci];
              return (
                <div key={c.id} className="rounded-lg border bg-white p-3" style={{ borderColor: "var(--border)", borderTop: `4px solid ${c.color}` }}>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      <span style={{ color: c.color }}><Icon name="truck" size={18} /></span> Crew {c.id + 1}
                    </p>
                    <span className="text-xs text-slate-500">{c.order.length} stops · {rt.km.toFixed(1)} km · {fmtHours(rt.km / 25 + (c.order.length * 20) / 60)}</span>
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {c.order.map((o, j) => (
                      <li key={o.location_id} className="flex items-center gap-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: c.color }}>{j + 1}</span>
                        <span className="font-medium text-slate-900">{o.location_id}</span>
                        <span className="text-slate-400">{clean(o.zone)}</span>
                        <span className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: TIER[tierByFraction(o.priority_rank / total)].bg, color: TIER[tierByFraction(o.priority_rank / total)].color }}>
                          #{o.priority_rank}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Sites are split between crews by location (k-means), then each crew gets a closed tour from the depot that is optimised with nearest neighbour and 2-opt. Time assumes 25 km/h average speed and 20 minutes per repair.
          </p>
        </>
      )}
    </Card>
  );
}

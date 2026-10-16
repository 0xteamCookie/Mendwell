"use client";

import { useEffect, useMemo, useState } from "react";

type M1 = {
  location_id: string;
  zone: string;
  latitude: number;
  longitude: number;
  road_type: string;
  road_condition: string;
  near_school: number;
  near_hospital: number;
  pedestrian_activity: string;
  incident_count: number;
  complaint_count: number;
  injury_count: number;
  predicted: number;
  band_low: number;
  band_high: number;
  band_width: number;
  confidence: "high" | "medium" | "low";
  explanation: string;
  priority_rank: number;
};

type M3 = {
  location_id: string;
  zone: string;
  incident_count: number;
  complaint_count: number;
  divergence: number;
  divergence_category: string;
  explanation: string;
  rank: number;
};

const TEAL = { light: "#a7eef7", mid: "#22d3ee", deep: "#0e7490", ink: "#0b4f5e" };

// Priority = traffic lights. Red high, yellow medium, green low.
type Tier = "high" | "medium" | "low";
const TIER: Record<Tier, { label: string; color: string; bg: string; ring: string }> = {
  high: { label: "High priority", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" },
  medium: { label: "Medium priority", color: "#d97706", bg: "#fffbeb", ring: "#fde68a" },
  low: { label: "Low priority", color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
};
function tierByFraction(frac: number): Tier {
  return frac <= 1 / 3 ? "high" : frac <= 2 / 3 ? "medium" : "low";
}

const CONF = {
  high: { label: "High confidence", dot: TEAL.deep, note: "The model is sure about this one." },
  medium: { label: "Medium confidence", dot: TEAL.mid, note: "Reasonably sure, worth a look." },
  low: { label: "Low confidence", dot: TEAL.light, note: "Limited data here, verify before acting." },
};

function reasonText(r: M1) {
  const bits: string[] = [];
  if (r.road_condition === "Poor" || r.road_condition === "Critical") bits.push(`${r.road_condition.toLowerCase()} road surface`);
  if (r.pedestrian_activity === "High") bits.push("heavy foot traffic");
  if (r.near_school) bits.push("next to a school");
  if (r.near_hospital) bits.push("next to a hospital");
  if (r.injury_count > 0) bits.push(`${r.injury_count} recorded injuries`);
  if (r.incident_count > 0) bits.push(`${r.incident_count} past incidents`);
  if (r.complaint_count > 0) bits.push(`${r.complaint_count} public complaints`);
  return bits.length ? bits.join(", ") : "a mix of smaller risk factors";
}

function Pill({ conf }: { conf: "high" | "medium" | "low" }) {
  const c = CONF[conf];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>
      <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function TierTag({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: t.bg, color: t.color, border: `1px solid ${t.ring}` }}>
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-md border" style={{ borderColor: "var(--border)" }}>
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">&#9656;</span>
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1 text-sm text-slate-600">{children}</div>
    </details>
  );
}

// Load Leaflet from CDN once (no npm install needed)
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.querySelector('link[data-leaflet]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.setAttribute("data-leaflet", "1");
    document.head.appendChild(link);
  }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve((window as any).L);
    document.body.appendChild(s);
  });
}

function MapView({ points }: { points: M1[] }) {
  useEffect(() => {
    if (!points.length) return;
    let map: any;
    let cancelled = false;
    const total = points.length;
    loadLeaflet().then((L) => {
      if (cancelled) return;
      const el = document.getElementById("priority-map");
      if (!el || (el as any)._leaflet_id) return;
      map = L.map("priority-map", { scrollWheelZoom: false }).setView([16.51, 80.62], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      points.forEach((p) => {
        const tier = tierByFraction(p.priority_rank / total);
        const color = TIER[tier].color;
        const radius = tier === "high" ? 6 : tier === "medium" ? 5 : 4;
        L.circleMarker([p.latitude, p.longitude], {
          radius,
          color: "#ffffff",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.85,
        })
          .addTo(map)
          .bindPopup(
            `<b>#${p.priority_rank} ${p.location_id}</b><br/>${p.zone}<br/>${TIER[tier].label}<br/>${p.road_condition} road, ${p.pedestrian_activity} foot traffic<br/>${p.incident_count} incidents, ${p.complaint_count} complaints`
          );
      });
    });
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [points]);

  return <div id="priority-map" className="w-full" style={{ height: 440 }} />;
}

// Priority bands: each location is a dot at its predicted priority (Y),
// with a whisker from band_low to band_high. Sorted most-urgent first.
function BandChart({ data }: { data: M1[] }) {
  const pts = useMemo(() => [...data].sort((a, b) => b.predicted - a.predicted), [data]);
  if (!pts.length) return <p className="p-4 text-sm text-slate-400">Loading priority bands...</p>;

  const n = pts.length;
  const W = 1000, H = 380, mL = 52, mR = 16, mT = 14, mB = 40;
  const pw = W - mL - mR, ph = H - mT - mB;
  let yMin = Infinity, yMax = -Infinity;
  pts.forEach((p) => { yMin = Math.min(yMin, p.band_low); yMax = Math.max(yMax, p.band_high); });
  const pad = (yMax - yMin) * 0.04;
  yMin -= pad; yMax += pad;
  const total = n;

  const x = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * pw);
  const y = (v: number) => mT + ((yMax - v) / (yMax - yMin)) * ph;

  const ticks: number[] = [];
  const steps = 5;
  for (let k = 0; k <= steps; k++) ticks.push(yMin + ((yMax - yMin) * k) / steps);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }} role="img" aria-label="Priority bands by location">
        {/* grid + y ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={mL} x2={W - mR} y1={y(t)} y2={y(t)} stroke="#eef2f6" strokeWidth={1} />
            <text x={mL - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill="#94a3b8">{t.toFixed(1)}</text>
          </g>
        ))}
        {/* zero line */}
        {yMin < 0 && yMax > 0 && (
          <line x1={mL} x2={W - mR} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" />
        )}
        {/* bands (whiskers) */}
        {pts.map((p, i) => {
          const c = TIER[tierByFraction(p.priority_rank / total)].color;
          return <line key={`b${p.location_id}`} x1={x(i)} x2={x(i)} y1={y(p.band_low)} y2={y(p.band_high)} stroke={c} strokeWidth={1} opacity={0.16} />;
        })}
        {/* predicted dots */}
        {pts.map((p, i) => {
          const c = TIER[tierByFraction(p.priority_rank / total)].color;
          return <circle key={`d${p.location_id}`} cx={x(i)} cy={y(p.predicted)} r={1.8} fill={c} opacity={0.9} />;
        })}
        {/* axis labels */}
        <text x={mL} y={H - 10} fontSize={13} fill="#64748b">most urgent</text>
        <text x={W - mR} y={H - 10} textAnchor="end" fontSize={13} fill="#64748b">least urgent</text>
        <text transform={`translate(14 ${mT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#64748b">priority score</text>
      </svg>
    </div>
  );
}

function Segmented({ segments }: { segments: { label: string; value: number; color: string; sub?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded" style={{ border: "1px solid var(--border)" }}>
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="font-semibold text-slate-800">{Math.round((s.value / total) * 100)}%</span>
            <span className="text-slate-600">{s.label}</span>
            {s.sub && <span className="text-slate-400">{s.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border)" }}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {right}
        </div>
      )}
      <div className={title ? "px-4 pb-4" : "p-4"}>{children}</div>
    </div>
  );
}

export default function Page() {
  const [m1, setM1] = useState<M1[]>([]);
  const [m3, setM3] = useState<M3[]>([]);

  useEffect(() => {
    fetch("/data/module1_priority.json").then((r) => r.json()).then(setM1).catch(() => {});
    fetch("/data/module3_divergence.json").then((r) => r.json()).then(setM3).catch(() => {});
  }, []);

  const total = m1.length;
  const ranked = useMemo(() => [...m1].sort((a, b) => a.priority_rank - b.priority_rank), [m1]);
  const topPriority = useMemo(() => ranked.slice(0, 12), [ranked]);

  const counts = useMemo(() => {
    let high = 0, med = 0, low = 0;
    m1.forEach((r) => { const t = tierByFraction(r.priority_rank / total); if (t === "high") high++; else if (t === "medium") med++; else low++; });
    const conf = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    m1.forEach((r) => (conf[r.confidence] += 1));
    return { high, med, low, conf };
  }, [m1, total]);

  const seg = useMemo(() => {
    const blind = m3.filter((r) => r.divergence_category === "potential_blind_spot").length;
    const gap = m3.filter((r) => r.divergence_category === "potential_reporting_gap").length;
    const aligned = m3.filter((r) => r.divergence_category === "signals_aligned").length;
    return { blind, gap, aligned };
  }, [m3]);

  const blindSpots = useMemo(
    () => m3.filter((r) => r.divergence_category === "potential_blind_spot").sort((a, b) => b.divergence - a.divergence).slice(0, 8),
    [m3]
  );

  const zones = useMemo(() => {
    const g = new Map<string, M1[]>();
    m1.forEach((r) => { if (!g.has(r.zone)) g.set(r.zone, []); g.get(r.zone)!.push(r); });
    const arr = [...g.entries()].map(([zone, items]) => ({
      zone,
      avg: items.reduce((s, r) => s + r.predicted, 0) / items.length,
      count: items.length,
      inc: items.reduce((s, r) => s + r.incident_count, 0),
      comp: items.reduce((s, r) => s + r.complaint_count, 0),
      inj: items.reduce((s, r) => s + r.injury_count, 0),
    })).sort((a, b) => b.avg - a.avg);
    const nz = arr.length || 1;
    return arr.map((z, i) => ({ ...z, rank: i + 1, tier: tierByFraction((i + 1) / nz) as Tier }));
  }, [m1]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Where Should We Fix First</h1>
        <p className="mt-2 max-w-3xl text-base" style={{ color: "var(--ink-500)" }}>
          A daily worklist for city road teams. It ranks which locations to send a crew to first, explains why, and flags places the official data is missing.
        </p>
      </header>

      {/* MAP — first thing */}
      <section className="mt-6">
        <Card
          title="Priority map (Vijayawada and Amaravati)"
          right={
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.high.color }} /> high</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.medium.color }} /> medium</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.low.color }} /> low</span>
            </div>
          }
        >
          <div className="overflow-hidden rounded-md" style={{ border: "1px solid var(--border)" }}>
            <MapView points={ranked} />
          </div>
        </Card>
      </section>

      {/* KPI row */}
      <section className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi value={total || "..."} label="Locations analysed" color={TEAL.deep} />
        <Kpi value={counts.high || "..."} label="High priority" color={TIER.high.color} />
        <Kpi value={seg.blind || "..."} label="Reporting blind spots" color={TIER.medium.color} />
        <Kpi value={counts.conf.high || "..."} label="High confidence scores" color={TEAL.deep} />
      </section>

      {/* Band chart */}
      <section className="mt-5">
        <Card
          title="Priority bands across all locations"
          right={
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" /> dot = predicted</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-slate-400" /> band = 5 to 95% range</span>
            </div>
          }
        >
          <BandChart data={m1} />
          <p className="mt-1 text-xs text-slate-500">Each dot is one location. A taller band means the model is less certain about that score.</p>
        </Card>
      </section>

      {/* Two up: zones + distributions */}
      <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Zones ranked by priority">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {zones.map((z) => (
                <div key={z.zone} className="rounded-md border bg-white p-3" style={{ borderColor: "var(--border)", borderLeft: `4px solid ${TIER[z.tier].color}` }}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{z.zone.replace("_", " ")}</p>
                    <TierTag tier={z.tier} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {z.count} locations · {z.inc} incidents · {z.comp} complaints · {z.inj} injuries
                  </p>
                </div>
              ))}
              {!zones.length && <p className="text-sm text-slate-400">Loading zones...</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Priority mix">
            <Segmented
              segments={[
                { label: "High priority", value: counts.high, color: TIER.high.color },
                { label: "Medium priority", value: counts.med, color: TIER.medium.color },
                { label: "Low priority", value: counts.low, color: TIER.low.color },
              ]}
            />
          </Card>
          <Card title="Complaints vs real risk">
            <Segmented
              segments={[
                { label: "Blind spots", value: seg.blind, color: TEAL.deep, sub: "loud, low logged risk" },
                { label: "Aligned", value: seg.aligned, color: TEAL.light },
                { label: "Reporting gaps", value: seg.gap, color: TEAL.mid, sub: "quiet, real risk" },
              ]}
            />
          </Card>
          <Card title="Model confidence">
            <Segmented
              segments={[
                { label: "High confidence", value: counts.conf.high, color: TEAL.deep },
                { label: "Medium", value: counts.conf.medium, color: TEAL.mid },
                { label: "Low", value: counts.conf.low, color: TEAL.light },
              ]}
            />
          </Card>
        </div>
      </section>

      {/* Fix first list */}
      <section className="mt-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Fix these first</h2>
        <div className="space-y-3">
          {topPriority.map((r) => {
            const tier = tierByFraction(r.priority_rank / total);
            return (
              <div key={r.location_id} className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderLeft: `4px solid ${TIER[tier].color}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TIER[tier].color }}>
                      {r.priority_rank}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {r.location_id} <span className="font-normal text-slate-500">in {r.zone.replace("_", " ")}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">Flagged for {reasonText(r)}.</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <TierTag tier={tier} />
                    <Pill conf={r.confidence} />
                  </div>
                </div>
                <Collapsible title="Model details">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <span>Predicted priority: <b>{r.predicted.toFixed(2)}</b></span>
                    <span>Range: <b>{r.band_low.toFixed(2)} to {r.band_high.toFixed(2)}</b></span>
                    <span>Road: <b>{r.road_type}, {r.road_condition}</b></span>
                    <span>Foot traffic: <b>{r.pedestrian_activity}</b></span>
                    <span>Incidents: <b>{r.incident_count}</b></span>
                    <span>Complaints: <b>{r.complaint_count}</b></span>
                  </div>
                  <p className="mt-2 text-slate-500">{CONF[r.confidence].note} A narrower range means more confidence.</p>
                </Collapsible>
              </div>
            );
          })}
          {!topPriority.length && <p className="text-sm text-slate-400">Loading priorities...</p>}
        </div>
      </section>

      {/* Blind spots */}
      <section className="mt-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Blind spots worth a site visit</h2>
        <p className="mb-3 text-sm text-slate-600">Locations where the public complains far more than the official incident log shows. The data may be under-recording a real problem.</p>
        <div className="space-y-2">
          {blindSpots.map((r) => (
            <div key={r.location_id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="font-semibold text-slate-900">{r.location_id} <span className="font-normal text-slate-500">in {r.zone.replace("_", " ")}</span></p>
                <p className="text-sm text-slate-600">{r.complaint_count} complaints but only {r.incident_count} official incidents logged.</p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>likely under-recorded</span>
            </div>
          ))}
          {!blindSpots.length && <p className="text-sm text-slate-400">Loading blind spots...</p>}
        </div>
      </section>

      <Collapsible title="Technical details and methodology">
        <ul className="list-disc space-y-1 pl-5">
          <li>Module 1: three quantile gradient boosting regressors (5th, 50th, 95th percentile) predict a priority band from location context only, so sparse locations still get a usable estimate.</li>
          <li>Confidence comes from the width of that band, split into terciles across all locations.</li>
          <li>Module 3: weighted incidents and complaints are z-scored per location, and their difference (divergence) flags over and under reporting.</li>
          <li>Priority tiers (high, medium, low) split the ranked locations into equal thirds.</li>
          <li>Data is synthetic and for demonstration only, not real civic records.</li>
        </ul>
      </Collapsible>
    </main>
  );
}

function Kpi({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderTop: `3px solid ${color}` }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-sm text-slate-600">{label}</p>
    </div>
  );
}

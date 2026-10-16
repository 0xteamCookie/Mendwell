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

const OPTIONS = {
  road_type: ["Local", "Collector", "Arterial", "Residential", "Highway"],
  road_condition: ["Good", "Fair", "Poor", "Critical"],
  pedestrian_activity: ["Low", "Medium", "High"],
};

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
        const tier = p.priority_rank <= 20 ? 0 : p.priority_rank <= 60 ? 1 : 2;
        const color = tier === 0 ? "#0e7490" : tier === 1 ? "#22d3ee" : "#a7eef7";
        const radius = tier === 0 ? 9 : tier === 1 ? 7 : 5;
        L.circleMarker([p.latitude, p.longitude], {
          radius,
          color: "#ffffff",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<b>#${p.priority_rank} ${p.location_id}</b><br/>${p.zone}<br/>${p.road_condition} road, ${p.pedestrian_activity} foot traffic<br/>${p.incident_count} incidents, ${p.complaint_count} complaints`
          );
      });
    });
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [points]);

  return <div id="priority-map" className="w-full" style={{ height: 340 }} />;
}

type Tab = "fix" | "investigate" | "check";

export default function Page() {
  const [m1, setM1] = useState<M1[]>([]);
  const [m3, setM3] = useState<M3[]>([]);
  const [tab, setTab] = useState<Tab>("fix");
  const [form, setForm] = useState({ road_type: "Local", road_condition: "Poor", pedestrian_activity: "High", near_school: 1, near_hospital: 0 });

  useEffect(() => {
    fetch("/data/module1_priority.json").then((r) => r.json()).then(setM1).catch(() => {});
    fetch("/data/module3_divergence.json").then((r) => r.json()).then(setM3).catch(() => {});
  }, []);

  const topPriority = useMemo(() => [...m1].sort((a, b) => a.priority_rank - b.priority_rank).slice(0, 10), [m1]);
  const mapPoints = useMemo(() => [...m1].sort((a, b) => a.priority_rank - b.priority_rank).slice(0, 150), [m1]);
  const needAttention = useMemo(() => m1.filter((r) => r.confidence !== "low" && r.priority_rank <= 150).length, [m1]);

  const prediction = useMemo(() => {
    if (!m1.length) return null;
    const exact = m1.filter(
      (r) => r.road_type === form.road_type && r.road_condition === form.road_condition && r.pedestrian_activity === form.pedestrian_activity && r.near_school === form.near_school && r.near_hospital === form.near_hospital
    );
    const pool = exact.length >= 3 ? exact : m1.filter((r) => r.road_condition === form.road_condition && r.pedestrian_activity === form.pedestrian_activity);
    const base = pool.length ? pool : m1;
    const avg = (f: (r: M1) => number) => base.reduce((s, r) => s + f(r), 0) / base.length;
    const predicted = avg((r) => r.predicted), low = avg((r) => r.band_low), high = avg((r) => r.band_high);
    const width = high - low;
    const widths = [...m1].map((r) => r.band_width).sort((a, b) => a - b);
    const q33 = widths[Math.floor(widths.length / 3)], q66 = widths[Math.floor((2 * widths.length) / 3)];
    const confidence = (width <= q33 ? "high" : width <= q66 ? "medium" : "low") as "high" | "medium" | "low";
    const sorted = [...m1].map((r) => r.predicted).sort((a, b) => b - a);
    const rank = sorted.filter((p) => p > predicted).length + 1;
    const pct = Math.round((1 - rank / m1.length) * 100);
    return { predicted, low, high, confidence, matched: base.length, pct };
  }, [m1, form]);

  const seg = useMemo(() => {
    const total = m3.length || 1;
    const over = m3.filter((r) => r.divergence_category === "potential_blind_spot").length;
    const under = m3.filter((r) => r.divergence_category === "potential_reporting_gap").length;
    const pct = (n: number) => Math.round((n / total) * 100);
    return { over, under, total, overP: pct(over), underP: pct(under) };
  }, [m3]);

  const blindSpots = useMemo(() => m3.filter((r) => r.divergence_category === "potential_blind_spot").sort((a, b) => b.divergence - a.divergence).slice(0, 8), [m3]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Where Should We Fix First</h1>
        <p className="mt-2 max-w-2xl text-base" style={{ color: "var(--ink-500)" }}>
          A daily worklist for city road teams. It ranks which locations to send a crew to first, explains why, and flags places the official data is missing.
        </p>
        <Collapsible title="How this works">
          <ul className="list-disc space-y-1 pl-5">
            <li>We combined 1,000 locations, 10,000 incidents and 8,000 public complaints into one record per location.</li>
            <li>A model learns which road conditions lead to high priority, so it can score even a new road with no history.</li>
            <li>A second check compares complaints against real incidents to find reporting blind spots.</li>
            <li>Every score comes with a confidence level, so you know when to trust it and when to verify.</li>
          </ul>
        </Collapsible>
      </header>

      {/* Headline state */}
      <div className="mt-6 rounded-lg border bg-white p-5" style={{ borderColor: "var(--border)", borderLeft: `4px solid ${TEAL.mid}` }}>
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>Today</p>
        <p className="mt-1 text-lg text-slate-800">
          <span className="text-2xl font-bold" style={{ color: TEAL.deep }}>{needAttention || "..."}</span> locations need attention, and{" "}
          <span className="text-2xl font-bold" style={{ color: TEAL.deep }}>{seg.over + seg.under || "..."}</span> have complaints that do not match the real risk.
        </p>
      </div>

      {/* Tabs */}
      <nav className="mt-6 flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {([["fix", "Fix first"], ["investigate", "Investigate"], ["check", "Check a location"]] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-4 py-2.5 text-sm font-semibold"
            style={tab === k ? { color: TEAL.deep, borderBottom: `2px solid ${TEAL.deep}` } : { color: "var(--ink-400)" }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* FIX FIRST */}
      {tab === "fix" && (
        <section className="mt-5 space-y-3">
          {topPriority.map((r) => (
            <div key={r.location_id} className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TEAL.deep }}>
                    {r.priority_rank}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {r.location_id} <span className="font-normal text-slate-500">in {r.zone}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">Flagged for {reasonText(r)}.</p>
                  </div>
                </div>
                <Pill conf={r.confidence} />
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
          ))}
          {!topPriority.length && <p className="text-sm text-slate-400">Loading priorities...</p>}

          <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Priority map (Vijayawada and Amaravati)</p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL.deep }} /> top 20</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL.mid }} /> top 60</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL.light }} /> top 150</span>
              </div>
            </div>
            <MapView points={mapPoints} />
          </div>
        </section>
      )}

      {/* INVESTIGATE */}
      {tab === "investigate" && (
        <section className="mt-5">
          <div className="rounded-lg border bg-white p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-slate-800">
              <b>{seg.overP}%</b> of locations are over-reported (loud complaints, low real risk) and <b>{seg.underP}%</b> are under-reported (real risk, few complaints). The under-reported ones are the dangerous blind spots.
            </p>
          </div>
          <p className="mt-5 mb-2 text-sm font-semibold text-slate-700">Blind spots worth a site visit</p>
          <div className="space-y-2">
            {blindSpots.map((r) => (
              <div key={r.location_id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="font-semibold text-slate-900">{r.location_id} <span className="font-normal text-slate-500">in {r.zone}</span></p>
                  <p className="text-sm text-slate-600">{r.complaint_count} complaints but only {r.incident_count} official incidents logged.</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>likely under-recorded</span>
              </div>
            ))}
            {!blindSpots.length && <p className="text-sm text-slate-400">Loading blind spots...</p>}
          </div>
        </section>
      )}

      {/* CHECK A LOCATION */}
      {tab === "check" && (
        <section className="mt-5">
          <div className="rounded-lg border bg-white p-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm text-slate-600">
              Describe any road, even a brand new one with no incident history. The model estimates how urgent it is from its characteristics.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Select label="Road type" value={form.road_type} opts={OPTIONS.road_type} onChange={(v) => setForm({ ...form, road_type: v })} />
              <Select label="Road condition" value={form.road_condition} opts={OPTIONS.road_condition} onChange={(v) => setForm({ ...form, road_condition: v })} />
              <Select label="Foot traffic" value={form.pedestrian_activity} opts={OPTIONS.pedestrian_activity} onChange={(v) => setForm({ ...form, pedestrian_activity: v })} />
              <Select label="Near a school" value={String(form.near_school)} opts={["0", "1"]} onChange={(v) => setForm({ ...form, near_school: Number(v) })} />
              <Select label="Near a hospital" value={String(form.near_hospital)} opts={["0", "1"]} onChange={(v) => setForm({ ...form, near_hospital: Number(v) })} />
            </div>
          </div>

          {prediction && (
            <div className="mt-4 rounded-lg p-5" style={{ background: "var(--teal-50)" }}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-800">
                  This road ranks higher than about <span className="text-2xl font-bold" style={{ color: TEAL.deep }}>{prediction.pct}%</span> of the city.
                </p>
                <Pill conf={prediction.confidence} />
              </div>
              <Collapsible title="Model details">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span>Predicted priority: <b>{prediction.predicted.toFixed(2)}</b></span>
                  <span>Range: <b>{prediction.low.toFixed(2)} to {prediction.high.toFixed(2)}</b></span>
                  <span>Based on: <b>{prediction.matched} similar locations</b></span>
                </div>
              </Collapsible>
            </div>
          )}
        </section>
      )}

      <Collapsible title="Technical details and methodology">
        <ul className="list-disc space-y-1 pl-5">
          <li>Module 1: three quantile gradient boosting regressors (5th, 50th, 95th percentile) predict a priority band from location context only, so sparse locations still get a usable estimate.</li>
          <li>Confidence comes from the width of that band, split into terciles across all locations.</li>
          <li>Module 3: weighted incidents and complaints are z-scored per location, and their difference (divergence) flags over and under reporting.</li>
          <li>The location check uses nearest-match lookup over the scored locations for instant in-browser inference.</li>
          <li>Data is synthetic and for demonstration only, not real civic records.</li>
        </ul>
      </Collapsible>
    </main>
  );
}

function Select({ label, value, opts, onChange }: { label: string; value: string; opts: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type M1 = {
  location_id: string;
  zone: string;
  road_type: string;
  road_condition: string;
  pedestrian_activity: string;
  incident_count: number;
  complaint_count: number;
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

const TEAL = {
  light: "#a7eef7",
  mid: "#22d3ee",
  deep: "#0e7490",
  ink: "#0b4f5e",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-white p-5 ${className}`} style={{ borderColor: "var(--border)" }}>
      {children}
    </div>
  );
}

function StatTile({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-white p-5 border-l-4" style={{ borderColor: "var(--border)", borderLeftColor: TEAL.mid }}>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: TEAL.deep }}>{value}</span>
        <span className="text-base font-semibold text-slate-800">{label}</span>
      </div>
      <p className="mt-2 text-sm leading-snug" style={{ color: "var(--ink-500)" }}>{sub}</p>
    </div>
  );
}

function LegendRow({ color, pct, label }: { color: string; pct: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="font-semibold text-slate-800">{pct}%</span>
      <span className="text-slate-600">{label}</span>
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

  const topPriority = useMemo(
    () => [...m1].sort((a, b) => a.priority_rank - b.priority_rank).slice(0, 12),
    [m1]
  );

  const seg = useMemo(() => {
    const total = m3.length || 1;
    const over = m3.filter((r) => r.divergence_category === "potential_blind_spot").length;
    const under = m3.filter((r) => r.divergence_category === "potential_reporting_gap").length;
    const aligned = total - over - under;
    const pct = (n: number) => Math.round((n / total) * 1000) / 10;
    return { over, under, aligned, total, overP: pct(over), underP: pct(under), alignedP: pct(aligned) };
  }, [m3]);

  const mismatchP = useMemo(
    () => Math.round(((seg.over + seg.under) / (seg.total || 1)) * 100),
    [seg]
  );

  const blindSpots = useMemo(
    () =>
      m3
        .filter((r) => r.divergence_category === "potential_blind_spot")
        .sort((a, b) => b.divergence - a.divergence)
        .slice(0, 6),
    [m3]
  );

  const scale = useMemo(() => {
    if (!m1.length) return { min: 0, max: 1 };
    return { min: Math.min(...m1.map((r) => r.band_low)), max: Math.max(...m1.map((r) => r.band_high)) };
  }, [m1]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="text-2xl" style={{ color: TEAL.deep }}>&#10070;</span>
        <h1 className="text-3xl font-bold tracking-tight underline decoration-2 underline-offset-4">
          Where Should We Fix First
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatTile value="1,000" label="Locations" sub="road type and condition, pedestrian activity, near school or hospital, lat and long" />
        <StatTile value="10,000" label="Incidents" sub="severity, injuries, resolution hours and resolved flag, across Jan to Dec 2025" />
        <StatTile value="8,000" label="Public complaints" sub="category, reported priority, status and days to resolution" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Priority ranking with confidence (Module 1)</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
            Each location gets a predicted priority and a range. A narrow bar means the model is confident.
          </p>

          <div className="mt-5 space-y-3">
            {topPriority.map((r) => {
              const span = scale.max - scale.min || 1;
              const left = ((r.band_low - scale.min) / span) * 100;
              const width = ((r.band_high - r.band_low) / span) * 100;
              const mid = ((r.predicted - scale.min) / span) * 100;
              const confColor = r.confidence === "high" ? TEAL.deep : r.confidence === "medium" ? TEAL.mid : TEAL.light;
              return (
                <div key={r.location_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800">
                      #{r.priority_rank} &nbsp; {r.location_id}
                      <span className="ml-2 font-normal text-slate-500">
                        {r.zone} &middot; {r.road_condition} road
                      </span>
                    </span>
                    <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>
                      {r.confidence} confidence
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-3 w-full rounded-full" style={{ background: "#eef2f5" }}>
                    <div className="absolute top-0 h-3 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: TEAL.light }} />
                    <div className="absolute top-[-2px] h-5 w-1 rounded" style={{ left: `${mid}%`, background: confColor }} />
                  </div>
                </div>
              );
            })}
            {!topPriority.length && <p className="text-sm text-slate-400">Loading priority data...</p>}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900">Complaints vs real risk (Module 3)</h2>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold" style={{ color: TEAL.deep }}>{mismatchP}%</span>
            <span className="text-base font-semibold text-slate-800">of locations</span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
            have complaints that do not match real incident risk.
          </p>

          <div className="mt-5 flex h-6 w-full overflow-hidden rounded">
            <div style={{ width: `${seg.overP}%`, background: TEAL.light }} />
            <div style={{ width: `${seg.alignedP}%`, background: TEAL.mid }} />
            <div style={{ width: `${seg.underP}%`, background: TEAL.deep }} />
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <LegendRow color={TEAL.light} pct={seg.overP} label="Over-reported: loud complaints, low real risk" />
            <LegendRow color={TEAL.mid} pct={seg.alignedP} label="Aligned: complaints track real risk" />
            <LegendRow color={TEAL.deep} pct={seg.underP} label="Under-reported: real risk, few complaints" />
          </div>

          <h3 className="mt-6 text-sm font-bold text-slate-900">Top blind spots to investigate</h3>
          <div className="mt-2 space-y-2">
            {blindSpots.map((r) => (
              <div key={r.location_id} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold text-slate-800">{r.location_id}</span>
                <span className="ml-2 text-slate-500">{r.zone}</span>
                <span className="ml-2 text-slate-600">
                  {r.complaint_count} complaints, {r.incident_count} logged incidents
                </span>
              </div>
            ))}
            {!blindSpots.length && <p className="text-sm text-slate-400">Loading divergence data...</p>}
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs" style={{ color: "var(--ink-400)" }}>
        Smart City prototype. Module 1 priority ranking and Module 3 blind-spot detection. Data is synthetic and for demonstration only.
      </p>
    </main>
  );
}

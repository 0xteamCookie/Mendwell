"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { M1, M3, M2, Risk, Composite, Row, Tier } from "./lib/types";
import { TEAL, TIER, TONE, tierByFraction, clean, reasonText, factsOf, congLabel } from "./lib/theme";
import { Icon } from "./components/icons";
import { FactTile, Pill, TierTag, Card, Kpi, Segmented } from "./components/ui";
import { ScoreBar } from "./components/ScoreBar";
import { LocationCard } from "./components/LocationCard";
import { MapView } from "./components/MapView";
import { City3D } from "./components/City3D";
import { DeployMap } from "./components/DeployMap";
import { BandChart } from "./components/BandChart";
import { FusedQueue } from "./components/FusedQueue";

export default function Page() {
  const [m1, setM1] = useState<M1[]>([]);
  const [m3, setM3] = useState<M3[]>([]);
  const [m2, setM2] = useState<M2[]>([]);
  const [risk, setRisk] = useState<Risk[]>([]);
  const [composite, setComposite] = useState<Composite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(12);
  const mapSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/module1_priority.json").then((r) => r.json()).then(setM1).catch(() => { });
    fetch("/data/module3_divergence.json").then((r) => r.json()).then(setM3).catch(() => { });
    fetch("/data/module2_traffic.json").then((r) => r.json()).then(setM2).catch(() => { });
    fetch("/data/module2_risk.json").then((r) => r.json()).then(setRisk).catch(() => { });
    fetch("/data/composite_priority.json").then((r) => r.json()).then(setComposite).catch(() => { });
  }, []);

  const total = m1.length;
  const m2map = useMemo(() => new Map(m2.map((r) => [r.location_id, r])), [m2]);
  const riskMap = useMemo(() => new Map(risk.map((r) => [r.location_id, r])), [risk]);
  const ranked = useMemo<Row[]>(
    () => [...m1].sort((a, b) => a.priority_rank - b.priority_rank).map((r) => ({ ...r, tt: m2map.get(r.location_id), risk: riskMap.get(r.location_id) })),
    [m1, m2map, riskMap]
  );
  const byId = useMemo(() => new Map(ranked.map((r) => [r.location_id, r])), [ranked]);
  const selected = selectedId ? byId.get(selectedId) || null : null;
  const scale = useMemo(() => {
    let min = Infinity, max = -Infinity;
    m1.forEach((r) => { min = Math.min(min, r.band_low); max = Math.max(max, r.band_high); });
    return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
  }, [m1]);

  function pick(id: string) {
    setSelectedId(id);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const trafficMeasured = useMemo(() => m2.filter((r) => r.congestion !== null).length, [m2]);

  const counts = useMemo(() => {
    let high = 0, med = 0, low = 0;
    m1.forEach((r) => { const t = tierByFraction(r.priority_rank / total); if (t === "high") high++; else if (t === "medium") med++; else low++; });
    return { high, med, low };
  }, [m1, total]);

  const riskStats = useMemo(() => {
    const c = { elevated: 0, moderate: 0, low: 0 } as Record<string, number>;
    risk.forEach((r) => { c[r.risk_label] = (c[r.risk_label] || 0) + 1; });
    return c;
  }, [risk]);

  const seg = useMemo(() => ({
    blind: m3.filter((r) => r.divergence_category === "potential_blind_spot").length,
    gap: m3.filter((r) => r.divergence_category === "potential_reporting_gap").length,
    aligned: m3.filter((r) => r.divergence_category === "signals_aligned").length,
  }), [m3]);

  const blindSpots = useMemo(
    () => m3.filter((r) => r.divergence_category === "potential_blind_spot").sort((a, b) => b.divergence - a.divergence).slice(0, 8),
    [m3]
  );

  const legend = (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.high.color }} /> high</span>
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.medium.color }} /> medium</span>
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.low.color }} /> low</span>
    </div>
  );

  const selTier: Tier = selected ? tierByFraction(selected.priority_rank / total) : "low";

  return (
    <>
      <section className="relative w-full overflow-hidden" style={{ height: "100vh", minHeight: 560, background: "#0b1220" }}>
        <City3D rows={ranked} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="pointer-events-none absolute inset-x-0 top-0 p-5 sm:p-8" style={{ zIndex: 5, background: "linear-gradient(to bottom, rgba(11,18,32,0.92), rgba(11,18,32,0))" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL.mid }}>Municipal road-safety dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-5xl">Where Should We Fix First</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
            Every tower is a location in Vijayawada and Amaravati. The taller and redder it is, the sooner a crew should get there. Click a tower for its summary.
          </p>
        </div>

        <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-200" style={{ zIndex: 5 }}>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.high.color }} /> high</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.medium.color }} /> medium</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.low.color }} /> low</span>
        </div>

        <button
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-900"
          style={{ zIndex: 5 }}
        >
          Scroll for map, deployment plan and priority list &#8595;
        </button>

        {selected && <LocationCard r={selected} tier={selTier} scale={scale} onClose={() => setSelectedId(null)} />}
      </section>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <p className="text-right text-xs text-slate-400">Synthetic data, for demonstration only</p>

        <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi value={total || "..."} label="Locations analysed" color={TEAL.deep} />
          <Kpi value={counts.high || "..."} label="High priority" color={TIER.high.color} />
          <Kpi value={riskStats.elevated || "..."} label="Elevated risk next week" color={TIER.medium.color} />
          <Kpi value={seg.blind || "..."} label="Reporting blind spots" color={TEAL.deep} />
        </section>

        <section ref={mapSectionRef} className="mt-5 scroll-mt-4">
          <Card title="Priority map (Vijayawada and Amaravati)" right={legend}>
            <div className="relative overflow-hidden rounded-md" style={{ border: "1px solid var(--border)", height: "min(78vh, 760px)", minHeight: 480 }}>
              <MapView points={ranked} selectedId={selectedId} onSelect={setSelectedId} />
              {!selected && total > 0 && (
                <div className="absolute left-3 top-3 rounded-md bg-white/95 px-3 py-2 text-xs text-slate-600 shadow" style={{ zIndex: 1000 }}>
                  Click a point to see its summary
                </div>
              )}
              {selected && <LocationCard r={selected} tier={selTier} scale={scale} onClose={() => setSelectedId(null)} />}
            </div>
          </Card>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Priority bands (Module 1: score with uncertainty)">
              <BandChart data={m1} />
              <p className="mt-2 text-xs text-slate-500">Each dot is a location at its predicted priority; the faint line is its 5th to 95th percentile band. Wider band means less certainty.</p>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Card title="Risk next week (Module 2)">
              <Segmented segments={[
                { label: "Elevated", value: riskStats.elevated, color: TIER.high.color },
                { label: "Moderate", value: riskStats.moderate, color: TIER.medium.color },
                { label: "Low", value: riskStats.low, color: TIER.low.color },
              ]} />
            </Card>
            <Card title="Record vs reality (Module 3)">
              <Segmented segments={[
                { label: "Blind spot", value: seg.blind, color: TIER.medium.color, sub: "complaints high" },
                { label: "Reporting gap", value: seg.gap, color: TEAL.deep, sub: "incidents high" },
                { label: "Aligned", value: seg.aligned, color: TIER.low.color },
              ]} />
            </Card>
          </div>
        </section>

        <section className="mt-5">
          <DeployMap ranked={ranked} total={total} />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Fused priority queue</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">One card per location combining all modules: priority band, calibrated risk for next week, and the data-gap check. Every number carries a plain-English reason.</p>
          <FusedQueue data={composite} onPick={pick} canPick={(id) => byId.has(id)} />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Priority list</h2>
            <p className="text-xs text-slate-500">Showing {Math.min(listLimit, ranked.length)} of {ranked.length}</p>
          </div>
          <div className="space-y-3">
            {ranked.slice(0, listLimit).map((r) => {
              const tier = tierByFraction(r.priority_rank / total);
              const facts = factsOf(r);
              return (
                <div key={r.location_id} className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderLeft: `4px solid ${TIER[tier].color}` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TIER[tier].color }}>
                        {r.priority_rank}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {r.location_id} <span className="font-normal text-slate-500">in {clean(r.zone)}</span>
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">Flagged for {reasonText(r)}.</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <TierTag tier={tier} />
                      <Pill conf={r.confidence} />
                      <button onClick={() => pick(r.location_id)} className="rounded-md border px-2.5 py-1 text-xs font-semibold hover:bg-slate-50" style={{ borderColor: "var(--border)", color: TEAL.deep }}>
                        Show on map
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {facts.map((f, i) => <FactTile key={i} f={f} />)}
                  </div>

                  {r.risk && (
                    <p className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: "#b45309" }}>
                      <Icon name="rain" size={16} /> {Math.round(r.risk.risk_prob * 100)}% chance of a severe incident next week
                      <span className="font-normal text-slate-500"> · {r.risk.risk_label}</span>
                    </p>
                  )}

                  {r.tt && (
                    <p className="mt-1.5 flex items-center gap-2 text-sm font-medium" style={{ color: TEAL.deep }}>
                      <Icon name="clock" size={16} /> Best repair window {r.tt.window_label}
                      {congLabel(r.tt.congestion) ? <span className="font-normal text-slate-500"> · {congLabel(r.tt.congestion)}</span> : null}
                    </p>
                  )}

                  <ScoreBar r={r} tier={tier} scale={scale} />
                </div>
              );
            })}
            {!ranked.length && <p className="text-sm text-slate-400">Loading priorities...</p>}
          </div>
          {listLimit < ranked.length && (
            <div className="mt-4 text-center">
              <button onClick={() => setListLimit((n) => n + 12)} className="rounded-md border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50" style={{ borderColor: "var(--border)", color: TEAL.deep }}>
                Show 12 more
              </button>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Blind spots worth a site visit</h2>
          <p className="mb-3 text-sm text-slate-600">Locations where the public complains far more than the official incident log shows. The data may be under-recording a real problem.</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {blindSpots.map((r) => (
              <button key={r.location_id} onClick={() => byId.has(r.location_id) && pick(r.location_id)} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: TONE.warn.bg, color: TONE.warn.fg }}><Icon name="megaphone" size={18} /></span>
                  <div>
                    <p className="font-semibold text-slate-900">{r.location_id} <span className="font-normal text-slate-500">in {clean(r.zone)}</span></p>
                    <p className="text-sm text-slate-600">{r.complaint_count} complaints but only {r.incident_count} official incidents logged.</p>
                  </div>
                </div>
                <span className="hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline" style={{ background: "var(--teal-50)", color: TEAL.deep }}>likely under-recorded</span>
              </button>
            ))}
            {!blindSpots.length && <p className="text-sm text-slate-400">Loading blind spots...</p>}
          </div>
        </section>
      </main>
    </>
  );
}

import type { Row, Tier } from "../lib/types";
import { TEAL, TIER, clean, reasonText, factsOf, congLabel, liveSpeedLabel } from "../lib/theme";
import { Icon } from "./icons";
import { FactTile, Pill, TierTag, RiskTag } from "./ui";
import { ScoreBar } from "./ScoreBar";

export function LocationCard({ r, tier, scale, onClose }: { r: Row; tier: Tier; scale: { min: number; max: number }; onClose: () => void }) {
  const facts = factsOf(r);
  return (
    <div
      className="absolute right-3 top-3 w-[330px] max-w-[calc(100%-24px)] overflow-y-auto rounded-xl border bg-white shadow-xl"
      style={{ zIndex: 1000, maxHeight: "calc(100% - 24px)", borderColor: "var(--border)", borderTop: `4px solid ${TIER[tier].color}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TIER[tier].color }}>
              {r.priority_rank}
            </span>
            <div>
              <p className="font-semibold leading-tight text-slate-900">{r.location_id}</p>
              <p className="text-sm text-slate-500">{clean(r.zone)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close summary">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TierTag tier={tier} />
          <Pill conf={r.confidence} />
          {r.risk && <RiskTag label={r.risk.risk_label} prob={r.risk.risk_prob} />}
        </div>

        <p className="mt-3 text-sm text-slate-600">Flagged for {reasonText(r)}.</p>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {facts.map((f, i) => <FactTile key={i} f={f} compact />)}
        </div>

        {r.risk && (
          <div className="mt-3 rounded-md p-3" style={{ background: "#fffbeb" }}>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#b45309" }}>
              <Icon name="rain" size={16} /> Risk next week
            </div>
            <p className="mt-1 text-sm text-slate-700">
              {Math.round(r.risk.risk_prob * 100)}% chance of a severe incident ({r.risk.risk_label}).
              <span className="text-slate-500"> {r.risk.season}, rainfall {Math.round(r.risk.rain_mm)} mm.</span>
            </p>
          </div>
        )}

        {r.tt && (
          <div className="mt-3 rounded-md p-3" style={{ background: "var(--teal-50)", color: TEAL.deep }}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="clock" size={16} /> Best repair window
            </div>
            <p className="mt-1 text-sm">{r.tt.window_label} <span className="text-slate-500">{r.tt.window_day}</span></p>
            {congLabel(r.tt.congestion) && <p className="text-xs text-slate-500">Traffic: {congLabel(r.tt.congestion)}</p>}
            {r.tt.roadClosure && <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Road currently closed</p>}
          </div>
        )}

        {r.live && r.live.congestion_ratio != null && (
          <div className="mt-3 rounded-md p-3" style={{ background: "#ecfeff", color: TEAL.deep }}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="layers" size={16} /> Live now (TomTom)
            </div>
            <p className="mt-1 text-sm text-slate-700">
              Moving at {liveSpeedLabel(r.live.congestion_ratio)}
              {r.live.live_incident_count ? `, ${r.live.live_incident_count} active incident(s) nearby` : ""}.
            </p>
            {r.live.roadClosure && <p className="mt-1 text-xs font-semibold" style={{ color: "#dc2626" }}>Road currently closed</p>}
          </div>
        )}

        <ScoreBar r={r} tier={tier} scale={scale} />
      </div>
    </div>
  );
}

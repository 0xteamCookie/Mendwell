import type { M1, Tier } from "../lib/types";
import { TIER, CONF } from "../lib/theme";

export function ScoreBar({ r, tier, scale }: { r: M1; tier: Tier; scale: { min: number; max: number } }) {
  const span = scale.max - scale.min || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - scale.min) / span) * 100))}%`;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Priority score <b className="text-slate-800">{r.predicted.toFixed(2)}</b></span>
        <span>range {r.band_low.toFixed(2)} to {r.band_high.toFixed(2)}</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
        <div className="absolute top-0 h-2 rounded-full opacity-40" style={{ left: pct(r.band_low), width: `calc(${pct(r.band_high)} - ${pct(r.band_low)})`, background: TIER[tier].color }} />
        <div className="absolute top-[-2px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white" style={{ left: pct(r.predicted), background: TIER[tier].color }} />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CONF[r.confidence].dot }} />
        <b className="text-slate-700">{CONF[r.confidence].label}.</b> {CONF[r.confidence].note}
      </p>
    </div>
  );
}

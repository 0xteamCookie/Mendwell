import { useMemo } from "react";
import type { M1 } from "../lib/types";
import { TIER, tierByFraction } from "../lib/theme";

export function BandChart({ data }: { data: M1[] }) {
  const pts = useMemo(() => [...data].sort((a, b) => b.predicted - a.predicted), [data]);
  if (!pts.length) return <p className="p-4 text-sm text-slate-400">Loading priority bands...</p>;

  const n = pts.length;
  const W = 1000, H = 340, mL = 52, mR = 16, mT = 14, mB = 40;
  const pw = W - mL - mR, ph = H - mT - mB;
  let yMin = Infinity, yMax = -Infinity;
  pts.forEach((p) => { yMin = Math.min(yMin, p.band_low); yMax = Math.max(yMax, p.band_high); });
  const pad = (yMax - yMin) * 0.04;
  yMin -= pad; yMax += pad;

  const x = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * pw);
  const y = (v: number) => mT + ((yMax - v) / (yMax - yMin)) * ph;
  const ticks: number[] = [];
  for (let k = 0; k <= 5; k++) ticks.push(yMin + ((yMax - yMin) * k) / 5);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }} role="img" aria-label="Priority bands by location">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={mL} x2={W - mR} y1={y(t)} y2={y(t)} stroke="#eef2f6" strokeWidth={1} />
            <text x={mL - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill="#94a3b8">{t.toFixed(1)}</text>
          </g>
        ))}
        {yMin < 0 && yMax > 0 && <line x1={mL} x2={W - mR} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" />}
        {pts.map((p, i) => {
          const c = TIER[tierByFraction(p.priority_rank / n)].color;
          return <line key={`b${p.location_id}`} x1={x(i)} x2={x(i)} y1={y(p.band_low)} y2={y(p.band_high)} stroke={c} strokeWidth={1} opacity={0.16} />;
        })}
        {pts.map((p, i) => {
          const c = TIER[tierByFraction(p.priority_rank / n)].color;
          return <circle key={`d${p.location_id}`} cx={x(i)} cy={y(p.predicted)} r={1.8} fill={c} opacity={0.9} />;
        })}
        <text x={mL} y={H - 10} fontSize={13} fill="#64748b">most urgent</text>
        <text x={W - mR} y={H - 10} textAnchor="end" fontSize={13} fill="#64748b">least urgent</text>
        <text transform={`translate(14 ${mT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill="#64748b">priority score</text>
      </svg>
    </div>
  );
}

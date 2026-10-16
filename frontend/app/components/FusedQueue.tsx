import { useState } from "react";
import type { Composite } from "../lib/types";
import { TIER, tierByFraction, clean } from "../lib/theme";

// Pick an icon tone word for each why line by its leading label
function lineTone(line: string) {
  if (line.startsWith("Risk")) return "#b45309";
  if (line.startsWith("Data")) return "#7c3aed";
  if (line.startsWith("Live")) return "#0e7490";
  return "#334155";
}

export function FusedQueue({ data, onPick, canPick }: { data: Composite[]; onPick: (id: string) => void; canPick: (id: string) => boolean }) {
  const [limit, setLimit] = useState(9);
  if (!data.length) return <p className="text-sm text-slate-400">Loading fused queue...</p>;
  const total = data.length;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {data.slice(0, limit).map((c) => {
          const tier = tierByFraction(c.composite_rank / total);
          return (
            <div key={c.location_id} className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderTop: `4px solid ${TIER[tier].color}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: TIER[tier].color }}>
                    {c.composite_rank}
                  </span>
                  <div>
                    <p className="font-semibold leading-tight text-slate-900">{c.location_id}</p>
                    <p className="text-xs text-slate-500">{clean(c.zone)} · {c.road_type}</p>
                  </div>
                </div>
                {canPick(c.location_id) && (
                  <button onClick={() => onPick(c.location_id)} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
                    Map
                  </button>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {c.why_card.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: lineTone(line) }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {limit < data.length && (
        <div className="mt-4 text-center">
          <button onClick={() => setLimit((n) => n + 9)} className="rounded-md border bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
            Show 9 more
          </button>
        </div>
      )}
    </>
  );
}

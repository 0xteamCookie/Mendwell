import type { Fact, Tier } from "../lib/types";
import { TEAL, TIER, CONF, TONE } from "../lib/theme";
import { Icon } from "./icons";

export function FactTile({ f, compact }: { f: Fact; compact?: boolean }) {
  const t = TONE[f.tone];
  return (
    <div className="flex items-center gap-2.5 rounded-md border bg-white p-2" style={{ borderColor: "var(--border)" }}>
      <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: compact ? 30 : 36, height: compact ? 30 : 36, background: t.bg, color: t.fg }}>
        <Icon name={f.icon} size={compact ? 16 : 18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] uppercase tracking-wide text-slate-400">{f.label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{f.value}</p>
      </div>
    </div>
  );
}

export function Pill({ conf }: { conf: "high" | "medium" | "low" }) {
  const c = CONF[conf];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>
      <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

export function TierTag({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: t.bg, color: t.color, border: `1px solid ${t.ring}` }}>
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

export function RiskTag({ label, prob }: { label: string; prob: number }) {
  const t = TONE[label === "elevated" ? "bad" : label === "moderate" ? "warn" : "good"];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: t.bg, color: t.fg }}>
      <span className="h-2 w-2 rounded-full" style={{ background: t.fg }} />
      {Math.round(prob * 100)}% risk next week
    </span>
  );
}

export function Card({ title, children, right, flush }: { title?: string; children: React.ReactNode; right?: React.ReactNode; flush?: boolean }) {
  return (
    <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border)" }}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          {right}
        </div>
      )}
      <div className={flush ? "px-4 pb-4" : title ? "px-4 pb-4" : "p-4"}>{children}</div>
    </div>
  );
}

export function Kpi({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderTop: `3px solid ${color}` }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-sm text-slate-600">{label}</p>
    </div>
  );
}

export function Segmented({ segments }: { segments: { label: string; value: number; color: string; sub?: string }[] }) {
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

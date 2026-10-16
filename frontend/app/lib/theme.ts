import type { M1, Fact, Tier, Tone } from "./types";

export const TEAL = { light: "#a7eef7", mid: "#22d3ee", deep: "#0e7490", ink: "#0b4f5e" };
export const CREW_COLORS = ["#0e7490", "#7c3aed", "#ea580c", "#2563eb"];

export const TIER: Record<Tier, { label: string; color: string; bg: string; ring: string }> = {
  high: { label: "High priority", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" },
  medium: { label: "Medium priority", color: "#d97706", bg: "#fffbeb", ring: "#fde68a" },
  low: { label: "Low priority", color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
};

export function tierByFraction(frac: number): Tier {
  return frac <= 1 / 3 ? "high" : frac <= 2 / 3 ? "medium" : "low";
}

export const CONF = {
  high: { label: "High confidence", dot: TEAL.deep, note: "The model is sure about this one." },
  medium: { label: "Medium confidence", dot: TEAL.mid, note: "Reasonably sure, worth a look." },
  low: { label: "Low confidence", dot: TEAL.light, note: "Limited data here, verify before acting." },
};

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  bad: { fg: "#dc2626", bg: "#fef2f2" },
  warn: { fg: "#d97706", bg: "#fffbeb" },
  good: { fg: "#16a34a", bg: "#f0fdf4" },
  info: { fg: TEAL.deep, bg: "#ecfeff" },
  mute: { fg: "#64748b", bg: "#f1f5f9" },
};

// Forward-looking risk label styling (Module 2)
export const RISK: Record<string, { label: string; tone: Tone }> = {
  elevated: { label: "Elevated risk", tone: "bad" },
  moderate: { label: "Moderate risk", tone: "warn" },
  low: { label: "Low risk", tone: "good" },
};

export const clean = (s: string) => s.replace(/_/g, " ");

export function congLabel(c?: number | null) {
  if (c == null) return null;
  const pct = Math.round(c * 100);
  return pct < 5 ? "free flowing now" : `${pct}% slower now`;
}

export function reasonText(r: M1) {
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

function condTone(c: string): Tone {
  const s = c.toLowerCase();
  return s === "critical" ? "bad" : s === "poor" ? "warn" : s === "fair" ? "info" : "good";
}
function footTone(p: string): Tone {
  const s = p.toLowerCase();
  return s === "high" ? "bad" : s === "medium" ? "warn" : "good";
}

export function factsOf(r: M1): Fact[] {
  const f: Fact[] = [
    { icon: "crack", label: "Road condition", value: r.road_condition, tone: condTone(r.road_condition) },
    { icon: "walker", label: "Pedestrian activity", value: r.pedestrian_activity, tone: footTone(r.pedestrian_activity) },
    { icon: "road", label: "Road type", value: r.road_type, tone: "info" },
  ];
  if (r.near_school) f.push({ icon: "school", label: "Nearby", value: "School", tone: "bad" });
  if (r.near_hospital) f.push({ icon: "hospital", label: "Nearby", value: "Hospital", tone: "bad" });
  if (r.injury_count > 0) f.push({ icon: "injury", label: "Injuries", value: String(r.injury_count), tone: "bad" });
  if (r.incident_count > 0) f.push({ icon: "alert", label: "Incidents", value: String(r.incident_count), tone: "warn" });
  if (r.complaint_count > 0) f.push({ icon: "megaphone", label: "Complaints", value: String(r.complaint_count), tone: "warn" });
  return f;
}

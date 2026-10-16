// One-off data enrichment. Fetches live TomTom traffic per location and
// derives a recommended low-traffic repair window. Run with:
//   TOMTOM_KEY=xxxx node scripts/enrich_traffic.mjs [topN]
// Writes public/data/module2_traffic.json. The key is never shipped to the browser.

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.TOMTOM_KEY;
if (!KEY) { console.error("Set TOMTOM_KEY env var."); process.exit(1); }
const TOP_N = Number(process.argv[2] || 250);

const root = path.resolve(process.cwd());
const m1 = JSON.parse(fs.readFileSync(path.join(root, "public/data/module1_priority.json"), "utf8"));

// Typical urban diurnal traffic index (0 quiet .. 1 peak), weekday baseline.
const BASE = [0.12,0.08,0.06,0.05,0.07,0.13,0.30,0.58,0.86,0.90,0.70,0.63,
              0.66,0.64,0.60,0.66,0.80,0.93,1.00,0.90,0.68,0.50,0.34,0.20];
const ROAD_FACTOR = { Highway:1.35, Arterial:1.20, Collector:1.00, Local:0.85, Residential:0.75 };
const WIN_LEN = 3;

function fmt(h){ return String(((h%24)+24)%24).padStart(2,"0") + ":00"; }

// Night-work aversion by road class: repairing a quiet residential road at 3am
// is pointless and costly, so we prefer daytime off-peak there. A busy arterial
// has no cheap daytime window, so night wins. Real measured congestion pulls a
// road back toward a night window when it is actually busy.
const NIGHT_COST = { Highway:0.0, Arterial:0.05, Collector:0.28, Local:0.52, Residential:0.58 };

function recommendWindow(r, congestion){
  const c = Math.min(Math.max(congestion ?? 0, 0), 1);
  const rf = ROAD_FACTOR[r.road_type] ?? 1.0;
  const amp = 0.7 + c * 1.2;              // congested roads have sharper daytime peaks
  const prof = BASE.map((b) => b * rf * amp);
  const nightCost = (NIGHT_COST[r.road_type] ?? 0.3) * Math.max(0, 1 - c * 2.5);
  for (let h = 0; h < 24; h++) {
    if (h <= 5 || h >= 22) prof[h] += nightCost;                                  // avoid night on quiet roads
    if (r.near_school && ((h>=7&&h<=9) || (h>=13&&h<=16))) prof[h] += 0.7;        // school in/out
    if (r.pedestrian_activity === "High" && (h>=17&&h<=21)) prof[h] += 0.35;      // evening footfall
    if (r.near_hospital && (h>=22 || h<=5)) prof[h] += 0.2;                       // keep night hospital access
  }
  let best = 0, bestSum = Infinity;
  for (let s = 0; s < 24; s++) {
    let sum = 0;
    for (let k = 0; k < WIN_LEN; k++) sum += prof[(s + k) % 24];
    if (sum < bestSum) { bestSum = sum; best = s; }
  }
  const dayNote = ["Highway","Arterial","Collector"].includes(r.road_type)
    ? "weeknights, quieter on weekends"
    : "most low-traffic days";
  return { start: best, end: (best + WIN_LEN) % 24, label: `${fmt(best)} to ${fmt(best + WIN_LEN)}`, dayNote };
}

async function fetchFlow(lat, lon) {
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      const j = await res.json();
      return j.flowSegmentData ?? null;
    } catch { await new Promise(r => setTimeout(r, 800)); }
  }
  return null;
}

async function pool(items, worker, concurrency = 6) {
  const out = new Array(items.length);
  let i = 0;
  async function run() { while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); } }
  await Promise.all(Array.from({ length: concurrency }, run));
  return out;
}

const targets = [...m1].sort((a,b)=>a.priority_rank-b.priority_rank).slice(0, TOP_N);

// Reuse previously fetched live data so re-running (e.g. to tweak the window
// model) costs no API calls. Pass --refresh to force a fresh pull.
const outPath = path.join(root, "public/data/module2_traffic.json");
const refresh = process.argv.includes("--refresh");
const cache = new Map();
if (!refresh && fs.existsSync(outPath)) {
  for (const row of JSON.parse(fs.readFileSync(outPath, "utf8"))) cache.set(row.location_id, row);
}
console.log(`Enriching top ${targets.length} locations via TomTom (${cache.size} cached)...`);

let done = 0;
const measured_at = new Date().toISOString();
const results = await pool(targets, async (r) => {
  const cached = cache.get(r.location_id);
  let freeFlowSpeed = null, currentSpeed = null, congestion = null, frc = null, roadClosure = false, confidence = null, when = measured_at;
  if (cached && cached.congestion !== null && cached.congestion !== undefined) {
    ({ freeFlowSpeed, currentSpeed, congestion, frc, roadClosure, confidence } = cached);
    when = cached.measured_at ?? measured_at;
  } else {
    const flow = await fetchFlow(r.latitude, r.longitude);
    if (flow) {
      freeFlowSpeed = flow.freeFlowSpeed; currentSpeed = flow.currentSpeed; frc = flow.frc;
      roadClosure = !!flow.roadClosure; confidence = flow.confidence;
      if (freeFlowSpeed > 0) congestion = Math.max(0, Math.min(1, 1 - currentSpeed / freeFlowSpeed));
    }
  }
  const win = recommendWindow(r, congestion);
  if (++done % 25 === 0) console.log(`  ${done}/${targets.length}`);
  return {
    location_id: r.location_id, zone: r.zone, latitude: r.latitude, longitude: r.longitude,
    priority_rank: r.priority_rank, road_type: r.road_type,
    freeFlowSpeed, currentSpeed, congestion, frc, roadClosure, confidence,
    window_start: win.start, window_end: win.end, window_label: win.label, window_day: win.dayNote,
    measured_at: when,
  };
});

const okCount = results.filter(r => r.congestion !== null).length;
const outDir = path.join(root, "public/data");
fs.writeFileSync(path.join(outDir, "module2_traffic.json"), JSON.stringify(results, null, 2));
console.log(`Done. ${okCount}/${results.length} had live traffic data. Wrote public/data/module2_traffic.json`);

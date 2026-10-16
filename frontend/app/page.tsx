"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

type M2 = {
  location_id: string;
  road_type: string;
  freeFlowSpeed: number | null;
  currentSpeed: number | null;
  congestion: number | null;
  roadClosure: boolean;
  window_start: number;
  window_end: number;
  window_label: string;
  window_day: string;
  measured_at: string;
};

type Row = M1 & { tt?: M2 };
type LatLng = [number, number];

/* ------------------------------------------------------------------ */
/* Theme + helpers                                                     */
/* ------------------------------------------------------------------ */

const TEAL = { light: "#a7eef7", mid: "#22d3ee", deep: "#0e7490", ink: "#0b4f5e" };
const CREW_COLORS = ["#0e7490", "#7c3aed", "#ea580c", "#2563eb"];

type Tier = "high" | "medium" | "low";
const TIER: Record<Tier, { label: string; color: string; bg: string; ring: string }> = {
  high: { label: "High priority", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" },
  medium: { label: "Medium priority", color: "#d97706", bg: "#fffbeb", ring: "#fde68a" },
  low: { label: "Low priority", color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
};
function tierByFraction(frac: number): Tier {
  return frac <= 1 / 3 ? "high" : frac <= 2 / 3 ? "medium" : "low";
}

const CONF = {
  high: { label: "High confidence", dot: TEAL.deep, note: "The model is sure about this one." },
  medium: { label: "Medium confidence", dot: TEAL.mid, note: "Reasonably sure, worth a look." },
  low: { label: "Low confidence", dot: TEAL.light, note: "Limited data here, verify before acting." },
};

function congLabel(c?: number | null) {
  if (c == null) return null;
  const pct = Math.round(c * 100);
  return pct < 5 ? "free flowing now" : `${pct}% slower now`;
}

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

const clean = (s: string) => s.replace(/_/g, " ");

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, string[]> = {
  road: ["M4 22L8 2", "M20 22L16 2", "M12 5v3", "M12 11v3", "M12 17v3"],
  crack: ["M3 12l4-3 3 4 4-5 3 3 4-2"],
  walker: ["M12 5m-2 0a2 2 0 104 0 2 2 0 10-4 0", "M12 7v6", "M12 13l-3 6", "M12 13l3 6", "M8 10h8"],
  school: ["M22 10L12 5 2 10l10 5 10-5z", "M6 12v5c3 3 9 3 12 0v-5"],
  hospital: ["M4 3h16v18H4z", "M12 8v8", "M8 12h8"],
  injury: ["M3 12h4l2-5 4 10 2-5h6"],
  alert: ["M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z", "M12 9v4", "M12 17h.01"],
  megaphone: ["M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z", "M16 8a5 5 0 010 8"],
  clock: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M12 6v6l4 2"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  truck: ["M1 6h13v10H1z", "M14 9h5l3 3v4h-8", "M6 19m-2 0a2 2 0 104 0 2 2 0 10-4 0", "M18 19m-2 0a2 2 0 104 0 2 2 0 10-4 0"],
  route: ["M5 19m-2 0a2 2 0 104 0 2 2 0 10-4 0", "M19 5m-2 0a2 2 0 104 0 2 2 0 10-4 0", "M7 19h7a3 3 0 000-6H10a3 3 0 010-6h7"],
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICONS[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

type Tone = "bad" | "warn" | "good" | "info" | "mute";
const TONE: Record<Tone, { fg: string; bg: string }> = {
  bad: { fg: "#dc2626", bg: "#fef2f2" },
  warn: { fg: "#d97706", bg: "#fffbeb" },
  good: { fg: "#16a34a", bg: "#f0fdf4" },
  info: { fg: TEAL.deep, bg: "#ecfeff" },
  mute: { fg: "#64748b", bg: "#f1f5f9" },
};

function condTone(c: string): Tone {
  const s = c.toLowerCase();
  return s === "critical" ? "bad" : s === "poor" ? "warn" : s === "fair" ? "info" : "good";
}
function footTone(p: string): Tone {
  const s = p.toLowerCase();
  return s === "high" ? "bad" : s === "medium" ? "warn" : "good";
}

type Fact = { icon: string; label: string; value: string; tone: Tone };
function factsOf(r: M1): Fact[] {
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

function FactTile({ f, compact }: { f: Fact; compact?: boolean }) {
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

/* ------------------------------------------------------------------ */
/* Small UI                                                            */
/* ------------------------------------------------------------------ */

function Pill({ conf }: { conf: "high" | "medium" | "low" }) {
  const c = CONF[conf];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--teal-50)", color: TEAL.deep }}>
      <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function TierTag({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: t.bg, color: t.color, border: `1px solid ${t.ring}` }}>
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      {t.label}
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

function Card({ title, children, right, flush }: { title?: string; children: React.ReactNode; right?: React.ReactNode; flush?: boolean }) {
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

function Kpi({ value, label, color }: { value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)", borderTop: `3px solid ${color}` }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-sm text-slate-600">{label}</p>
    </div>
  );
}

function Segmented({ segments }: { segments: { label: string; value: number; color: string; sub?: string }[] }) {
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

/* ------------------------------------------------------------------ */
/* Summary card shown when a point is clicked                         */
/* ------------------------------------------------------------------ */

// Priority score + uncertainty range + confidence note, shared by the card and the list
function ScoreBar({ r, tier, scale }: { r: M1; tier: Tier; scale: { min: number; max: number } }) {
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

function LocationCard({ r, tier, scale, onClose }: { r: Row; tier: Tier; scale: { min: number; max: number }; onClose: () => void }) {
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
        </div>

        <p className="mt-3 text-sm text-slate-600">Flagged for {reasonText(r)}.</p>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {facts.map((f, i) => <FactTile key={i} f={f} compact />)}
        </div>

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

        <ScoreBar r={r} tier={tier} scale={scale} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* External libs (CDN, loaded once)                                    */
/* ------------------------------------------------------------------ */

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (w.__leafletP) return w.__leafletP;
  if (!document.querySelector("link[data-leaflet]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.setAttribute("data-leaflet", "1");
    document.head.appendChild(link);
  }
  w.__leafletP = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve((window as any).L);
    document.body.appendChild(s);
  });
  return w.__leafletP;
}

function loadThree(): Promise<any> {
  const w = window as any;
  if (w.THREE) return Promise.resolve(w.THREE);
  if (w.__threeP) return w.__threeP;
  w.__threeP = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => resolve((window as any).THREE);
    document.body.appendChild(s);
  });
  return w.__threeP;
}

// Standard OpenStreetMap tiles (no API key needed)
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

/* ------------------------------------------------------------------ */
/* 1. Main priority map                                                */
/* ------------------------------------------------------------------ */

function MapView({ points, selectedId, onSelect }: { points: Row[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!points.length) return;
    let cancelled = false;
    let map: any;
    const total = points.length;
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current) return;
      map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([16.51, 80.62], 11);
      mapRef.current = map;
      L.tileLayer(TILES, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      map.on("click", () => onSelectRef.current(null));
      markersRef.current = new Map();

      // low first so high-priority dots sit on top
      [...points].sort((a, b) => b.priority_rank - a.priority_rank).forEach((p) => {
        const tier = tierByFraction(p.priority_rank / total);
        const base = tier === "high" ? 8 : tier === "medium" ? 6.5 : 5;
        const m = L.circleMarker([p.latitude, p.longitude], {
          radius: base, color: "#ffffff", weight: 1.5, fillColor: TIER[tier].color, fillOpacity: 0.9,
        }).addTo(map);
        (m as any)._base = base;
        m.bindTooltip(`#${p.priority_rank} ${p.location_id}`, { direction: "top" });
        m.on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(p.location_id);
        });
        markersRef.current.set(p.location_id, m);
      });
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    });
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [points]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const sel = id === selectedId;
      m.setStyle({ radius: sel ? m._base + 6 : m._base, weight: sel ? 3 : 1.5, color: sel ? "#0f172a" : "#ffffff" });
      if (sel) {
        m.bringToFront();
        const map = mapRef.current;
        if (map) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 12), { duration: 0.6 });
      }
    });
  }, [selectedId, points]);

  return <div ref={hostRef} className="h-full w-full" />;
}

/* ------------------------------------------------------------------ */
/* 2. 3D city                                                          */
/* ------------------------------------------------------------------ */

function City3D({ rows, selectedId, onSelect }: { rows: Row[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const autoRef = useRef(true);
  const zoomRef = useRef<(f: number) => void>(() => { });
  const [auto, setAuto] = useState(true);
  autoRef.current = auto;

  useEffect(() => {
    if (!rows.length) return;
    let disposed = false;
    let cleanup = () => { };

    loadThree().then((THREE) => {
      const host = hostRef.current;
      if (disposed || !host) return;
      const total = rows.length;
      const W0 = host.clientWidth || 800;
      const H0 = host.clientHeight || 560;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W0, H0);
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0b1220");
      scene.fog = new THREE.Fog("#0b1220", 80, 220);
      const camera = new THREE.PerspectiveCamera(45, W0 / H0, 0.1, 600);

      scene.add(new THREE.AmbientLight(0x8da2c8, 0.85));
      const sun = new THREE.DirectionalLight(0xffffff, 0.9);
      sun.position.set(40, 80, 30);
      scene.add(sun);

      // project lat/lon to scene units
      const lat0 = rows.reduce((s, r) => s + r.latitude, 0) / total;
      const lon0 = rows.reduce((s, r) => s + r.longitude, 0) / total;
      const kx = Math.cos((lat0 * Math.PI) / 180) * 111;
      let ext = 0.001;
      rows.forEach((r) => {
        ext = Math.max(ext, Math.abs((r.longitude - lon0) * kx), Math.abs((r.latitude - lat0) * 111));
      });
      const s = 45 / ext;
      const pos = (r: Row): [number, number] => [(r.longitude - lon0) * kx * s, -(r.latitude - lat0) * 111 * s];

      // ground + grid
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: "#0f1b33" }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const grid = new THREE.GridHelper(200, 50, 0x1e3a5f, 0x16294a);
      grid.position.y = 0.02;
      scene.add(grid);

      // background city blocks (seeded so it is stable)
      const towerXY = rows.map(pos);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const blocks: { x: number; z: number; w: number; d: number; h: number }[] = [];
      let guard = 0;
      while (blocks.length < 420 && guard++ < 4000) {
        const x = (rnd() - 0.5) * 120;
        const z = (rnd() - 0.5) * 120;
        if (towerXY.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 2.2)) continue;
        const dist = Math.hypot(x, z);
        const h = 0.4 + rnd() * (2.6 - Math.min(dist / 60, 1) * 1.6);
        blocks.push({ x, z, w: 0.6 + rnd() * 1.2, d: 0.6 + rnd() * 1.2, h });
      }
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: "#22314f" }), blocks.length);
      const dummy = new THREE.Object3D();
      blocks.forEach((b, i) => {
        dummy.position.set(b.x, b.h / 2, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      scene.add(inst);

      // priority towers
      let pMin = Infinity, pMax = -Infinity;
      rows.forEach((r) => { pMin = Math.min(pMin, r.predicted); pMax = Math.max(pMax, r.predicted); });
      const span = pMax - pMin || 1;
      const towers: { mesh: any; id: string; h: number }[] = [];
      const tmeshes: any[] = [];
      rows.forEach((r, i) => {
        const tier = tierByFraction(r.priority_rank / total);
        const h = 1.5 + ((r.predicted - pMin) / span) * 26;
        const color = new THREE.Color(TIER[tier].color);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.5, metalness: 0.1 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), mat);
        mesh.position.set(towerXY[i][0], h / 2, towerXY[i][1]);
        mesh.userData.id = r.location_id;
        scene.add(mesh);
        towers.push({ mesh, id: r.location_id, h });
        tmeshes.push(mesh);
      });

      // rank labels for the top 8
      const labelSprite = (txt: string) => {
        const c = document.createElement("canvas");
        c.width = 128; c.height = 64;
        const g = c.getContext("2d")!;
        g.fillStyle = "rgba(15,23,42,0.9)";
        g.beginPath(); (g as any).roundRect?.(4, 8, 120, 48, 14); g.fill();
        g.strokeStyle = "#ef4444"; g.lineWidth = 3; g.stroke();
        g.fillStyle = "#fff"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(txt, 64, 33);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
        sp.scale.set(4.2, 2.1, 1);
        return sp;
      };
      rows.forEach((r, i) => {
        if (r.priority_rank > 8) return;
        const sp = labelSprite(`#${r.priority_rank}`);
        sp.position.set(towerXY[i][0], towers[i].h + 2, towerXY[i][1]);
        scene.add(sp);
      });

      // orbit camera (hand rolled, no extra libs)
      let theta = 0.7, phi = 1.0, radius = 95;
      const target = new THREE.Vector3(0, 4, 0);
      const goal = new THREE.Vector3(0, 4, 0);
      const applyCam = () => {
        camera.position.set(
          target.x + radius * Math.sin(phi) * Math.sin(theta),
          target.y + radius * Math.cos(phi),
          target.z + radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(target);
      };
      applyCam();

      const el = renderer.domElement;
      let dragging = false, moved = 0, lx = 0, ly = 0;
      const down = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        theta -= dx * 0.006;
        phi = Math.max(0.15, Math.min(1.45, phi - dy * 0.005));
      };
      const ray = new THREE.Raycaster();
      const up = (e: PointerEvent) => {
        dragging = false;
        if (moved < 6) {
          const rect = el.getBoundingClientRect();
          const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          ray.setFromCamera(mouse, camera);
          const hit = ray.intersectObjects(tmeshes)[0];
          onSelectRef.current(hit ? hit.object.userData.id : null);
        }
      };
      const clampR = (v: number) => Math.max(12, Math.min(180, v));
      const wheel = (e: WheelEvent) => {
        if (!(e.ctrlKey || e.metaKey)) return; // plain scroll scrolls the page
        e.preventDefault();
        radius = clampR(radius * (1 + e.deltaY * 0.01));
      };
      zoomRef.current = (f: number) => { radius = clampR(radius * f); };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("wheel", wheel, { passive: false });

      const ro = new ResizeObserver(() => {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(host);

      let raf = 0;
      const t0 = performance.now();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = (performance.now() - t0) / 1000;
        if (autoRef.current && !dragging) theta += 0.0018;

        const selId = selectedRef.current;
        let focus: any = null;
        towers.forEach((tw) => {
          const sel = tw.id === selId;
          const k = sel ? 1.9 : 1;
          tw.mesh.scale.x += (k - tw.mesh.scale.x) * 0.15;
          tw.mesh.scale.z += (k - tw.mesh.scale.z) * 0.15;
          tw.mesh.material.emissiveIntensity = sel ? 0.9 + Math.sin(t * 5) * 0.4 : 0.45;
          if (sel) focus = tw;
        });
        if (focus) goal.set(focus.mesh.position.x, focus.h / 2, focus.mesh.position.z);
        else goal.set(0, 4, 0);
        target.lerp(goal, 0.06);

        applyCam();
        renderer.render(scene, camera);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("wheel", wheel);
        renderer.dispose();
        if (el.parentNode) el.parentNode.removeChild(el);
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [rows]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" />
      <div className="absolute bottom-16 left-4 max-w-[60%] rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-200" style={{ zIndex: 5 }}>
        Tower height = priority score. Drag to rotate, Ctrl/Cmd + scroll or the buttons to zoom, click a tower for its summary.
      </div>
      <div className="absolute bottom-28 right-4 flex flex-col overflow-hidden rounded-md bg-slate-900/80 text-slate-100" style={{ zIndex: 5 }}>
        <button onClick={() => zoomRef.current(0.8)} className="px-3 py-1.5 text-base font-bold leading-none hover:bg-slate-900" aria-label="Zoom in">+</button>
        <button onClick={() => zoomRef.current(1.25)} className="border-t border-slate-700 px-3 py-1.5 text-base font-bold leading-none hover:bg-slate-900" aria-label="Zoom out">&minus;</button>
      </div>
      <button
        onClick={() => setAuto((a) => !a)}
        className="absolute bottom-16 right-4 rounded-md bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-900"
        style={{ zIndex: 5 }}
      >
        {auto ? "Pause rotation" : "Auto-rotate"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Deployment planner (TSP + animated routes)                       */
/* ------------------------------------------------------------------ */

function hav(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function closedLen(order: number[], d: number[][]) {
  let t = 0;
  for (let i = 0; i < order.length; i++) t += d[order[i]][order[(i + 1) % order.length]];
  return t;
}

// Nearest neighbour start, then 2-opt until no improving swap. pts[0] is the depot.
function solveTSP(pts: LatLng[]): number[] {
  const n = pts.length;
  const d = pts.map((a) => pts.map((b) => hav(a, b)));
  const left = new Set<number>(Array.from({ length: n - 1 }, (_, i) => i + 1));
  const tour = [0];
  while (left.size) {
    const cur = tour[tour.length - 1];
    let best = -1, bd = Infinity;
    left.forEach((j) => { if (d[cur][j] < bd) { bd = d[cur][j]; best = j; } });
    tour.push(best);
    left.delete(best);
  }
  let improved = n > 3;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = tour[i - 1], b = tour[i], c = tour[j], e = tour[(j + 1) % n];
        const delta = d[a][c] + d[b][e] - d[a][b] - d[c][e];
        if (delta < -1e-9) {
          const seg = tour.slice(i, j + 1).reverse();
          tour.splice(i, j - i + 1, ...seg);
          improved = true;
        }
      }
    }
  }
  return tour;
}

function kmeans(pts: LatLng[], k: number): number[] {
  if (k <= 1 || pts.length <= k) return pts.map((_, i) => (k <= 1 ? 0 : i % k));
  const centers: LatLng[] = [pts[0]];
  while (centers.length < k) {
    let best = pts[0], bd = -1;
    pts.forEach((p) => {
      const dm = Math.min(...centers.map((c) => hav(c, p)));
      if (dm > bd) { bd = dm; best = p; }
    });
    centers.push(best);
  }
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    assign = pts.map((p) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, ci) => { const dd = hav(c, p); if (dd < bd) { bd = dd; bi = ci; } });
      return bi;
    });
    centers.forEach((_, ci) => {
      const m = pts.filter((_, i) => assign[i] === ci);
      if (m.length) centers[ci] = [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length];
    });
  }
  return assign;
}

type Crew = { id: number; color: string; order: Row[]; straightKm: number; naiveKm: number };

function buildPlan(stops: Row[], depot: LatLng, k: number): Crew[] {
  const assign = kmeans(stops.map((s) => [s.latitude, s.longitude] as LatLng), k);
  const crews: Crew[] = [];
  for (let c = 0; c < k; c++) {
    const members = stops.filter((_, i) => assign[i] === c);
    if (!members.length) continue;
    const pts: LatLng[] = [depot, ...members.map((m) => [m.latitude, m.longitude] as LatLng)];
    const d = pts.map((a) => pts.map((b) => hav(a, b)));
    const tour = solveTSP(pts);
    const naive = [0, ...members.map((m, i) => ({ m, i })).sort((a, b) => a.m.priority_rank - b.m.priority_rank).map((x) => x.i + 1)];
    crews.push({
      id: crews.length,
      color: CREW_COLORS[crews.length % CREW_COLORS.length],
      order: tour.slice(1).map((i) => members[i - 1]),
      straightKm: closedLen(tour, d),
      naiveKm: closedLen(naive, d),
    });
  }
  return crews;
}

function densify(wps: LatLng[], per = 40): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    for (let t = 0; t < per; t++) {
      out.push([wps[i][0] + ((wps[i + 1][0] - wps[i][0]) * t) / per, wps[i][1] + ((wps[i + 1][1] - wps[i][1]) * t) / per]);
    }
  }
  out.push(wps[wps.length - 1]);
  return out;
}

function indexStops(coords: LatLng[], stops: LatLng[]) {
  let last = 0;
  return stops.map((s) => {
    let best = last, bd = Infinity;
    for (let i = last; i < coords.length; i++) {
      const dx = coords[i][0] - s[0], dy = coords[i][1] - s[1];
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    last = best;
    return best;
  });
}

function fmtHours(h: number) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

type RouteRes = { coords: LatLng[]; km: number; road: boolean };

function DeployMap({ ranked, total }: { ranked: Row[]; total: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layers = useRef<{ preview: any; plan: any; depot: any } | null>(null);
  const rafRef = useRef<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [nStops, setNStops] = useState(12);
  const [nCrews, setNCrews] = useState(2);
  const [depot, setDepot] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<"idle" | "routing" | "drawing" | "done">("idle");
  const [plan, setPlan] = useState<{ crews: Crew[]; routes: RouteRes[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const [roadFail, setRoadFail] = useState(false);

  const stops = useMemo(() => ranked.slice(0, nStops), [ranked, nStops]);

  // default depot: centroid of selected sites
  useEffect(() => {
    if (depot || !stops.length) return;
    setDepot([stops.reduce((s, r) => s + r.latitude, 0) / stops.length, stops.reduce((s, r) => s + r.longitude, 0) / stops.length]);
  }, [stops, depot]);

  // init map
  useEffect(() => {
    if (!ranked.length) return;
    let cancelled = false;
    let map: any;
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current) return;
      map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([16.51, 80.62], 11);
      mapRef.current = map;
      L.tileLayer(TILES, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      layers.current = { preview: L.layerGroup().addTo(map), plan: L.layerGroup().addTo(map), depot: L.layerGroup().addTo(map) };
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (map) map.remove();
      mapRef.current = null;
      layers.current = null;
      setMapReady(false);
    };
  }, [ranked.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPlan = plan !== null;

  // preview markers (before a plan exists)
  useEffect(() => {
    const L = (window as any).L;
    if (!mapReady || !L || !layers.current || hasPlan) return;
    layers.current.preview.clearLayers();
    stops.forEach((r) => {
      const tier = tierByFraction(r.priority_rank / total);
      L.circleMarker([r.latitude, r.longitude], { radius: 8, color: "#fff", weight: 2, fillColor: TIER[tier].color, fillOpacity: 0.95 })
        .bindTooltip(`#${r.priority_rank} ${r.location_id}`)
        .addTo(layers.current!.preview);
    });
    const b = L.latLngBounds(stops.map((r) => [r.latitude, r.longitude]));
    if (b.isValid()) mapRef.current.fitBounds(b, { padding: [40, 40] });
  }, [mapReady, stops, total, hasPlan]);

  // depot marker (draggable until a plan exists)
  useEffect(() => {
    const L = (window as any).L;
    if (!mapReady || !L || !layers.current || !depot) return;
    layers.current.depot.clearLayers();
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#0f172a;color:#fff;font:700 11px sans-serif;padding:5px 8px;border-radius:6px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">DEPOT</div>`,
      iconSize: [54, 26],
      iconAnchor: [27, 13],
    });
    const m = L.marker(depot, { icon, draggable: !hasPlan, zIndexOffset: 1000 }).addTo(layers.current.depot);
    m.bindTooltip(hasPlan ? "Depot" : "Drag to move the depot");
    m.on("dragend", () => { const p = m.getLatLng(); setDepot([p.lat, p.lng]); });
  }, [mapReady, depot, hasPlan]);

  function reset() {
    cancelAnimationFrame(rafRef.current);
    layers.current?.plan.clearLayers();
    setPlan(null);
    setStatus("idle");
    setProgress(0);
    setRoadFail(false);
  }

  async function generate() {
    const L = (window as any).L;
    if (!L || !layers.current || !depot || !stops.length) return;
    cancelAnimationFrame(rafRef.current);
    layers.current.plan.clearLayers();
    layers.current.preview.clearLayers();
    setStatus("routing");
    setProgress(0);
    setRoadFail(false);

    const crews = buildPlan(stops, depot, nCrews);

    // real road geometry from OSRM, falling back to straight legs
    let failed = false;
    const routes: RouteRes[] = await Promise.all(
      crews.map(async (c) => {
        const wps: LatLng[] = [depot, ...c.order.map((o) => [o.latitude, o.longitude] as LatLng), depot];
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 9000);
          const url = `https://router.project-osrm.org/route/v1/driving/${wps.map((w) => `${w[1]},${w[0]}`).join(";")}?overview=full&geometries=geojson`;
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(to);
          const j = await res.json();
          if (j.code === "Ok" && j.routes?.[0]) {
            return { coords: j.routes[0].geometry.coordinates.map(([lo, la]: number[]) => [la, lo] as LatLng), km: j.routes[0].distance / 1000, road: true };
          }
        } catch { }
        failed = true;
        return { coords: densify(wps), km: c.straightKm, road: false };
      })
    );
    setRoadFail(failed);
    setPlan({ crews, routes });
    setStatus("drawing");

    // build layers
    const map = mapRef.current;
    const bounds = L.latLngBounds(routes.flatMap((r) => r.coords));
    bounds.extend(depot);
    map.fitBounds(bounds, { padding: [40, 40] });

    const parts = crews.map((c, ci) => {
      const r = routes[ci];
      L.polyline(r.coords, { color: c.color, weight: 3, opacity: 0.18, dashArray: "4 8" }).addTo(layers.current!.plan);
      const line = L.polyline([], { color: c.color, weight: 5, opacity: 0.95 }).addTo(layers.current!.plan);
      const head = L.circleMarker(r.coords[0], { radius: 7, color: "#fff", weight: 2, fillColor: c.color, fillOpacity: 1 }).addTo(layers.current!.plan);
      const idx = indexStops(r.coords, c.order.map((o) => [o.latitude, o.longitude] as LatLng));
      return { c, r, line, head, idx, shown: new Array(c.order.length).fill(false) as boolean[] };
    });

    const dur = 9000;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 2);
      parts.forEach((p) => {
        const upto = Math.max(2, Math.floor(eased * p.r.coords.length));
        p.line.setLatLngs(p.r.coords.slice(0, upto));
        p.head.setLatLng(p.r.coords[Math.min(upto, p.r.coords.length) - 1]);
        p.c.order.forEach((o, j) => {
          if (!p.shown[j] && upto >= p.idx[j]) {
            p.shown[j] = true;
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:26px;height:26px;border-radius:50%;background:${p.c.color};color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)">${j + 1}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });
            L.marker([o.latitude, o.longitude], { icon, zIndexOffset: 500 })
              .bindTooltip(`Crew ${p.c.id + 1}, stop ${j + 1}: ${o.location_id} (priority #${o.priority_rank})`)
              .addTo(layers.current!.plan);
          }
        });
      });
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        parts.forEach((p) => p.head.remove());
        setStatus("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const stats = useMemo(() => {
    if (!plan) return null;
    const straight = plan.crews.reduce((s, c) => s + c.straightKm, 0);
    const naive = plan.crews.reduce((s, c) => s + c.naiveKm, 0);
    const road = plan.routes.reduce((s, r) => s + r.km, 0);
    return { straight, naive, road, saved: naive > 0 ? Math.max(0, ((naive - straight) / naive) * 100) : 0 };
  }, [plan]);

  const busy = status === "routing" || status === "drawing";

  return (
    <Card
      title="Deployment plan (shortest route for repair crews)"
      right={<span className="text-xs text-slate-500">Travelling salesman route, optimised with nearest neighbour + 2-opt</span>}
    >
      <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="text-sm text-slate-600">
          <span className="block text-xs text-slate-400">Sites to fix (top priority first)</span>
          <div className="flex items-center gap-2">
            <input type="range" min={4} max={Math.min(30, ranked.length || 30)} value={nStops} disabled={busy} onChange={(e) => { reset(); setNStops(Number(e.target.value)); }} />
            <b className="w-6 text-slate-900">{nStops}</b>
          </div>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block text-xs text-slate-400">Repair crews</span>
          <select className="rounded-md border bg-white px-2 py-1 text-sm" style={{ borderColor: "var(--border)" }} value={nCrews} disabled={busy} onChange={(e) => { reset(); setNCrews(Number(e.target.value)); }}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "crew" : "crews"}</option>)}
          </select>
        </label>
        <button
          onClick={generate}
          disabled={busy || !mapReady}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: TEAL.deep }}
        >
          <Icon name="route" size={16} />
          {status === "routing" ? "Finding roads..." : status === "drawing" ? "Drawing network..." : plan ? "Regenerate plan" : "Generate deployment plan"}
        </button>
        {plan && !busy && (
          <button onClick={reset} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" style={{ borderColor: "var(--border)" }}>
            Clear
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-md" style={{ border: "1px solid var(--border)", height: 520 }}>
        <div ref={hostRef} className="h-full w-full" />
        {status === "drawing" && (
          <div className="absolute bottom-3 left-3 right-3 rounded-md bg-white/95 px-3 py-2 shadow" style={{ zIndex: 1000 }}>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: TEAL.deep }} />
            </div>
          </div>
        )}
        {!plan && (
          <div className="absolute left-3 top-3 rounded-md bg-white/95 px-3 py-2 text-xs text-slate-600 shadow" style={{ zIndex: 1000 }}>
            Drag the DEPOT marker to where crews start from, then generate the plan.
          </div>
        )}
      </div>

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi value={`${stats.road.toFixed(1)} km`} label={plan!.routes.every((r) => r.road) ? "Total driving distance" : "Total distance (straight-line)"} color={TEAL.deep} />
            <Kpi value={plan!.crews.reduce((s, c) => s + c.order.length, 0)} label="Sites covered" color={TIER.high.color} />
            <Kpi value={`${stats.saved.toFixed(0)}%`} label="Shorter than visiting in priority order" color={TIER.low.color} />
            <Kpi value={fmtHours(Math.max(...plan!.crews.map((c, i) => plan!.routes[i].km / 25 + (c.order.length * 20) / 60)))} label="Estimated finish (longest crew)" color={TIER.medium.color} />
          </div>
          {roadFail && <p className="mt-2 text-xs text-amber-700">Road routing service was unreachable for some crews, so those paths are straight lines between stops.</p>}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {plan!.crews.map((c, ci) => {
              const rt = plan!.routes[ci];
              return (
                <div key={c.id} className="rounded-lg border bg-white p-3" style={{ borderColor: "var(--border)", borderTop: `4px solid ${c.color}` }}>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      <span style={{ color: c.color }}><Icon name="truck" size={18} /></span> Crew {c.id + 1}
                    </p>
                    <span className="text-xs text-slate-500">{c.order.length} stops · {rt.km.toFixed(1)} km · {fmtHours(rt.km / 25 + (c.order.length * 20) / 60)}</span>
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {c.order.map((o, j) => (
                      <li key={o.location_id} className="flex items-center gap-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: c.color }}>{j + 1}</span>
                        <span className="font-medium text-slate-900">{o.location_id}</span>
                        <span className="text-slate-400">{clean(o.zone)}</span>
                        <span className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: TIER[tierByFraction(o.priority_rank / total)].bg, color: TIER[tierByFraction(o.priority_rank / total)].color }}>
                          #{o.priority_rank}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Sites are split between crews by location (k-means), then each crew gets a closed tour from the depot that is optimised with nearest neighbour and 2-opt. Time assumes 25 km/h average speed and 20 minutes per repair.
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Priority bands chart                                                */
/* ------------------------------------------------------------------ */

function BandChart({ data }: { data: M1[] }) {
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [m1, setM1] = useState<M1[]>([]);
  const [m3, setM3] = useState<M3[]>([]);
  const [m2, setM2] = useState<M2[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(12);
  const mapSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/module1_priority.json").then((r) => r.json()).then(setM1).catch(() => { });
    fetch("/data/module3_divergence.json").then((r) => r.json()).then(setM3).catch(() => { });
    fetch("/data/module2_traffic.json").then((r) => r.json()).then(setM2).catch(() => { });
  }, []);

  const total = m1.length;
  const m2map = useMemo(() => new Map(m2.map((r) => [r.location_id, r])), [m2]);
  const ranked = useMemo<Row[]>(
    () => [...m1].sort((a, b) => a.priority_rank - b.priority_rank).map((r) => ({ ...r, tt: m2map.get(r.location_id) })),
    [m1, m2map]
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

  const schedule = useMemo(() => ranked.filter((r) => r.tt).slice(0, 12), [ranked]);
  const traffic = useMemo(() => {
    const live = m2.filter((r) => r.congestion !== null);
    const buckets = [
      { label: "Night (00 to 06)", color: TEAL.deep, test: (h: number) => h < 6 },
      { label: "Morning (06 to 10)", color: TEAL.mid, test: (h: number) => h >= 6 && h < 10 },
      { label: "Midday (10 to 16)", color: TEAL.light, test: (h: number) => h >= 10 && h < 16 },
      { label: "Evening (16 to 24)", color: "#5eceda", test: (h: number) => h >= 16 },
    ].map((b) => ({ label: b.label, color: b.color, value: m2.filter((r) => b.test(r.window_start)).length }));
    return { measured: live.length, buckets };
  }, [m2]);

  const counts = useMemo(() => {
    let high = 0, med = 0, low = 0;
    m1.forEach((r) => { const t = tierByFraction(r.priority_rank / total); if (t === "high") high++; else if (t === "medium") med++; else low++; });
    const conf = { high: 0, medium: 0, low: 0 } as Record<string, number>;
    m1.forEach((r) => (conf[r.confidence] += 1));
    return { high, med, low, conf };
  }, [m1, total]);

  const seg = useMemo(() => ({
    blind: m3.filter((r) => r.divergence_category === "potential_blind_spot").length,
    gap: m3.filter((r) => r.divergence_category === "potential_reporting_gap").length,
    aligned: m3.filter((r) => r.divergence_category === "signals_aligned").length,
  }), [m3]);

  const blindSpots = useMemo(
    () => m3.filter((r) => r.divergence_category === "potential_blind_spot").sort((a, b) => b.divergence - a.divergence).slice(0, 8),
    [m3]
  );

  const zones = useMemo(() => {
    const g = new Map<string, M1[]>();
    m1.forEach((r) => { if (!g.has(r.zone)) g.set(r.zone, []); g.get(r.zone)!.push(r); });
    const arr = [...g.entries()].map(([zone, items]) => ({
      zone,
      avg: items.reduce((s, r) => s + r.predicted, 0) / items.length,
      count: items.length,
      inc: items.reduce((s, r) => s + r.incident_count, 0),
      comp: items.reduce((s, r) => s + r.complaint_count, 0),
      inj: items.reduce((s, r) => s + r.injury_count, 0),
    })).sort((a, b) => b.avg - a.avg);
    const nz = arr.length || 1;
    return arr.map((z, i) => ({ ...z, rank: i + 1, tier: tierByFraction((i + 1) / nz) as Tier }));
  }, [m1]);

  const legend = (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.high.color }} /> high</span>
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.medium.color }} /> medium</span>
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.low.color }} /> low</span>
    </div>
  );

  const selTier = selected ? tierByFraction(selected.priority_rank / total) : "low";

  return (
    <>
      {/* HERO: full-screen 3D city, edge to edge (outside the centred content column) */}
      <section className="relative w-full overflow-hidden" style={{ height: "100vh", minHeight: 560, background: "#0b1220" }}>
        <City3D rows={ranked} selectedId={selectedId} onSelect={setSelectedId} />

        {/* title overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-5 sm:p-8" style={{ zIndex: 5, background: "linear-gradient(to bottom, rgba(11,18,32,0.92), rgba(11,18,32,0))" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL.mid }}>Municipal road-safety dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-5xl">Where Should We Fix First</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
            Every tower is a location in Vijayawada and Amaravati. The taller and redder it is, the sooner a crew should get there. Click a tower for its summary.
          </p>
        </div>

        {/* legend on dark */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-md bg-slate-900/80 px-3 py-2 text-xs text-slate-200" style={{ zIndex: 5 }}>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.high.color }} /> high</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.medium.color }} /> medium</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER.low.color }} /> low</span>
        </div>

        {/* scroll cue */}
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

      {/* KPI row */}
      <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi value={total || "..."} label="Locations analysed" color={TEAL.deep} />
        <Kpi value={counts.high || "..."} label="High priority" color={TIER.high.color} />
        <Kpi value={seg.blind || "..."} label="Reporting blind spots" color={TIER.medium.color} />
        <Kpi value={traffic.measured || "..."} label="Roads measured live (TomTom)" color={TEAL.deep} />
      </section>

      {/* 2D MAP */}
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

      {/* 3. DEPLOYMENT PLAN */}
      <section className="mt-5">
        <DeployMap ranked={ranked} total={total} />
      </section>

      {/* PRIORITY LIST (at the end) */}
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

                {r.tt && (
                  <p className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: TEAL.deep }}>
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

      {/* Blind spots */}
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
import type { LatLng, Row, Crew } from "./types";
import { CREW_COLORS } from "./theme";

export function hav(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function closedLen(order: number[], d: number[][]) {
  let t = 0;
  for (let i = 0; i < order.length; i++) t += d[order[i]][order[(i + 1) % order.length]];
  return t;
}

// nearest-neighbour start + 2-opt. pts[0] = depot
export function solveTSP(pts: LatLng[]): number[] {
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

export function kmeans(pts: LatLng[], k: number): number[] {
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

export function buildPlan(stops: Row[], depot: LatLng, k: number): Crew[] {
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

export function densify(wps: LatLng[], per = 40): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    for (let t = 0; t < per; t++) {
      out.push([wps[i][0] + ((wps[i + 1][0] - wps[i][0]) * t) / per, wps[i][1] + ((wps[i + 1][1] - wps[i][1]) * t) / per]);
    }
  }
  out.push(wps[wps.length - 1]);
  return out;
}

export function indexStops(coords: LatLng[], stops: LatLng[]) {
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

export function fmtHours(h: number) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export type M1 = {
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

export type M3 = {
  location_id: string;
  zone: string;
  incident_count: number;
  complaint_count: number;
  divergence: number;
  divergence_category: string;
  explanation: string;
  rank: number;
};

// tomtom traffic + repair window
export type M2 = {
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

// module 2: weekly severe-incident risk
export type Risk = {
  location_id: string;
  risk_prob: number;
  risk_label: "elevated" | "moderate" | "low";
  season: string;
  rain_mm: number;
  explanation: string;
  risk_rank: number;
};

// tomtom live (flow + incidents), top-N only
export type TrafficFeat = {
  location_id: string;
  congestion_ratio: number | null;
  roadClosure: boolean;
  frc: string | null;
  live_incident_count: number | null;
  max_live_delay: number | null;
  measured_at: string;
};

// fusion: composite score + why card
export type Composite = {
  location_id: string;
  zone: string;
  latitude: number;
  longitude: number;
  road_type: string;
  road_condition: string;
  band_low: number;
  band_high: number;
  m1_confidence: string;
  risk_prob?: number;
  risk_label?: string;
  divergence?: number;
  m3_flag?: string;
  composite: number;
  composite_rank: number;
  why_card: string[];
};

export type Row = M1 & { tt?: M2; risk?: Risk; live?: TrafficFeat };
export type LatLng = [number, number];

export type Tier = "high" | "medium" | "low";
export type Tone = "bad" | "warn" | "good" | "info" | "mute";
export type Fact = { icon: string; label: string; value: string; tone: Tone };

export type Crew = { id: number; color: string; order: Row[]; straightKm: number; naiveKm: number };
export type RouteRes = { coords: LatLng[]; km: number; road: boolean };

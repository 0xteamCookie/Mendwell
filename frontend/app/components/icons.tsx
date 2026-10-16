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
  rain: ["M7 14a5 5 0 011-9.9A6 6 0 0119 9a4 4 0 010 8H7", "M8 19l-1 2", "M12 19l-1 2", "M16 19l-1 2"],
  layers: ["M12 2L2 7l10 5 10-5-10-5z", "M2 12l10 5 10-5", "M2 17l10 5 10-5"],
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICONS[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

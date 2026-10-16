import { useEffect, useRef, useState } from "react";
import type { Row } from "../lib/types";
import { TIER, tierByFraction } from "../lib/theme";
import { loadThree } from "../lib/cdn";

export function City3D({ rows, selectedId, onSelect }: { rows: Row[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
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

      // filler city blocks, seeded for stability
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

      // rank labels, top 8
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

      // hand-rolled orbit camera
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

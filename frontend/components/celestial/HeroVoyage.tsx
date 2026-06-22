"use client";

import { useEffect, useRef } from "react";

/**
 * HeroVoyage — celestial-navigation hero animation.
 * A drifting starfield connects into the Velnor sail constellation while a ship
 * glides a charted course below, trailing a wake. Wind currents drift, the
 * occasional star shoots across, and the whole scene parallaxes with the cursor.
 * Self-contained canvas, no deps. Respects prefers-reduced-motion.
 */
export default function HeroVoyage() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const TEAL = "12, 181, 201";
    const BRIGHT = "94,234,212";
    const EMER = "52,211,153";

    let w = 0;
    let h = 0;

    type Star = { x: number; y: number; r: number; base: number; phase: number; sp: number; depth: number };
    let stars: Star[] = [];

    // Sail constellation anchors (normalized) — a clear billowing sail
    const sailPts = [
      { x: 0.36, y: 0.10 }, // 0 masthead
      { x: 0.32, y: 0.86 }, // 1 mast base
      { x: 0.64, y: 0.76 }, // 2 clew
      { x: 0.55, y: 0.30 }, // 3 leech upper
      { x: 0.78, y: 0.50 }, // 4 leech mid (billow)
      { x: 0.68, y: 0.66 }, // 5 leech lower
      { x: 0.88, y: 0.18 }, // 6 outlier star
      { x: 0.15, y: 0.44 }, // 7 outlier star
    ];
    const edges: [number, number][] = [
      [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [5, 2], [0, 6], [7, 1],
    ];
    let anchors: { x: number; y: number }[] = [];

    type Wind = { y: number; amp: number; speed: number; off: number };
    let winds: Wind[] = [];

    const wake: { x: number; y: number; life: number }[] = [];
    type Shoot = { x: number; y: number; vx: number; vy: number; life: number };
    let shoots: Shoot[] = [];
    let nextShoot = 2.5;

    // parallax
    let tmx = 0, tmy = 0, pmx = 0, pmy = 0;

    function build() {
      const rect = parent!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(95, Math.max(34, Math.floor((w * h) / 2500)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        base: Math.random() * 0.3 + 0.15,
        phase: Math.random() * Math.PI * 2,
        sp: Math.random() * 1.6 + 0.5,
        depth: Math.random() * 0.8 + 0.2,
      }));
      anchors = sailPts.map((p) => ({ x: p.x * w, y: p.y * h }));
      winds = [0.28, 0.5, 0.7].map((y, i) => ({
        y: y * h,
        amp: 11 + i * 5,
        speed: 18 + i * 7,
        off: Math.random() * 1000,
      }));
    }

    function course(tp: number) {
      const p0 = { x: 0.02 * w, y: 0.92 * h };
      const c = { x: 0.5 * w, y: 1.05 * h };
      const p1 = { x: 0.98 * w, y: 0.74 * h };
      const u = 1 - tp;
      const x = u * u * p0.x + 2 * u * tp * c.x + tp * tp * p1.x;
      const y = u * u * p0.y + 2 * u * tp * c.y + tp * tp * p1.y;
      const dx = 2 * u * (c.x - p0.x) + 2 * tp * (p1.x - c.x);
      const dy = 2 * u * (c.y - p0.y) + 2 * tp * (p1.y - c.y);
      return { x, y, ang: Math.atan2(dy, dx) };
    }

    function drawShip(x: number, y: number, ang: number) {
      ctx!.save();
      ctx!.translate(x, y);
      const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, 22);
      g.addColorStop(0, `rgba(${BRIGHT},0.55)`);
      g.addColorStop(1, `rgba(${TEAL},0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(0, 0, 22, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.rotate(ang * 0.3);
      // hull
      ctx!.strokeStyle = `rgba(${BRIGHT},1)`;
      ctx!.lineWidth = 1.8;
      ctx!.beginPath();
      ctx!.moveTo(-7, 3);
      ctx!.quadraticCurveTo(0, 7, 7, 3);
      ctx!.stroke();
      // mast
      ctx!.beginPath();
      ctx!.moveTo(0, 3);
      ctx!.lineTo(0, -10);
      ctx!.stroke();
      // sail
      ctx!.fillStyle = `rgba(${TEAL},0.9)`;
      ctx!.beginPath();
      ctx!.moveTo(0.5, 2);
      ctx!.lineTo(0.5, -9);
      ctx!.quadraticCurveTo(7, -4, 4, 2);
      ctx!.closePath();
      ctx!.fill();
      ctx!.restore();
    }

    const start = performance.now();
    let raf = 0;

    function render(now: number) {
      const t = (now - start) / 1000;
      // ease parallax
      pmx += (tmx - pmx) * 0.05;
      pmy += (tmy - pmy) * 0.05;
      ctx!.clearRect(0, 0, w, h);

      // wind currents
      for (const wd of winds) {
        ctx!.beginPath();
        for (let i = 0; i <= 60; i++) {
          const px = (i / 60) * (w + 80) - 40;
          const py = wd.y + Math.sin((px + t * wd.speed + wd.off) * 0.012) * wd.amp;
          if (i === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        const grad = ctx!.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(${TEAL},0)`);
        grad.addColorStop(0.5, `rgba(${TEAL},0.2)`);
        grad.addColorStop(1, `rgba(${EMER},0)`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // drifting stars (parallax by depth)
      for (const s of stars) {
        const ox = pmx * 6 * s.depth;
        const oy = pmy * 6 * s.depth;
        const al = s.base + 0.4 * (0.5 + 0.5 * Math.sin(s.phase + t * s.sp));
        ctx!.beginPath();
        ctx!.arc(s.x + ox, s.y + oy + Math.sin(t * 0.1 + s.phase) * 2, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(148,163,184,${al})`;
        ctx!.fill();
      }

      // shooting stars
      if (!reduce) {
        nextShoot -= 1 / 60;
        if (nextShoot <= 0) {
          nextShoot = 4 + Math.random() * 5;
          const fromLeft = Math.random() > 0.5;
          shoots.push({
            x: fromLeft ? -20 : w + 20,
            y: Math.random() * h * 0.5,
            vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 120),
            vy: 60 + Math.random() * 50,
            life: 1,
          });
        }
        for (let i = shoots.length - 1; i >= 0; i--) {
          const sh = shoots[i];
          sh.x += sh.vx / 60;
          sh.y += sh.vy / 60;
          sh.life -= 0.012;
          if (sh.life <= 0) { shoots.splice(i, 1); continue; }
          const tailX = sh.x - sh.vx * 0.12;
          const tailY = sh.y - sh.vy * 0.12;
          const grad = ctx!.createLinearGradient(tailX, tailY, sh.x, sh.y);
          grad.addColorStop(0, `rgba(${BRIGHT},0)`);
          grad.addColorStop(1, `rgba(${BRIGHT},${0.8 * sh.life})`);
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = 1.4;
          ctx!.beginPath();
          ctx!.moveTo(tailX, tailY);
          ctx!.lineTo(sh.x, sh.y);
          ctx!.stroke();
        }
      }

      // constellation (parallax — foreground moves more)
      const cox = pmx * 14;
      const coy = pmy * 14;
      const dp = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.4) / 3.2));
      const shown = dp * edges.length;
      for (let i = 0; i < edges.length; i++) {
        const frac = Math.max(0, Math.min(1, shown - i));
        if (frac <= 0) continue;
        const a = anchors[edges[i][0]];
        const b = anchors[edges[i][1]];
        const ax = a.x + cox, ay = a.y + coy;
        const ex = ax + (b.x - a.x) * frac;
        const ey = ay + (b.y - a.y) * frac;
        const outline = i < 6;
        const shimmer = 0.5 + 0.5 * Math.sin(t * 1.2 + i);
        ctx!.beginPath();
        ctx!.moveTo(ax, ay);
        ctx!.lineTo(ex, ey);
        ctx!.strokeStyle = outline
          ? `rgba(${TEAL},${0.34 + 0.18 * shimmer})`
          : `rgba(${TEAL},${0.12 + 0.08 * shimmer})`;
        ctx!.lineWidth = outline ? 1.4 : 0.9;
        ctx!.stroke();
      }
      // anchor stars
      for (let i = 0; i < anchors.length; i++) {
        const appear = Math.min(1, Math.max(0, dp * edges.length - i * 0.5));
        if (appear <= 0) continue;
        const ax = anchors[i].x + cox;
        const ay = anchors[i].y + coy;
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
        ctx!.beginPath();
        ctx!.arc(ax, ay, 2 + tw, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${BRIGHT},${0.85 * appear})`;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(ax, ay, 8 + tw * 2.4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${TEAL},${0.12 * appear})`;
        ctx!.fill();
      }

      // course line
      ctx!.save();
      ctx!.setLineDash([2, 7]);
      ctx!.beginPath();
      for (let i = 0; i <= 50; i++) {
        const p = course(i / 50);
        if (i === 0) ctx!.moveTo(p.x, p.y);
        else ctx!.lineTo(p.x, p.y);
      }
      ctx!.strokeStyle = `rgba(${TEAL},0.3)`;
      ctx!.lineWidth = 1.2;
      ctx!.stroke();
      ctx!.restore();

      // ship + wake
      const prog = reduce ? 0.5 : (t * 0.045) % 1;
      const p = course(prog);
      if (!reduce) {
        if (Math.floor(now / 28) % 2 === 0) wake.push({ x: p.x, y: p.y, life: 1 });
        for (let i = wake.length - 1; i >= 0; i--) {
          const wkp = wake[i];
          wkp.life -= 0.018;
          if (wkp.life <= 0) { wake.splice(i, 1); continue; }
          ctx!.beginPath();
          ctx!.arc(wkp.x, wkp.y, 1.6 * wkp.life, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${BRIGHT},${0.3 * wkp.life})`;
          ctx!.fill();
        }
      }
      drawShip(p.x, p.y, p.ang);

      raf = requestAnimationFrame(render);
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      tmx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      tmy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function onLeave() { tmx = 0; tmy = 0; }

    build();
    if (reduce) {
      render(start + 5000);
    } else {
      raf = requestAnimationFrame(render);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseout", onLeave);
    }
    const onResize = () => build();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

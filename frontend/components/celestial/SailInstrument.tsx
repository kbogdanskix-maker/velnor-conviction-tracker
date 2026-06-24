"use client";

import { useEffect, useRef } from "react";

/**
 * SailInstrument — cursor-steered "living instrument" sail for the Velnor landing hero.
 *
 * One canvas draws:
 *   - drifting starfield + low-opacity sail constellation (backdrop, pulled back)
 *   - a bezier-rendered billowing sail that eases its belly-depth and lean angle
 *     toward the cursor (windward side fills deeper; ambient billow underneath)
 *   - wind current lines that bend vertically toward the sail as they pass
 *   - the ship gliding its bezier course with heading nudged by trim
 *
 * Absolutely-positioned <span> overlays provide the live HEADING readout, updated
 * via refs each frame (never React setState — design-system §5).
 *
 * Respects prefers-reduced-motion: no pointer binding, gentle idle billow, static heading.
 * Canvas is aria-hidden, pointer-events:none — never blocks page interaction.
 */
export default function SailInstrument() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── Colour constants ──────────────────────────────────────────────────────
    const TEAL = "26, 168, 187";        // #1AA8BB — brand accent only
    const BRIGHT = "94, 234, 212";      // highlight, sparingly

    let w = 0, h = 0;

    // ── Starfield ─────────────────────────────────────────────────────────────
    type Star = { x: number; y: number; r: number; base: number; phase: number; sp: number; depth: number };
    let stars: Star[] = [];

    // ── Sail constellation anchors (dialed back — backdrop role) ──────────────
    // Normalized positions matching the sail silhouette in HeroVoyage
    const sailPts = [
      { x: 0.36, y: 0.10 }, // 0 masthead
      { x: 0.32, y: 0.86 }, // 1 mast base
      { x: 0.64, y: 0.76 }, // 2 clew
      { x: 0.55, y: 0.30 }, // 3 leech upper
      { x: 0.78, y: 0.50 }, // 4 leech mid (billow)
      { x: 0.68, y: 0.66 }, // 5 leech lower
      { x: 0.88, y: 0.18 }, // 6 outlier
      { x: 0.15, y: 0.44 }, // 7 outlier
    ];
    const edges: [number, number][] = [
      [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [5, 2], [0, 6], [7, 1],
    ];
    let anchors: { x: number; y: number }[] = [];

    // ── Wind lines ────────────────────────────────────────────────────────────
    type Wind = { y: number; amp: number; speed: number; off: number };
    let winds: Wind[] = [];

    // ── Ship wake ─────────────────────────────────────────────────────────────
    const wake: { x: number; y: number; life: number }[] = [];

    // ── Parallax / trim state ─────────────────────────────────────────────────
    // tmx/tmy = raw cursor target (-1..+1). pmx/pmy = eased value.
    let tmx = 0, tmy = 0, pmx = 0, pmy = 0;
    // Trim angle derived from pmx, in degrees (for HEADING readout)
    let trimAngle = 41; // base bearing
    let lastTrimAngle = 41;

    // ── Build ─────────────────────────────────────────────────────────────────
    function build() {
      const rect = parent!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(80, Math.max(28, Math.floor((w * h) / 3000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.25,
        base: Math.random() * 0.2 + 0.08, // dimmer than HeroVoyage — backdrop role
        phase: Math.random() * Math.PI * 2,
        sp: Math.random() * 1.4 + 0.4,
        depth: Math.random() * 0.8 + 0.2,
      }));

      anchors = sailPts.map((p) => ({ x: p.x * w, y: p.y * h }));

      winds = [0.25, 0.50, 0.72].map((y, i) => ({
        y: y * h,
        amp: 10 + i * 4,
        speed: 16 + i * 6,
        off: Math.random() * 1000,
      }));
    }

    // ── Bezier course (ship path) ─────────────────────────────────────────────
    function course(tp: number) {
      const p0 = { x: 0.02 * w, y: 0.92 * h };
      const c  = { x: 0.50 * w, y: 1.05 * h };
      const p1 = { x: 0.98 * w, y: 0.74 * h };
      const u = 1 - tp;
      const x  = u * u * p0.x + 2 * u * tp * c.x + tp * tp * p1.x;
      const y  = u * u * p0.y + 2 * u * tp * c.y + tp * tp * p1.y;
      const dx = 2 * u * (c.x - p0.x) + 2 * tp * (p1.x - c.x);
      const dy = 2 * u * (c.y - p0.y) + 2 * tp * (p1.y - c.y);
      return { x, y, ang: Math.atan2(dy, dx) };
    }

    // ── Miniature ship ────────────────────────────────────────────────────────
    function drawShip(x: number, y: number, ang: number) {
      ctx!.save();
      ctx!.translate(x, y);
      // soft radial halo — the only decorative glow allowed
      const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, 18);
      g.addColorStop(0, `rgba(${BRIGHT},0.4)`);
      g.addColorStop(1, `rgba(${TEAL},0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(0, 0, 18, 0, Math.PI * 2);
      ctx!.fill();

      // ship heading nudged by trim (pmx drives lean)
      ctx!.rotate(ang * 0.3 + pmx * 0.08);

      // hull
      ctx!.strokeStyle = `rgba(${BRIGHT},1)`;
      ctx!.lineWidth = 1.6;
      ctx!.beginPath();
      ctx!.moveTo(-6, 3);
      ctx!.quadraticCurveTo(0, 6, 6, 3);
      ctx!.stroke();
      // mast
      ctx!.lineWidth = 1.4;
      ctx!.beginPath();
      ctx!.moveTo(0, 3);
      ctx!.lineTo(0, -9);
      ctx!.stroke();
      // mini-sail filled with teal
      ctx!.fillStyle = `rgba(${TEAL},0.85)`;
      ctx!.beginPath();
      ctx!.moveTo(0.4, 2);
      ctx!.lineTo(0.4, -8);
      ctx!.quadraticCurveTo(6, -3.5, 3.5, 2);
      ctx!.closePath();
      ctx!.fill();

      ctx!.restore();
    }

    // ── Main sail bezier ──────────────────────────────────────────────────────
    /**
     * Draws the hero sail as a closed bezier shape.
     *
     * The sail has:
     *   - A luff (leading edge) from masthead to tack — nearly straight, slight inside bow
     *   - A leech (trailing edge) from clew up to masthead — the billowing curve
     *   - A foot (bottom edge) from tack to clew
     *
     * Cursor influence:
     *   - pmx < 0 (cursor left / windward) → belly fills deeper, mast leans right (natural trim)
     *   - pmx > 0 (cursor right / leeward) → belly is flatter, mast leans left
     *   - pmy offsets the belly height
     *
     * Ambient billow: a slow sin wave on bellyDepth so the sail always breathes.
     */
    function drawSail(t: number) {
      // Sail geometry in proportional canvas coordinates
      // Origin: sail center-of-mass ~(0.40, 0.50)
      const mastX  = w * 0.40;
      const mastY0 = h * 0.10;  // masthead (top)
      const mastY1 = h * 0.82;  // tack / mast base
      const tackX  = mastX - w * 0.02;
      const clewX  = w * 0.70;
      const clewY  = h * 0.73;

      // Ambient billow (breathes even without cursor movement)
      const ambillow = Math.sin(t * 0.55) * 0.018 + Math.sin(t * 0.31) * 0.009;

      // Cursor-driven belly: pmx left = more fill (negative pmx fills more)
      // Range clamped so the sail never goes flat or inverted
      const bellyCursorX = -pmx * 0.14;  // pmx left → positive fill
      const bellyDepth = Math.max(0.06, Math.min(0.28, 0.18 + bellyCursorX + ambillow));

      // Lean: mast top tilts toward the windward (cursor) side
      const leanX = pmx * w * 0.05;
      const leanY = pmy * h * 0.025;

      // Control points for the leech (the billowing trailing edge)
      const leechwayX = clewX + (bellyDepth * w * 0.65); // how far the belly pushes out
      const leechwayY = h * (0.38 + 0.05 * pmy);          // belly height influenced by pmy

      // Additional secondary control for a more organic upper leech
      const leechUpperX = clewX + bellyDepth * w * 0.38;
      const leechUpperY = h * (0.22 + 0.04 * pmy);

      // Draw the sail shape
      ctx!.save();

      // Shadow / depth — very soft, teal only
      ctx!.shadowColor = `rgba(${TEAL},0.12)`;
      ctx!.shadowBlur = 18;

      // Fill: semi-transparent teal with a subtle gradient luff-to-leech
      const sailGrad = ctx!.createLinearGradient(mastX + leanX, mastY0 + leanY, leechwayX, leechwayY);
      sailGrad.addColorStop(0,   `rgba(${TEAL},0.08)`);
      sailGrad.addColorStop(0.45, `rgba(${TEAL},0.18)`);
      sailGrad.addColorStop(1,   `rgba(${TEAL},0.07)`);
      ctx!.fillStyle = sailGrad;

      ctx!.beginPath();
      // Masthead
      ctx!.moveTo(mastX + leanX, mastY0 + leanY);
      // Luff (leading edge) down to tack — nearly straight, slight concave bow inward
      ctx!.quadraticCurveTo(
        tackX + leanX * 0.3 - w * 0.01,
        mastY0 + (mastY1 - mastY0) * 0.5 + leanY * 0.5,
        tackX,
        mastY1,
      );
      // Foot from tack to clew
      ctx!.lineTo(clewX, clewY);
      // Leech from clew up to masthead — the live bezier belly
      ctx!.bezierCurveTo(
        leechUpperX,  leechUpperY,        // upper control — lighter lift
        leechwayX,    leechwayY,          // main belly bulge
        mastX + leanX, mastY0 + leanY,   // back to masthead
      );
      ctx!.closePath();
      ctx!.fill();

      // Hairline stroke: leech edge
      ctx!.shadowBlur = 0;
      const strokeGrad = ctx!.createLinearGradient(mastX + leanX, mastY0, leechwayX, leechwayY);
      strokeGrad.addColorStop(0,   `rgba(${BRIGHT},0.55)`);
      strokeGrad.addColorStop(0.5, `rgba(${TEAL},0.70)`);
      strokeGrad.addColorStop(1,   `rgba(${TEAL},0.30)`);
      ctx!.strokeStyle = strokeGrad;
      ctx!.lineWidth = 1.4;
      ctx!.beginPath();
      ctx!.moveTo(clewX, clewY);
      ctx!.bezierCurveTo(
        leechUpperX,  leechUpperY,
        leechwayX,    leechwayY,
        mastX + leanX, mastY0 + leanY,
      );
      ctx!.stroke();

      // Hairline luff (leading edge)
      ctx!.strokeStyle = `rgba(${BRIGHT},0.45)`;
      ctx!.lineWidth = 1.1;
      ctx!.beginPath();
      ctx!.moveTo(mastX + leanX, mastY0 + leanY);
      ctx!.quadraticCurveTo(
        tackX + leanX * 0.3 - w * 0.01,
        mastY0 + (mastY1 - mastY0) * 0.5 + leanY * 0.5,
        tackX,
        mastY1,
      );
      ctx!.stroke();

      // Mast (the vertical spar)
      ctx!.strokeStyle = `rgba(${BRIGHT},0.75)`;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.moveTo(tackX, mastY1);
      ctx!.lineTo(mastX + leanX, mastY0 + leanY);
      ctx!.stroke();

      // Masthead jewel — the star at the top
      const mastheadGlow = ctx!.createRadialGradient(
        mastX + leanX, mastY0 + leanY, 0,
        mastX + leanX, mastY0 + leanY, 10,
      );
      mastheadGlow.addColorStop(0, `rgba(${BRIGHT},0.9)`);
      mastheadGlow.addColorStop(1, `rgba(${BRIGHT},0)`);
      ctx!.fillStyle = mastheadGlow;
      ctx!.beginPath();
      ctx!.arc(mastX + leanX, mastY0 + leanY, 10, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = `rgba(${BRIGHT},1)`;
      ctx!.beginPath();
      ctx!.arc(mastX + leanX, mastY0 + leanY, 2, 0, Math.PI * 2);
      ctx!.fill();

      // Seam line (panel seam — the precision detail)
      const seamProgress = 0.12 + 0.18 * (1 - bellyDepth / 0.28);
      const seamX1 = mastX + leanX + (clewX - mastX - leanX) * seamProgress;
      const seamY1 = mastY0 + leanY + (mastY1 - mastY0 - leanY) * (seamProgress * 0.4);
      const seamX2 = leechwayX * (1 - seamProgress) + clewX * seamProgress;
      const seamY2 = leechwayY * (1 - seamProgress) + clewY * seamProgress;
      ctx!.strokeStyle = `rgba(${TEAL},0.22)`;
      ctx!.lineWidth = 0.8;
      ctx!.setLineDash([3, 6]);
      ctx!.beginPath();
      ctx!.moveTo(seamX1, seamY1);
      ctx!.lineTo(seamX2, seamY2);
      ctx!.stroke();
      ctx!.setLineDash([]);

      ctx!.restore();

      // Compute trim angle for the HEADING readout
      // pmx left = heading lower (sailing higher into the wind) → smaller degrees
      // pmx right = heading higher → larger degrees
      trimAngle = 41 + pmx * 22;
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    const start = performance.now();
    let raf = 0;

    function draw(now: number) {
      const t = (now - start) / 1000;

      // Ease parallax/trim toward cursor target
      const ease = reduce ? 0 : 0.05;
      pmx += (tmx - pmx) * ease;
      pmy += (tmy - pmy) * ease;

      ctx!.clearRect(0, 0, w, h);

      // ── 1. Wind current lines (bending toward sail) ───────────────────────
      for (const wd of winds) {
        ctx!.beginPath();
        for (let i = 0; i <= 60; i++) {
          const px = (i / 60) * (w + 80) - 40;
          // Base sine wave
          let py = wd.y + Math.sin((px + t * wd.speed + wd.off) * 0.012) * wd.amp;
          // Bend toward sail center as the line passes through the sail region
          // Sail X center is roughly 0.50w; influence decays with horizontal distance
          const sailCX = w * 0.50;
          const proximity = Math.exp(-Math.pow((px - sailCX) / (w * 0.22), 2));
          const sailCY = h * (0.45 + pmx * 0.04);
          py += (sailCY - py) * proximity * 0.18;
          if (i === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        const grad = ctx!.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0,   `rgba(${TEAL},0)`);
        grad.addColorStop(0.5, `rgba(${TEAL},0.15)`);
        grad.addColorStop(1,   `rgba(${TEAL},0)`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // ── 2. Stars (dialed back — backdrop role) ────────────────────────────
      for (const s of stars) {
        const ox = pmx * 5 * s.depth;
        const oy = pmy * 5 * s.depth;
        const al = s.base + 0.22 * (0.5 + 0.5 * Math.sin(s.phase + t * s.sp));
        ctx!.beginPath();
        ctx!.arc(s.x + ox, s.y + oy + Math.sin(t * 0.09 + s.phase) * 1.5, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(148,163,184,${al})`;
        ctx!.fill();
      }

      // ── 3. Sail constellation (faint backdrop) ────────────────────────────
      const cox = pmx * 10;
      const coy = pmy * 10;
      // Constellation is always fully revealed (no draw-in animation here — the big sail leads)
      for (let i = 0; i < edges.length; i++) {
        const a = anchors[edges[i][0]];
        const b = anchors[edges[i][1]];
        const shimmer = 0.5 + 0.5 * Math.sin(t * 1.1 + i);
        ctx!.beginPath();
        ctx!.moveTo(a.x + cox, a.y + coy);
        ctx!.lineTo(b.x + cox, b.y + coy);
        // Very low opacity — this is a ghost/echo behind the real sail
        ctx!.strokeStyle = `rgba(${TEAL},${0.07 + 0.05 * shimmer})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }
      for (let i = 0; i < anchors.length; i++) {
        const ax = anchors[i].x + cox;
        const ay = anchors[i].y + coy;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.8 + i);
        ctx!.beginPath();
        ctx!.arc(ax, ay, 1.2 + tw * 0.4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${BRIGHT},0.28)`;
        ctx!.fill();
      }

      // ── 4. The hero sail ──────────────────────────────────────────────────
      drawSail(t);

      // ── 5. Course line ────────────────────────────────────────────────────
      ctx!.save();
      ctx!.setLineDash([2, 7]);
      ctx!.beginPath();
      for (let i = 0; i <= 50; i++) {
        const p = course(i / 50);
        if (i === 0) ctx!.moveTo(p.x, p.y);
        else ctx!.lineTo(p.x, p.y);
      }
      ctx!.strokeStyle = `rgba(${TEAL},0.22)`;
      ctx!.lineWidth = 1.1;
      ctx!.stroke();
      ctx!.restore();

      // ── 6. Ship + wake ────────────────────────────────────────────────────
      const prog = reduce ? 0.5 : (t * 0.042) % 1;
      const p = course(prog);
      if (!reduce) {
        if (Math.floor(now / 30) % 2 === 0) wake.push({ x: p.x, y: p.y, life: 1 });
        for (let i = wake.length - 1; i >= 0; i--) {
          const wkp = wake[i];
          wkp.life -= 0.016;
          if (wkp.life <= 0) { wake.splice(i, 1); continue; }
          ctx!.beginPath();
          ctx!.arc(wkp.x, wkp.y, 1.4 * wkp.life, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${BRIGHT},${0.25 * wkp.life})`;
          ctx!.fill();
        }
      }
      drawShip(p.x, p.y, p.ang);

      // ── 7. Live HEADING readout (DOM ref, not React state) ────────────────
      if (!reduce) {
        const angle = Math.round(trimAngle);
        const clamped = ((angle % 360) + 360) % 360;
        const deg = String(clamped).padStart(3, "0");
        if (headingRef.current) {
          headingRef.current.textContent = `HEADING ${deg}°`;
        }
        const trimming = Math.abs(trimAngle - lastTrimAngle) > 0.15;
        if (statusRef.current) {
          statusRef.current.textContent = trimming ? "TRIMMING ↑" : "ON THE WIND";
        }
        lastTrimAngle = trimAngle;
      }

    }

    // Loop driver, kept separate from draw() so a ResizeObserver repaint can call
    // draw() without spawning a second rAF loop.
    function frame(now: number) {
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      tmx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      tmy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function onLeave() { tmx = 0; tmy = 0; }

    build();

    if (reduce) {
      // Reduced motion: single static frame with ambient billow at t=5s
      draw(start + 5000);
      if (headingRef.current) headingRef.current.textContent = "HEADING 041°";
      if (statusRef.current) statusRef.current.textContent = "ON THE WIND";
    } else {
      // Paint the first frame synchronously so the sail appears immediately even
      // if the initial rAF is delayed/throttled, then start the loop.
      draw(start);
      raf = requestAnimationFrame(frame);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseout", onLeave);
    }

    // ResizeObserver fixes the 0-rect-at-mount case: build() in useEffect can run
    // before layout gives the hero stage its size, leaving the canvas 1x1 until a
    // window resize that never comes. The observer fires with the real size once
    // layout is ready (and on later resizes), so we rebuild + repaint then.
    const ro = new ResizeObserver(() => { build(); draw(performance.now()); });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      />
      {/* Live HEADING readout — updated by ref each frame, never React state */}
      <span
        ref={headingRef}
        aria-hidden
        className="absolute left-2 top-6 font-mono text-[10px] text-zinc-500 tabular-nums z-10 pointer-events-none select-none"
      >
        HEADING 041°
      </span>
      <span
        ref={statusRef}
        aria-hidden
        className="absolute left-0 bottom-8 font-mono text-[10px] text-zinc-600 tabular-nums z-10 pointer-events-none select-none tracking-widest"
      >
        ON THE WIND
      </span>
    </div>
  );
}

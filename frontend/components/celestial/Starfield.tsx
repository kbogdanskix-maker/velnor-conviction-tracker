"use client";

import { useEffect, useRef } from "react";
import { useAnimationPrefs } from "@/contexts/AnimationContext";

interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  speed: number;
  offset: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export default function Starfield({ count = 150 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const rafRef = useRef<number>(0);
  const { prefs } = useAnimationPrefs();
  const disabled = prefs.reduceMotion || prefs.disableBackgroundEffects;

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createStars() {
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 1.8 + 0.4,
        baseOpacity: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.003 + 0.001,
        offset: Math.random() * Math.PI * 2,
      }));
    }

    function spawnShootingStar() {
      if (shootingRef.current.length >= 2) return;
      shootingRef.current.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.4,
        length: Math.random() * 80 + 40,
        speed: Math.random() * 6 + 4,
        angle: (Math.random() * 30 + 15) * (Math.PI / 180),
        opacity: 1,
        life: 0,
        maxLife: Math.random() * 40 + 30,
      });
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, w, h);

      // Stars
      for (const star of starsRef.current) {
        const twinkle = Math.sin(time * star.speed + star.offset);
        const pulse = 0.5 + twinkle * 0.5;
        const alpha = star.baseOpacity * pulse;

        // Star core
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx!.fill();

        // Glow for larger stars
        if (star.radius > 1.2) {
          const grad = ctx!.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.radius * 4,
          );
          grad.addColorStop(0, `rgba(26, 168, 187, ${alpha * 0.3})`);
          grad.addColorStop(1, "rgba(26, 168, 187, 0)");
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.radius * 4, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        }

        // Cross-flare on brightest stars
        if (star.radius > 1.5 && pulse > 0.7) {
          ctx!.strokeStyle = `rgba(220, 235, 255, ${alpha * 0.15})`;
          ctx!.lineWidth = 0.5;
          const fl = star.radius * 6;
          ctx!.beginPath();
          ctx!.moveTo(star.x - fl, star.y);
          ctx!.lineTo(star.x + fl, star.y);
          ctx!.moveTo(star.x, star.y - fl);
          ctx!.lineTo(star.x, star.y + fl);
          ctx!.stroke();
        }
      }

      // Shooting stars
      for (let i = shootingRef.current.length - 1; i >= 0; i--) {
        const s = shootingRef.current[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life++;
        s.opacity = 1 - s.life / s.maxLife;

        if (s.life >= s.maxLife) {
          shootingRef.current.splice(i, 1);
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, "rgba(26, 168, 187, 0)");
        grad.addColorStop(0.7, `rgba(200, 230, 255, ${s.opacity * 0.4})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.opacity * 0.9})`);

        ctx!.beginPath();
        ctx!.moveTo(tailX, tailY);
        ctx!.lineTo(s.x, s.y);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Head glow
        const headGrad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
        headGrad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity * 0.8})`);
        headGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx!.fillStyle = headGrad;
        ctx!.fill();
      }

      // Random shooting star spawn
      if (Math.random() < 0.005) spawnShootingStar();

      rafRef.current = requestAnimationFrame(draw);
    }

    resize();
    createStars();
    rafRef.current = requestAnimationFrame(draw);

    const onResize = () => { resize(); createStars(); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [count, disabled]);

  if (disabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}

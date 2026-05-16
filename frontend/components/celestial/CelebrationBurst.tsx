"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  delay: number;
}

const COLORS = [
  "#14b8a6", // teal-500
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#a78bfa", // violet-400
  "#38bdf8", // sky-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 0,
    y: 0,
    angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
    speed: 40 + Math.random() * 60,
    size: 3 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.15,
  }));
}

interface Props {
  /** Trigger a burst when this flips to true */
  trigger: boolean;
  /** Number of particles (default 24) */
  count?: number;
  /** Duration in ms (default 900) */
  duration?: number;
  className?: string;
}

/**
 * Particle burst celebration effect.
 * Renders absolutely positioned within its parent container.
 */
export default function CelebrationBurst({
  trigger,
  count = 24,
  duration = 900,
  className = "",
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [active, setActive] = useState(false);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger && !prevTrigger.current) {
      setParticles(createParticles(count));
      setActive(true);
      const timer = setTimeout(() => setActive(false), duration + 200);
      return () => clearTimeout(timer);
    }
    prevTrigger.current = trigger;
  }, [trigger, count, duration]);

  return (
    <AnimatePresence>
      {active && (
        <div
          className={`absolute inset-0 pointer-events-none overflow-hidden z-20 ${className}`}
          aria-hidden
        >
          {particles.map((p) => {
            const endX = Math.cos(p.angle) * p.speed;
            const endY = Math.sin(p.angle) * p.speed;
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  left: "50%",
                  top: "50%",
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: endX,
                  y: endY,
                  opacity: [1, 1, 0],
                  scale: [1, 1.2, 0.3],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: duration / 1000,
                  delay: p.delay,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

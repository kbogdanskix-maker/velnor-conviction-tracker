"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useAnimationPrefs } from "@/contexts/AnimationContext";

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  /** Color of the ambient backlight glow */
  glowColor?: string;
  /** Enable 3D tilt on hover */
  tilt?: boolean;
  /** Enable press-down effect on click */
  pressable?: boolean;
  /** Framer motion delay for entrance */
  delay?: number;
  /** onClick handler */
  onClick?: () => void;
}

/**
 * A card that floats above its background with ambient light bleeding through.
 * Features: soft backlight glow, 3D tilt on hover, satisfying press animation.
 */
export default function FloatingCard({
  children,
  className = "",
  glowColor = "rgba(20, 184, 166, 0.12)",
  tilt = true,
  pressable = false,
  delay = 0,
  onClick,
}: FloatingCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { prefs } = useAnimationPrefs();
  const noGlow = prefs.disableGlow;
  const noMotion = prefs.reduceMotion;

  // Mouse position for 3D tilt
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { stiffness: 200, damping: 20 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [0, 1], [3, -3]);
  const rotateY = useTransform(smoothX, [0, 1], [-3, 3]);

  // Spotlight follows cursor
  const spotlightX = useTransform(smoothX, [0, 1], [0, 100]);
  const spotlightY = useTransform(smoothY, [0, 1], [0, 100]);

  function handleMouseMove(e: React.MouseEvent) {
    if (!tilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      className={`relative group ${className}`}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      whileTap={pressable ? { scale: 0.985, y: 2 } : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={(tilt && !noMotion) ? {
        rotateX,
        rotateY,
        transformPerspective: 800,
        transformStyle: "preserve-3d" as const,
      } : undefined}
    >
      {/* Ambient backlight — glow behind the card */}
      {!noGlow && (
        <div
          className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
          style={{ background: glowColor }}
        />
      )}

      {/* Moving spotlight on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden -z-[1]"
        style={{
          background: useTransform(
            [spotlightX, spotlightY],
            ([x, y]: number[]) =>
              `radial-gradient(circle 200px at ${x}% ${y}%, rgba(255,255,255,0.03) 0%, transparent 70%)`
          ),
        }}
      />

      {/* The actual card content */}
      <div className="vela-card relative overflow-hidden">
        {/* Top edge light streak */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.3) 50%, transparent 100%)",
          }}
        />
        {children}
      </div>
    </motion.div>
  );
}

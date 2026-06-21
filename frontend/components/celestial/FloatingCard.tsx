"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { useAnimationPrefs } from "@/contexts/AnimationContext";

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  /** Color of the ambient backlight glow */
  glowColor?: string;
  /** @deprecated tilt is disabled  - kept for API compatibility */
  tilt?: boolean;
  /** Enable press-down effect on click */
  pressable?: boolean;
  /** Framer motion delay for entrance */
  delay?: number;
  /** onClick handler */
  onClick?: () => void;
}

export default function FloatingCard({
  children,
  className = "",
  glowColor = "rgba(20, 184, 166, 0.12)",
  pressable = false,
  delay = 0,
  onClick,
}: FloatingCardProps) {
  const { prefs } = useAnimationPrefs();
  const noGlow = prefs.disableGlow;

  return (
    <motion.div
      className={`relative group ${className}`}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      whileTap={pressable ? { scale: 0.985, y: 2 } : undefined}
      onClick={onClick}
    >
      {/* Ambient backlight  - glow behind the card */}
      {!noGlow && (
        <div
          className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
          style={{ background: glowColor }}
        />
      )}

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

"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  /** @deprecated no longer renders a glow — kept for API compatibility */
  glowColor?: string;
  /** @deprecated tilt is disabled — kept for API compatibility */
  tilt?: boolean;
  /** Enable a subtle press-down effect on click */
  pressable?: boolean;
  /** Framer-motion entrance delay */
  delay?: number;
  /** onClick handler */
  onClick?: () => void;
}

/**
 * Card wrapper: a solid hairline `vela-card` with a clean fade-up entrance.
 * No outer glow, no light streak, no tilt — hover state is the card's own
 * border-brighten (see globals.css `.vela-card:hover`). Calm, instrument-grade.
 */
export default function FloatingCard({
  children,
  className = "",
  pressable = false,
  delay = 0,
  onClick,
}: FloatingCardProps) {
  return (
    <motion.div
      className={`relative group ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      whileTap={pressable ? { scale: 0.99 } : undefined}
      onClick={onClick}
    >
      <div className="vela-card relative overflow-hidden h-full">{children}</div>
    </motion.div>
  );
}

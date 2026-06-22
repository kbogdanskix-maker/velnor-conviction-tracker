"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface GlowBorderProps {
  children: ReactNode;
  className?: string;
  /** Pulse speed in seconds */
  speed?: number;
  /** Whether the glow is always on or only on hover */
  hoverOnly?: boolean;
}

/**
 * Wraps content with a pulsing gradient border glow.
 * Gentle opacity breathing  - no rotation or spinning.
 */
export default function GlowBorder({
  children,
  className = "",
  speed = 4,
  hoverOnly = false,
}: GlowBorderProps) {
  return (
    <div className={`relative group ${className}`}>
      {/* Pulsing gradient border */}
      <motion.div
        className={`absolute -inset-[1px] rounded-2xl ${hoverOnly ? "opacity-0 group-hover:opacity-60" : ""} transition-opacity duration-500`}
        style={{
          background:
            "linear-gradient(135deg, rgba(12, 181, 201,0.35) 0%, rgba(6,182,212,0.2) 50%, rgba(12, 181, 201,0.35) 100%)",
        }}
        animate={hoverOnly ? undefined : { opacity: [0.3, 0.7, 0.3] }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner card body  - covers the gradient except at the 1px border */}
      <div className="relative rounded-2xl bg-[#0a101f] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

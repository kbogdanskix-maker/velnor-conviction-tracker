"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  /** Direction the element slides from */
  from?: "bottom" | "left" | "right";
  delay?: number;
}

/**
 * Reveals children with a spring animation when scrolled into view.
 */
export default function RevealOnScroll({
  children,
  className = "",
  from = "bottom",
  delay = 0,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const initial = {
    opacity: 0,
    y: from === "bottom" ? 40 : 0,
    x: from === "left" ? -30 : from === "right" ? 30 : 0,
    scale: 0.97,
    filter: "blur(6px)",
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={inView ? {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        filter: "blur(0px)",
      } : initial}
      transition={{
        delay,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
    >
      {children}
    </motion.div>
  );
}

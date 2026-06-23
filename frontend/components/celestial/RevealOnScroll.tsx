"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect, type ReactNode } from "react";

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
  // Safety net: never leave content stuck hidden if the observer never fires
  // (e.g. a flaky/zero-height viewport). Real scrolling triggers inView first.
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const show = inView || forceShow;

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
      animate={show ? {
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

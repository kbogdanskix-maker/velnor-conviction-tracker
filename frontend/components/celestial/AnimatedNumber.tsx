"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Animated counter that rolls up from 0 to `value` when it scrolls into view.
 * Uses easeOutExpo for a snappy, satisfying deceleration.
 */
export default function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString(),
  duration = 1200,
  className = "",
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(format(0));

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const startVal = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startVal + (value - startVal) * eased;
      setDisplay(format(current));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [inView, value, duration, format]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

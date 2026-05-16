"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps page content with a dramatic entrance animation.
 * Each direct child staggers in with fade + rise + slight scale.
 */

const pageVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const itemVariants = {
  hidden: {
    opacity: 0,
    y: 16,
    scale: 0.98,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export default function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Wrap individual sections/cards so they participate in the stagger */
export function MotionSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

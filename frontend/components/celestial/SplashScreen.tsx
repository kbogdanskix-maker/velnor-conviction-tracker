"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VelnorMark from "@/components/shared/VelnorMark";


/**
 * Full-screen cinematic splash shown once after login.
 * Sequence: black → logo scales in with glow → tagline fades in → dissolves to dashboard.
 * Uses sessionStorage so it only plays once per session.
 */
export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"splash" | "exit" | "done">("splash");

  useEffect(() => {
    // Skip if already shown this session
    if (sessionStorage.getItem("vela-splash-seen")) {
      setPhase("done");
      return;
    }
    sessionStorage.setItem("vela-splash-seen", "1");

    // Logo appears instantly, tagline at 1s, begin exit at 2.8s
    const exitTimer = setTimeout(() => setPhase("exit"), 2800);
    const doneTimer = setTimeout(() => setPhase("done"), 3600);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, []);

  if (phase === "done") {
    return <>{children}</>;
  }

  return (
    <>
      {/* Dashboard mounts hidden behind splash so data starts loading */}
      <div className="opacity-0 pointer-events-none absolute inset-0">{children}</div>

      <AnimatePresence>
        {(phase === "splash" || phase === "exit") && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-vela-bg"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Ambient glow behind logo */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 300,
                height: 300,
                background: "radial-gradient(circle, rgba(12, 181, 201,0.12) 0%, transparent 70%)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 1.2], opacity: [0, 0.8, 0.5] }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Particle burst */}
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const distance = 80 + Math.random() * 40;
              return (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-vela-teal/60"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                />
              );
            })}

            {/* Logo */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10"
            >
              <VelnorMark className="w-28 h-20 text-vela-teal" />
            </motion.div>

            {/* Wordmark */}
            <motion.h1
              className="relative z-10 mt-6 text-3xl font-display font-bold tracking-[0.2em] text-zinc-100"
              initial={{ opacity: 0, y: 10, letterSpacing: "0.4em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.2em" }}
              transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              VELNOR
            </motion.h1>

            {/* Tagline */}
            <motion.p
              className="relative z-10 mt-2 text-sm text-zinc-500 tracking-wider"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              Your wealth, in motion.
            </motion.p>

            {/* Thin line accent */}
            <motion.div
              className="relative z-10 mt-6 h-[1px] bg-gradient-to-r from-transparent via-vela-teal/40 to-transparent"
              initial={{ width: 0 }}
              animate={{ width: 120 }}
              transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import VelnorMark from "@/components/shared/VelnorMark";

/** The one route that counts as "entering the app". Login redirects here. */
const ENTRY_ROUTE = "/dashboard";

/**
 * Full-screen cinematic splash marking entry into the app.
 * Sequence: black → logo scales in with glow → tagline fades in → dissolves to dashboard.
 *
 * Plays on EVERY arrival at the entry route: on app startup and again each time
 * the user navigates to Dashboard. It previously carried a
 * `sessionStorage["vela-splash-seen"]` gate, which made it look "gone" — once
 * seen in a tab it never replayed. That gate is deliberately removed.
 *
 * Deep-linking straight to an inner page such as /portfolio or /health-score
 * still must NOT trigger it: the splash marks arrival, it is not a page loader.
 *
 * Because it now replays, it must always be escapable: any click or key press
 * dismisses it, and `prefers-reduced-motion` skips it outright.
 */
export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEntry = pathname === ENTRY_ROUTE;

  const [phase, setPhase] = useState<"splash" | "exit" | "done">(
    isEntry ? "splash" : "done",
  );

  useEffect(() => {
    if (!isEntry) {
      setPhase("done");
      return;
    }
    // A replaying full-screen animation is exactly what reduced-motion is for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    // Re-arm on each arrival: this component lives in the layout and survives
    // navigation, so without this the phase would stay "done" forever.
    setPhase("splash");

    // Logo appears instantly, tagline at 1s, begin exit at 2.8s
    const exitTimer = setTimeout(() => setPhase("exit"), 2800);
    const doneTimer = setTimeout(() => setPhase("done"), 3600);

    // Escape hatch, so nobody is held behind 3.6s of animation twice in a row.
    // Armed after a beat: the very click that navigated here must not also
    // dismiss the splash it just triggered.
    const skip = () => setPhase("done");
    const armTimer = setTimeout(() => {
      window.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);
    }, 400);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      clearTimeout(armTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [isEntry, pathname]);

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
                background: "radial-gradient(circle, rgba(26, 168, 187,0.12) 0%, transparent 70%)",
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

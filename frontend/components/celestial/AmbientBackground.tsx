"use client";

import { useAnimationPrefs } from "@/contexts/AnimationContext";

/**
 * Static ambient gradient orbs that gently pulse in opacity.
 * No movement, no spin — just a calm colour wash that breathes.
 */
export default function AmbientBackground() {
  const { prefs } = useAnimationPrefs();
  const disabled = prefs.reduceMotion || prefs.disableBackgroundEffects;

  if (disabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Primary teal wash — top left */}
      <div
        className="absolute rounded-full"
        style={{
          width: "140vw",
          height: "140vh",
          left: "-30%",
          top: "-40%",
          background:
            "radial-gradient(circle, rgba(20,184,166,0.06) 0%, rgba(20,184,166,0.015) 35%, transparent 60%)",
          filter: "blur(120px)",
          animation: "ambient-pulse 12s ease-in-out infinite",
        }}
      />

      {/* Deep indigo wash — right side */}
      <div
        className="absolute rounded-full"
        style={{
          width: "130vw",
          height: "130vh",
          right: "-25%",
          top: "15%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.05) 0%, rgba(99,102,241,0.01) 40%, transparent 60%)",
          filter: "blur(100px)",
          animation: "ambient-pulse 16s ease-in-out infinite 4s",
        }}
      />

      {/* Warm teal/cyan — bottom */}
      <div
        className="absolute rounded-full"
        style={{
          width: "120vw",
          height: "120vh",
          left: "-10%",
          bottom: "-50%",
          background:
            "radial-gradient(circle, rgba(20,184,166,0.04) 0%, rgba(6,182,212,0.015) 35%, transparent 60%)",
          filter: "blur(110px)",
          animation: "ambient-pulse 14s ease-in-out infinite 8s",
        }}
      />

      {/* Faint purple haze — top right */}
      <div
        className="absolute rounded-full"
        style={{
          width: "110vw",
          height: "90vh",
          right: "-15%",
          top: "-25%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.035) 0%, transparent 50%)",
          filter: "blur(100px)",
          animation: "ambient-pulse 18s ease-in-out infinite 12s",
        }}
      />

      {/* Deep space vignette — bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          background:
            "linear-gradient(to top, rgba(3,7,18,0.8) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

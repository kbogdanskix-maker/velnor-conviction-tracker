"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface AnimationPrefs {
  /** Disable all motion/transitions (respects prefers-reduced-motion too) */
  reduceMotion: boolean;
  /** Disable starfield + ambient background orbs */
  disableBackgroundEffects: boolean;
  /** Disable card glow / backlight on hover */
  disableGlow: boolean;
  /** Disable typewriter text effect */
  disableTypewriter: boolean;
}

const DEFAULTS: AnimationPrefs = {
  reduceMotion: false,
  disableBackgroundEffects: false,
  disableGlow: false,
  disableTypewriter: false,
};

const STORAGE_KEY = "vela_animation_prefs";

interface AnimationContextValue {
  prefs: AnimationPrefs;
  update: (patch: Partial<AnimationPrefs>) => void;
}

const AnimationContext = createContext<AnimationContextValue>({
  prefs: DEFAULTS,
  update: () => {},
});

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AnimationPrefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage + respect prefers-reduced-motion
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPrefs({ ...DEFAULTS, ...JSON.parse(saved) });
      }
    } catch {}

    // Auto-enable reduceMotion if OS says so
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setPrefs((p) => ({ ...p, reduceMotion: true }));
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setPrefs((p) => ({ ...p, reduceMotion: true }));
    };
    mq.addEventListener("change", handler);
    setLoaded(true);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs, loaded]);

  function update(patch: Partial<AnimationPrefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }

  return (
    <AnimationContext.Provider value={{ prefs, update }}>
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimationPrefs() {
  return useContext(AnimationContext);
}

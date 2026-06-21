"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export type AITone = "professional" | "casual" | "concise" | "encouraging";
export type DebriefLength = "brief" | "standard" | "detailed";

export interface AIStylePrefs {
  /** How AI-generated text is phrased */
  tone: AITone;
  /** Show debrief section on dashboard */
  showDebrief: boolean;
  /** Debrief length preference */
  debriefLength: DebriefLength;
  /** Include political/macro news in debrief */
  includeMacro: boolean;
  /** Include portfolio-specific news in debrief */
  includePortfolioNews: boolean;
}

const DEFAULTS: AIStylePrefs = {
  tone: "professional",
  showDebrief: true,
  debriefLength: "standard",
  includeMacro: true,
  includePortfolioNews: true,
};

const STORAGE_KEY = "vela_ai_style_prefs";

// ── Context ─────────────────────────────────────────────────────────────────

interface AIStyleContextValue {
  prefs: AIStylePrefs;
  update: (patch: Partial<AIStylePrefs>) => void;
}

const AIStyleContext = createContext<AIStyleContextValue>({
  prefs: DEFAULTS,
  update: () => {},
});

export function AIStyleProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AIStylePrefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPrefs({ ...DEFAULTS, ...JSON.parse(saved) });
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs, loaded]);

  function update(patch: Partial<AIStylePrefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }

  return (
    <AIStyleContext.Provider value={{ prefs, update }}>
      {children}
    </AIStyleContext.Provider>
  );
}

export function useAIStylePrefs() {
  return useContext(AIStyleContext);
}

// ── Tone Descriptions ───────────────────────────────────────────────────────

export const TONE_OPTIONS: { value: AITone; label: string; desc: string; example: string }[] = [
  {
    value: "professional",
    label: "Professional",
    desc: "Clear, precise financial language",
    example: "Your portfolio appreciated 2.3% today, driven by tech sector gains.",
  },
  {
    value: "casual",
    label: "Casual",
    desc: "Friendly and approachable",
    example: "Nice day! Your portfolio is up 2.3%  - tech stocks are doing the heavy lifting.",
  },
  {
    value: "concise",
    label: "Concise",
    desc: "Numbers first, minimal words",
    example: "+2.3% today. Tech led. No alerts.",
  },
  {
    value: "encouraging",
    label: "Encouraging",
    desc: "Motivational and positive focus",
    example: "Great progress! Your portfolio gained 2.3% today  - your strategy is paying off.",
  },
];

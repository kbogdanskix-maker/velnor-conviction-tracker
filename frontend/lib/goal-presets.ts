/**
 * Goal preset templates  - quick-start options for common financial goals.
 */

export interface GoalPreset {
  key: string;
  label: string;
  icon: string;
  defaultCagr: number;
  defaultYears: number;
  description: string;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    key: "retirement",
    label: "Retirement",
    icon: "sunset",
    defaultCagr: 7,
    defaultYears: 30,
    description: "Long-term wealth building for retirement",
  },
  {
    key: "education",
    label: "Education",
    icon: "graduation-cap",
    defaultCagr: 5,
    defaultYears: 18,
    description: "Save for college or graduate school",
  },
  {
    key: "purchase",
    label: "Major Purchase",
    icon: "home",
    defaultCagr: 3,
    defaultYears: 5,
    description: "Home, car, or other large purchase",
  },
  {
    key: "emergency",
    label: "Emergency Fund",
    icon: "shield",
    defaultCagr: 2,
    defaultYears: 1,
    description: "3\u20136 months of expenses as a safety net",
  },
  {
    key: "custom",
    label: "Custom Goal",
    icon: "target",
    defaultCagr: 7,
    defaultYears: 10,
    description: "Set your own parameters",
  },
];

/** Map of icon name → Lucide icon name for dynamic import. */
export const GOAL_ICONS: Record<string, string> = {
  sunset: "Sunset",
  "graduation-cap": "GraduationCap",
  home: "Home",
  shield: "Shield",
  target: "Target",
  "piggy-bank": "PiggyBank",
  car: "Car",
  plane: "Plane",
  gift: "Gift",
  heart: "Heart",
};

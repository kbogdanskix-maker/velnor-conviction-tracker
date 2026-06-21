"use client";

import { useCloudStore } from "./useCloudStore";

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type Sophistication = "beginner" | "intermediate" | "advanced";
export type Objective = "growth" | "income" | "preservation" | "target" | "learning";
export type TimeHorizon = "short" | "medium" | "long";
// Framings the user wants the app/AI to downplay.
export type DeEmphasis = "retirement" | "income" | "tax" | "volatility";

export interface UserProfile {
  age: number;
  dependents: number;
  isHomeowner: boolean;
  isUsCitizen: boolean;
  marginalTaxRate: number;
  riskTolerance: RiskTolerance;
  sophistication: Sophistication;
  // Investor identity — shapes AI framing and app norms.
  primaryObjective: Objective;
  timeHorizon: TimeHorizon;
  deEmphasize: DeEmphasis[];
  philosophy: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  age: 30,
  dependents: 0,
  isHomeowner: false,
  isUsCitizen: true,
  marginalTaxRate: 22,
  riskTolerance: "moderate",
  sophistication: "intermediate",
  // Defaults preserve today's behavior until the user sets them.
  primaryObjective: "target",
  timeHorizon: "long",
  deEmphasize: [],
  philosophy: "",
};

export const US_TAX_BRACKETS = [
  { rate: 10,  label: "10% — up to $11,600" },
  { rate: 12,  label: "12% — $11,601–$47,150" },
  { rate: 22,  label: "22% — $47,151–$100,525" },
  { rate: 24,  label: "24% — $100,526–$191,950" },
  { rate: 32,  label: "32% — $191,951–$243,725" },
  { rate: 35,  label: "35% — $243,726–$609,350" },
  { rate: 37,  label: "37% — over $609,350" },
];

export function useProfile() {
  const { data, save, isLoading } = useCloudStore<UserProfile>("user_profile");

  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
  };

  function update(patch: Partial<UserProfile>) {
    save({ ...profile, ...patch });
  }

  return { profile, update, isLoading };
}

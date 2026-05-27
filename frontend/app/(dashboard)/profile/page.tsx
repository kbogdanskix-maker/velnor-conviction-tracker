"use client";

import { User, Home, Shield, DollarSign, Globe, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { useProfile, US_TAX_BRACKETS, type Sophistication } from "@/hooks/useProfile";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";

const RISK_OPTIONS = [
  {
    value: "conservative" as const,
    label: "Conservative",
    desc: "Capital preservation over growth. Lower volatility, lower returns.",
    color: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "moderate" as const,
    label: "Moderate",
    desc: "Balanced growth and stability. Accept some swings for better returns.",
    color: "border-teal-500/40 bg-teal-500/5 text-teal-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "aggressive" as const,
    label: "Aggressive",
    desc: "Maximum growth focus. High volatility is acceptable for high returns.",
    color: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
];

const SOPHISTICATION_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    desc: "New to investing. Explain concepts, avoid jargon.",
    color: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    desc: "Comfortable with fundamentals. Brief explanations when needed.",
    color: "border-teal-500/40 bg-teal-500/5 text-teal-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    desc: "Institutional-level fluency. No hand-holding.",
    color: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${on ? "bg-teal-500" : "bg-zinc-700"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function ProfilePage() {
  const { profile, update, isLoading } = useProfile();
  const { summary: cashFlow } = useCashFlowSummary();

  const monthlyIncome = cashFlow?.total_income ?? 0;
  const annualIncome = monthlyIncome * 12;

  // Suggest tax bracket based on income if US citizen
  const suggestedBracket = annualIncome > 0
    ? US_TAX_BRACKETS.slice().reverse().find((b) => annualIncome >= b.rate * 1000)?.rate ?? 22
    : null;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <User className="w-6 h-6 text-teal-400" />
          My Profile
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Set your personal details once — all pages adapt to your situation.
        </p>
      </div>

      {/* Personal */}
      <FloatingCard glowColor="rgba(20,184,166,0.08)" tilt={false}>
        <div className="flex items-center gap-2 mb-5">
          <Users className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Personal</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Age */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Age</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ age: Math.max(18, profile.age - 1) })}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold text-lg flex items-center justify-center transition-colors"
              >−</button>
              <span className="text-2xl font-display font-bold text-zinc-100 tabular-nums w-10 text-center">{profile.age}</span>
              <button
                onClick={() => update({ age: Math.min(80, profile.age + 1) })}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold text-lg flex items-center justify-center transition-colors"
              >+</button>
              <span className="text-xs text-zinc-600">years old</span>
            </div>
          </div>

          {/* Dependents */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Dependents</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ dependents: Math.max(0, profile.dependents - 1) })}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold text-lg flex items-center justify-center transition-colors"
              >−</button>
              <span className="text-2xl font-display font-bold text-zinc-100 tabular-nums w-10 text-center">{profile.dependents}</span>
              <button
                onClick={() => update({ dependents: profile.dependents + 1 })}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold text-lg flex items-center justify-center transition-colors"
              >+</button>
              <span className="text-xs text-zinc-600">people rely on your income</span>
            </div>
          </div>

          {/* Homeowner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-300">I own my home</p>
                <p className="text-xs text-zinc-600">Affects insurance and net worth analysis</p>
              </div>
            </div>
            <Toggle on={profile.isHomeowner} onToggle={() => update({ isHomeowner: !profile.isHomeowner })} />
          </div>
        </div>
      </FloatingCard>

      {/* Citizenship & Tax */}
      <RevealOnScroll>
        <FloatingCard glowColor="rgba(59,130,246,0.08)" tilt={false}>
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Tax Situation</h2>
          </div>

          {/* US Citizen toggle */}
          <div className="flex items-center justify-between mb-5 pb-5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-500" />
              <div>
                <p className="text-sm text-zinc-300">US Taxpayer</p>
                <p className="text-xs text-zinc-600">Enables US-specific tax bracket and analysis</p>
              </div>
            </div>
            <Toggle on={profile.isUsCitizen} onToggle={() => update({ isUsCitizen: !profile.isUsCitizen })} />
          </div>

          {/* Tax rate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-500">
                {profile.isUsCitizen ? "Marginal Tax Bracket" : "Marginal Tax Rate"}
              </label>
              {suggestedBracket && profile.isUsCitizen && suggestedBracket !== profile.marginalTaxRate && (
                <button
                  onClick={() => update({ marginalTaxRate: suggestedBracket })}
                  className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Use suggested ({suggestedBracket}% based on income) →
                </button>
              )}
            </div>

            {profile.isUsCitizen ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {US_TAX_BRACKETS.map((b) => (
                  <button
                    key={b.rate}
                    onClick={() => update({ marginalTaxRate: b.rate })}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      profile.marginalTaxRate === b.rate
                        ? "border-teal-500/40 bg-teal-500/10 text-teal-400"
                        : "border-zinc-700 hover:border-zinc-600 text-zinc-400"
                    }`}
                  >
                    <p className="text-sm font-bold tabular-nums">{b.rate}%</p>
                    <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">{b.label.split("—")[1]?.trim()}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={profile.marginalTaxRate}
                  onChange={(e) => update({ marginalTaxRate: Math.min(60, Math.max(0, Number(e.target.value))) })}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-sm text-zinc-500">% marginal rate</span>
              </div>
            )}
            <p className="text-[11px] text-zinc-600 mt-2">
              Used to calculate tax drag on investments and tax-loss harvesting benefit estimates.
            </p>
          </div>
        </FloatingCard>
      </RevealOnScroll>

      {/* Risk Tolerance */}
      <RevealOnScroll delay={0.05}>
        <FloatingCard glowColor="rgba(245,158,11,0.08)" tilt={false}>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Investment Style</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {RISK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ riskTolerance: opt.value })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  profile.riskTolerance === opt.value ? opt.color : opt.inactive + " text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  {profile.riskTolerance === opt.value && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <p className="text-[11px] leading-relaxed opacity-70">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-3">
            Sets the default scenario in Monte Carlo simulations and influences portfolio suggestions.
          </p>
        </FloatingCard>
      </RevealOnScroll>

      {/* Sophistication */}
      <RevealOnScroll delay={0.1}>
        <FloatingCard glowColor="rgba(59,130,246,0.08)" tilt={false}>
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Investment Sophistication</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SOPHISTICATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ sophistication: opt.value })}
                className={`p-4 rounded-lg border text-left transition-all ${
                  profile.sophistication === opt.value ? opt.color : opt.inactive + " text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  {profile.sophistication === opt.value && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <p className="text-[11px] leading-relaxed opacity-70">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-3">
            Shapes how the AI reflection feature talks to you.
          </p>
        </FloatingCard>
      </RevealOnScroll>

      {/* Summary */}
      <RevealOnScroll delay={0.1}>
        <div className="vela-card">
          <h2 className="section-heading mb-3">Profile Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: "Age", value: `${profile.age} yrs` },
              { label: "Dependents", value: profile.dependents === 0 ? "None" : profile.dependents },
              { label: "Homeowner", value: profile.isHomeowner ? "Yes" : "No" },
              { label: "Tax Status", value: profile.isUsCitizen ? "US Taxpayer" : "Non-US" },
              { label: "Marginal Rate", value: `${profile.marginalTaxRate}%` },
              { label: "Risk Tolerance", value: profile.riskTolerance.charAt(0).toUpperCase() + profile.riskTolerance.slice(1) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="font-medium text-zinc-200 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          {annualIncome > 0 && (
            <p className="text-xs text-zinc-600 mt-3 pt-3 border-t border-zinc-800">
              Annual income from Cash Flow: ${annualIncome.toLocaleString()} — used to suggest tax bracket above.
            </p>
          )}
        </div>
      </RevealOnScroll>
    </PageTransition>
  );
}

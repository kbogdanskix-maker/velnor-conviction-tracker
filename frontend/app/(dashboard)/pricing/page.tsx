"use client";

import { motion } from "framer-motion";
import { Check, Sunrise, Telescope, Orbit, Sparkles } from "lucide-react";
import PageTransition, { MotionSection } from "@/components/celestial/PageTransition";
import GlowBorder from "@/components/celestial/GlowBorder";
import { useTier } from "@/hooks/useTier";

/* ── Plan data ─────────────────────────────────────────────────────────────── */

interface Plan {
  id: "horizon" | "voyager" | "navigator";
  name: string;
  tagline: string;
  price: number;
  interval: string;
  yearlyPrice?: number;       // optional annual billing price
  icon: React.ComponentType<{ className?: string }>;
  accent: string;           // tailwind text-color
  glowFrom: string;         // gradient start
  glowTo: string;           // gradient end
  buttonClass: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "horizon",
    name: "Horizon",
    tagline: "Chart your course",
    price: 0,
    interval: "forever",
    icon: Sunrise,
    accent: "text-zinc-300",
    glowFrom: "rgba(161,161,170,0.15)",
    glowTo: "rgba(161,161,170,0.05)",
    buttonClass: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200",
    features: [
      "Portfolio & net worth tracking",
      "Net worth history & milestones",
      "Watchlist",
      "Health Score & Smart Alerts",
      "Risk & returns analysis",
      "Sector breakdown",
      "Goal planner",
      "Affordability & debt payoff",
      "Expense, income & subscription tracking",
      "FI tracker",
      "Markets, news & sentiment",
      "Thesis, notes & journal (3 thesis threads)",
      "Learn library & annual review",
      "1-year history · 60s quote refresh",
    ],
  },
  {
    id: "voyager",
    name: "Voyager",
    tagline: "Navigate with precision",
    price: 9.99,
    interval: "mo",
    yearlyPrice: 99.99,
    icon: Telescope,
    accent: "text-vela-teal",
    glowFrom: "rgba(12, 181, 201,0.25)",
    glowTo: "rgba(12, 181, 201,0.05)",
    buttonClass: "bg-vela-teal hover:bg-teal-400 text-zinc-950 font-semibold",
    features: [
      "Everything in Horizon, plus:",
      "AI insights — 10 per day",
      "Stock screener (5,000+ tickers)",
      "DCF & Reverse DCF valuation (5 saved models)",
      "Stock Compare",
      "Dividend calendar & forecast",
      "Rebalance advisor & fee analyzer",
      "Position sizing & attribution",
      "Cash flow & budget tools",
      "Tax awareness & tax-loss harvesting",
      "Insurance & retirement planning",
      "Asset location & emergency fund",
      "Behavior insights",
      "Portfolio comparison & benchmarking",
      "FX rates & macro dashboard",
      "5-year history · 15s quote refresh",
    ],
  },
  {
    id: "navigator",
    name: "Navigator",
    tagline: "Master the cosmos",
    price: 29.99,
    interval: "mo",
    yearlyPrice: 250,
    icon: Orbit,
    accent: "text-violet-400",
    glowFrom: "rgba(139,92,246,0.25)",
    glowTo: "rgba(139,92,246,0.05)",
    buttonClass: "bg-violet-500 hover:bg-violet-400 text-white font-semibold",
    features: [
      "Everything in Voyager, plus:",
      "Unlimited AI insights",
      "\"What If\" scenario simulator",
      "Monte Carlo projections",
      "Correlation & diversification map",
      "Reflect — AI portfolio journal",
      "Company Deep-Dive (filings, insider & institutional)",
      "5s real-time quote refresh",
      "Priority support",
    ],
  },
];

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function PricingPage() {
  const { tier } = useTier();

  return (
    <PageTransition className="px-4 sm:px-6 pb-16 max-w-6xl mx-auto">
      {/* Hero */}
      <MotionSection className="text-center pt-8 pb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vela-teal/10 text-vela-teal text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Choose your trajectory
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-bold text-zinc-100 mb-3 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg max-w-md mx-auto">
          Start free. Upgrade when you&apos;re ready for more powerful tools.
        </p>
      </MotionSection>

      {/* Plan cards */}
      <MotionSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {PLANS.map((plan, i) => {
            const isCurrent = tier === plan.id;
            const isPopular = plan.id === "voyager";
            const Icon = plan.icon;

            const card = (
              <motion.div
                key={plan.id}
                className="relative flex flex-col h-full"
                initial={{ opacity: 0, y: 32, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.2 + i * 0.12,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  className={`flex flex-col h-full rounded-2xl overflow-hidden ${
                    isPopular ? "bg-[#0a101f]" : "bg-zinc-900/80"
                  } border ${
                    isPopular ? "border-vela-teal/20" : "border-zinc-800/60"
                  }`}
                >
                  {/* Popular badge  - inside card, pinned to top */}
                  {isPopular && (
                    <div className="flex justify-center pt-3">
                      <span className="px-3 py-1 rounded-full bg-vela-teal/20 text-vela-teal text-[11px] font-semibold uppercase tracking-wider border border-vela-teal/30">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className={`relative px-6 ${isPopular ? "pt-4" : "pt-8"} pb-6`}>
                    {/* Ambient gradient */}
                    <div
                      className="absolute inset-0 opacity-40 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${plan.glowFrom}, ${plan.glowTo} 70%)`,
                      }}
                    />
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                        plan.id === "horizon" ? "bg-zinc-800" :
                        plan.id === "voyager" ? "bg-vela-teal/15" :
                        "bg-violet-500/15"
                      }`}>
                        <Icon className={`w-5 h-5 ${plan.accent}`} />
                      </div>
                      <h2 className={`text-xl font-bold ${plan.accent}`}>{plan.name}</h2>
                      <p className="text-zinc-500 text-sm mt-0.5">{plan.tagline}</p>

                      <div className="mt-5 flex items-baseline gap-1">
                        {plan.price === 0 ? (
                          <span className="text-4xl font-bold text-zinc-100">Free</span>
                        ) : (
                          <>
                            <span className="text-zinc-500 text-lg">$</span>
                            <span className="text-4xl font-bold tabular text-zinc-100">{plan.price}</span>
                            <span className="text-zinc-500 text-sm">/{plan.interval}</span>
                          </>
                        )}
                      </div>
                      {plan.yearlyPrice && (
                        <p className="text-zinc-500 text-xs mt-1.5">
                          or <span className="text-zinc-300 tabular">${plan.yearlyPrice}</span>/yr
                          <span className="text-zinc-600"> — save {Math.round((1 - plan.yearlyPrice / (plan.price * 12)) * 100)}%</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-6 h-px bg-zinc-800/80" />

                  {/* Features */}
                  <div className="px-6 py-6 flex-1">
                    <ul className="space-y-3">
                      {plan.features.map((f) => {
                        const isHeader = f.startsWith("Everything");
                        return (
                          <li key={f} className="flex items-start gap-2.5">
                            {isHeader ? (
                              <span className={`text-sm font-medium ${plan.accent} mb-1`}>{f}</span>
                            ) : (
                              <>
                                <Check className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  plan.id === "horizon" ? "text-zinc-500" :
                                  plan.id === "voyager" ? "text-vela-teal/70" :
                                  "text-violet-400/70"
                                }`} />
                                <span className="text-sm text-zinc-300">{f}</span>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    {isCurrent ? (
                      <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium text-zinc-500 bg-zinc-800/50 border border-zinc-700/50">
                        Current plan
                      </div>
                    ) : (
                      <button
                        className={`w-full py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer ${plan.buttonClass} hover:shadow-lg`}
                      >
                        {plan.price === 0 ? "Get started" : `Upgrade to ${plan.name}`}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );

            // Wrap the popular plan in GlowBorder
            if (isPopular) {
              return (
                <GlowBorder key={plan.id} speed={5}>
                  {card}
                </GlowBorder>
              );
            }

            return card;
          })}
        </div>
      </MotionSection>

      {/* Bottom note */}
      <MotionSection className="text-center mt-12">
        <p className="text-zinc-500 text-sm">
          All plans include unlimited data retention. Cancel anytime.
        </p>
        <p className="text-zinc-600 text-xs mt-2">
          Prices in USD. Billed monthly or annually. No hidden fees.
        </p>
      </MotionSection>
    </PageTransition>
  );
}

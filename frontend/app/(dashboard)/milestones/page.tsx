"use client";

import { useMemo } from "react";
import {
  Trophy, Star, Zap, Shield, TrendingUp, Target, Coins,
  CheckCircle2, Circle, Lock, Wallet, PiggyBank, ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useGoals } from "@/hooks/useGoals";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import GlowBorder from "@/components/celestial/GlowBorder";
import CelebrationBurst from "@/components/celestial/CelebrationBurst";

// ── Milestone definitions ───────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "net-worth" | "savings" | "investing" | "habits" | "debt";
  check: (ctx: Context) => boolean;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

interface Context {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  savingsRate: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  portfolioValue: number;
  holdingsCount: number;
  goalsCount: number;
  goalsCompleted: number;
}

const TIER_COLORS = {
  bronze: { bg: "bg-orange-900/20", border: "border-orange-700/40", text: "text-orange-400", label: "Bronze" },
  silver: { bg: "bg-zinc-700/20", border: "border-zinc-500/40", text: "text-zinc-300", label: "Silver" },
  gold: { bg: "bg-yellow-900/20", border: "border-yellow-600/40", text: "text-yellow-400", label: "Gold" },
  platinum: { bg: "bg-cyan-900/20", border: "border-cyan-600/40", text: "text-cyan-300", label: "Platinum" },
};

const MILESTONES: Milestone[] = [
  // Net Worth
  { id: "nw-positive", title: "In the Black", description: "Net worth above $0", icon: TrendingUp, category: "net-worth", tier: "bronze", check: (c) => c.netWorth > 0 },
  { id: "nw-10k", title: "Five Figures", description: "Net worth exceeds $10,000", icon: Star, category: "net-worth", tier: "bronze", check: (c) => c.netWorth >= 10000 },
  { id: "nw-50k", title: "Halfway There", description: "Net worth exceeds $50,000", icon: Star, category: "net-worth", tier: "silver", check: (c) => c.netWorth >= 50000 },
  { id: "nw-100k", title: "Six Figures", description: "Net worth exceeds $100,000", icon: Trophy, category: "net-worth", tier: "gold", check: (c) => c.netWorth >= 100000 },
  { id: "nw-500k", title: "Half Millionaire", description: "Net worth exceeds $500,000", icon: Trophy, category: "net-worth", tier: "platinum", check: (c) => c.netWorth >= 500000 },
  { id: "nw-1m", title: "Millionaire", description: "Net worth exceeds $1,000,000", icon: Trophy, category: "net-worth", tier: "platinum", check: (c) => c.netWorth >= 1000000 },

  // Savings
  { id: "sav-10", title: "First 10%", description: "Savings rate of 10% or higher", icon: PiggyBank, category: "savings", tier: "bronze", check: (c) => c.savingsRate >= 10 },
  { id: "sav-20", title: "Super Saver", description: "Savings rate of 20% or higher", icon: PiggyBank, category: "savings", tier: "silver", check: (c) => c.savingsRate >= 20 },
  { id: "sav-50", title: "FIRE Starter", description: "Savings rate of 50% or higher", icon: Zap, category: "savings", tier: "gold", check: (c) => c.savingsRate >= 50 },
  { id: "sav-emg", title: "Safety Net", description: "3+ months of expenses saved", icon: Shield, category: "savings", tier: "silver", check: (c) => c.monthlyExpenses > 0 && c.totalAssets >= c.monthlyExpenses * 3 },
  { id: "sav-emg6", title: "Fully Funded", description: "6+ months of expenses saved", icon: Shield, category: "savings", tier: "gold", check: (c) => c.monthlyExpenses > 0 && c.totalAssets >= c.monthlyExpenses * 6 },

  // Investing
  { id: "inv-start", title: "Market Debut", description: "First investment in portfolio", icon: Coins, category: "investing", tier: "bronze", check: (c) => c.holdingsCount >= 1 },
  { id: "inv-diverse", title: "Diversified", description: "5+ different holdings", icon: Coins, category: "investing", tier: "silver", check: (c) => c.holdingsCount >= 5 },
  { id: "inv-10k", title: "Serious Investor", description: "Portfolio exceeds $10,000", icon: TrendingUp, category: "investing", tier: "silver", check: (c) => c.portfolioValue >= 10000 },
  { id: "inv-100k", title: "Six Figure Portfolio", description: "Portfolio exceeds $100,000", icon: TrendingUp, category: "investing", tier: "gold", check: (c) => c.portfolioValue >= 100000 },

  // Habits
  { id: "hab-goals", title: "Goal Setter", description: "Create your first financial goal", icon: Target, category: "habits", tier: "bronze", check: (c) => c.goalsCount >= 1 },
  { id: "hab-goals3", title: "Ambitious", description: "3+ active financial goals", icon: Target, category: "habits", tier: "silver", check: (c) => c.goalsCount >= 3 },
  { id: "hab-complete", title: "Goal Crusher", description: "Complete a financial goal", icon: CheckCircle2, category: "habits", tier: "gold", check: (c) => c.goalsCompleted >= 1 },
  { id: "hab-income", title: "Earning Power", description: "Monthly income tracked", icon: Wallet, category: "habits", tier: "bronze", check: (c) => c.monthlyIncome > 0 },

  // Debt
  { id: "debt-free", title: "Debt Free", description: "Zero liabilities", icon: Zap, category: "debt", tier: "platinum", check: (c) => c.totalLiabilities === 0 && c.totalAssets > 0 },
  { id: "debt-low", title: "Under Control", description: "Liabilities under 30% of assets", icon: Shield, category: "debt", tier: "silver", check: (c) => c.totalAssets > 0 && c.totalLiabilities < c.totalAssets * 0.3 },
];

const CATEGORY_LABELS: Record<string, string> = {
  "net-worth": "Net Worth",
  savings: "Savings",
  investing: "Investing",
  habits: "Habits",
  debt: "Debt",
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function MilestonesPage() {
  const { summary: nw } = useNetWorthSummary();
  const { summary: cf } = useCashFlowSummary();
  const { summary: portfolio } = useDefaultPortfolio();
  const { goals } = useGoals();

  const ctx: Context = useMemo(() => ({
    netWorth: (nw?.total_assets ?? 0) - (nw?.total_liabilities ?? 0),
    totalAssets: nw?.total_assets ?? 0,
    totalLiabilities: nw?.total_liabilities ?? 0,
    savingsRate: cf?.savings_rate ?? 0,
    monthlyIncome: cf?.total_income ?? 0,
    monthlyExpenses: cf?.total_expenses ?? 0,
    portfolioValue: portfolio?.total_value ?? 0,
    holdingsCount: portfolio?.holdings?.length ?? 0,
    goalsCount: goals?.length ?? 0,
    goalsCompleted: 0, // Goal completion tracking not yet implemented
  }), [nw, cf, portfolio, goals]);

  const evaluated = useMemo(() => {
    return MILESTONES.map((m) => ({
      ...m,
      unlocked: m.check(ctx),
    }));
  }, [ctx]);

  const unlockedCount = evaluated.filter((m) => m.unlocked).length;
  const totalCount = evaluated.length;
  const progressPct = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  // Find the "most recent" unlock: last unlocked milestone in the list
  const lastUnlockedId = useMemo(() => {
    const unlocked = evaluated.filter((m) => m.unlocked);
    return unlocked.length > 0 ? unlocked[unlocked.length - 1].id : null;
  }, [evaluated]);

  // Group by category
  const categories = ["net-worth", "savings", "investing", "habits", "debt"];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Financial Milestones</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Track your financial achievements and unlock milestones as your wealth grows
        </p>
      </div>

      {/* Progress card */}
      <div className="vela-card p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="#14b8a6" strokeWidth="8"
                strokeDasharray={`${progressPct * 2.64} ${264 - progressPct * 2.64}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-vela-teal" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-zinc-100 tabular-nums">
              {unlockedCount}<span className="text-lg text-zinc-500">/{totalCount}</span>
            </p>
            <p className="text-sm text-zinc-400">milestones unlocked</p>
            <div className="flex gap-4 mt-2">
              {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
                const count = evaluated.filter((m) => m.tier === tier && m.unlocked).length;
                const total = evaluated.filter((m) => m.tier === tier).length;
                return (
                  <div key={tier} className="text-center">
                    <p className={`text-sm font-bold tabular-nums ${TIER_COLORS[tier].text}`}>{count}/{total}</p>
                    <p className="text-[10px] text-zinc-500">{TIER_COLORS[tier].label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Milestones by category */}
      {categories.map((cat) => {
        const items = evaluated.filter((m) => m.category === cat);
        const catUnlocked = items.filter((m) => m.unlocked).length;

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </h2>
              <span className="text-xs text-zinc-500 tabular-nums">{catUnlocked}/{items.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((m, idx) => {
                const Icon = m.icon;
                const tier = TIER_COLORS[m.tier];
                const isLatestUnlock = m.id === lastUnlockedId;

                const cardContent = (
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${m.unlocked ? tier.text : "text-zinc-600"}`}>
                      {m.unlocked ? <Icon className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${m.unlocked ? "text-zinc-100" : "text-zinc-500"}`}>
                          {m.title}
                        </span>
                        <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          m.unlocked ? `${tier.bg} ${tier.text}` : "bg-zinc-800 text-zinc-600"
                        }`}>
                          {tier.label}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${m.unlocked ? "text-zinc-400" : "text-zinc-600"}`}>
                        {m.description}
                      </p>
                    </div>
                    {m.unlocked && <CheckCircle2 className="w-4 h-4 text-gain shrink-0 mt-0.5" />}
                  </div>
                );

                // Wrap unlocked cards in FloatingCard with staggered entrance + celebration pulse
                if (m.unlocked) {
                  const inner = (
                    <FloatingCard
                      key={m.id}
                      delay={idx * 0.06}
                      tilt={false}
                      className={isLatestUnlock ? "" : ""}
                    >
                      <motion.div
                        className={`p-4 ${tier.bg}`}
                        initial={isLatestUnlock ? { scale: 1 } : undefined}
                        animate={isLatestUnlock ? {
                          scale: [1, 1.03, 1],
                          boxShadow: [
                            "0 0 0px rgba(20,184,166,0)",
                            "0 0 20px rgba(20,184,166,0.3)",
                            "0 0 0px rgba(20,184,166,0)",
                          ],
                        } : undefined}
                        transition={isLatestUnlock ? {
                          duration: 2,
                          repeat: 1,
                          ease: "easeInOut",
                        } : undefined}
                      >
                        {cardContent}
                      </motion.div>
                    </FloatingCard>
                  );

                  // Wrap the latest unlock in GlowBorder + celebration burst
                  if (isLatestUnlock) {
                    return (
                      <div key={m.id} className="relative">
                        <CelebrationBurst trigger={true} count={28} duration={1000} />
                        <GlowBorder speed={3}>
                          <div className={`p-4 ${tier.bg}`}>
                            {cardContent}
                          </div>
                        </GlowBorder>
                      </div>
                    );
                  }

                  return inner;
                }

                // Locked milestone  - simple staggered entrance
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4 }}
                    className="rounded-lg border p-4 bg-zinc-900/50 border-zinc-800 opacity-50"
                  >
                    {cardContent}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Motivational footer */}
      <div className="vela-card p-5 text-center">
        <p className="text-sm text-zinc-400">
          {unlockedCount === 0
            ? "Start tracking your finances to unlock your first milestones."
            : unlockedCount < 5
              ? "Great start! Keep building your financial foundation."
              : unlockedCount < 10
                ? "You're making excellent progress. Keep pushing!"
                : unlockedCount < 15
                  ? "Impressive dedication to your financial health."
                  : "You're a financial powerhouse. Keep it up!"}
        </p>
      </div>
    </PageTransition>
  );
}

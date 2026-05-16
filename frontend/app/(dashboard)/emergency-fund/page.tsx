"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, AlertTriangle, Plus, Target, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine,
} from "recharts";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FundAnalysis {
  monthlyExpenses: number;
  liquidAssets: number;
  monthsCovered: number;
  targetMonths: number;
  targetAmount: number;
  gap: number;
  grade: "A" | "B" | "C" | "D" | "F";
  gradeColor: string;
  gradeBg: string;
  summary: string;
  monthlySavings: number;
  monthsToTarget: number | null;
}

const LIQUID_CATEGORIES = ["checking", "savings", "hysa", "money_market", "cash"];

function analyzeEmergencyFund(
  monthlyExpenses: number,
  monthlySavings: number,
  assets: Array<{ category: string; value: number }>,
  targetMonths: number,
): FundAnalysis {
  const liquidAssets = assets
    .filter((a) => LIQUID_CATEGORIES.includes(a.category))
    .reduce((s, a) => s + a.value, 0);

  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  const targetAmount = monthlyExpenses * targetMonths;
  const gap = Math.max(0, targetAmount - liquidAssets);

  const monthsToTarget = gap > 0 && monthlySavings > 0
    ? Math.ceil(gap / monthlySavings)
    : gap <= 0 ? 0 : null;

  let grade: FundAnalysis["grade"];
  let gradeColor: string;
  let gradeBg: string;
  let summary: string;

  if (monthsCovered >= targetMonths) {
    grade = "A";
    gradeColor = "text-emerald-400";
    gradeBg = "bg-emerald-500";
    summary = `Fully funded. You have ${monthsCovered.toFixed(1)} months of expenses covered — meeting your ${targetMonths}-month target.`;
  } else if (monthsCovered >= targetMonths * 0.75) {
    grade = "B";
    gradeColor = "text-emerald-400";
    gradeBg = "bg-emerald-500";
    summary = `Almost there. ${monthsCovered.toFixed(1)} months covered — ${formatCompact(gap)} more to reach your ${targetMonths}-month target.`;
  } else if (monthsCovered >= 3) {
    grade = "C";
    gradeColor = "text-amber-400";
    gradeBg = "bg-amber-500";
    summary = `Basic coverage. ${monthsCovered.toFixed(1)} months covers short-term emergencies, but you'd want ${targetMonths} months for job loss or major expenses.`;
  } else if (monthsCovered >= 1) {
    grade = "D";
    gradeColor = "text-orange-400";
    gradeBg = "bg-orange-500";
    summary = `Thin buffer. Only ${monthsCovered.toFixed(1)} months of expenses covered. One unexpected bill could strain your finances.`;
  } else {
    grade = "F";
    gradeColor = "text-rose-400";
    gradeBg = "bg-rose-500";
    summary = monthlyExpenses > 0
      ? `No meaningful emergency fund. ${formatCompact(gap)} needed to cover ${targetMonths} months of expenses. Start with a $1,000 starter fund.`
      : "Add your monthly expenses in Cash Flow to calculate your emergency fund needs.";
  }

  return {
    monthlyExpenses,
    liquidAssets,
    monthsCovered,
    targetMonths,
    targetAmount,
    gap,
    grade,
    gradeColor,
    gradeBg,
    summary,
    monthlySavings,
    monthsToTarget,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EmergencyFundPage() {
  const { summary: cfSummary, isLoading: cfLoading } = useCashFlowSummary();
  const { summary: nwSummary, isLoading: nwLoading } = useNetWorthSummary();
  const [targetMonths, setTargetMonths] = useState(6);

  const analysis = useMemo(() => {
    const monthlyExpenses = cfSummary?.total_expenses ?? 0;
    const monthlySavings = cfSummary?.savings ?? 0;
    const assets = nwSummary?.assets ?? [];
    return analyzeEmergencyFund(monthlyExpenses, monthlySavings, assets, targetMonths);
  }, [cfSummary, nwSummary, targetMonths]);

  const isLoading = cfLoading || nwLoading;
  const hasExpenses = (cfSummary?.total_expenses ?? 0) > 0;

  // Chart: months covered vs target
  const monthsBarData = [
    { name: "Current", value: Math.min(analysis.monthsCovered, targetMonths + 3), fill: analysis.monthsCovered >= targetMonths ? "#34d399" : analysis.monthsCovered >= 3 ? "#f59e0b" : "#ef4444" },
    { name: "Target", value: targetMonths, fill: "#3f3f46" },
  ];

  // Savings timeline
  const timelineData = useMemo(() => {
    if (analysis.gap <= 0 || analysis.monthlySavings <= 0) return [];
    const months = Math.min(analysis.monthsToTarget ?? 60, 60);
    const data = [];
    for (let m = 0; m <= months; m += (months > 24 ? 3 : 1)) {
      const saved = analysis.liquidAssets + analysis.monthlySavings * m;
      data.push({
        month: m === 0 ? "Now" : `M${m}`,
        Saved: Math.min(saved, analysis.targetAmount),
        Target: analysis.targetAmount,
      });
    }
    return data;
  }, [analysis]);

  if (isLoading) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="vela-card animate-pulse h-24" />)}
        </div>
      </PageTransition>
    );
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {!hasExpenses ? (
        <div className="vela-card text-center py-16 space-y-3">
          <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">Expenses needed to calculate</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add your monthly expenses in Cash Flow so we can determine how many months your savings cover.
            </p>
          </div>
          <Link href="/cash-flow" className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Expenses
          </Link>
        </div>
      ) : (
        <>
          {/* Grade card */}
          <div className="vela-card py-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-zinc-700 mb-3">
              <span className={`text-5xl font-black ${analysis.gradeColor}`}>
                {analysis.grade}
              </span>
            </div>
            <p className={`text-lg font-semibold ${analysis.gradeColor}`}>
              {analysis.monthsCovered.toFixed(1)} months covered
            </p>
            <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
              {analysis.summary}
            </p>
          </div>

          {/* Target selector */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-zinc-500">Target:</span>
            {[3, 6, 9, 12].map((m) => (
              <button
                key={m}
                onClick={() => setTargetMonths(m)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  targetMonths === m
                    ? "bg-vela-teal/20 text-vela-teal"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                {m} months
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="vela-card text-center py-3">
              <AnimatedNumber
                value={analysis.liquidAssets}
                format={formatCompact}
                className="text-xl font-bold tabular text-zinc-100"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Liquid Savings</p>
            </div>
            <div className="vela-card text-center py-3">
              <AnimatedNumber
                value={analysis.monthlyExpenses}
                format={formatCompact}
                className="text-xl font-bold tabular text-rose-400"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Monthly Expenses</p>
            </div>
            <div className="vela-card text-center py-3">
              <AnimatedNumber
                value={analysis.targetAmount}
                format={formatCompact}
                className="text-xl font-bold tabular text-vela-teal"
              />
              <p className="text-[10px] text-zinc-500 mt-1">{targetMonths}-Month Target</p>
            </div>
            <div className="vela-card text-center py-3">
              {analysis.gap > 0 ? (
                <AnimatedNumber
                  value={analysis.gap}
                  format={formatCompact}
                  className="text-xl font-bold tabular text-amber-400"
                />
              ) : (
                <p className="text-xl font-bold tabular text-emerald-400">Funded</p>
              )}
              <p className="text-[10px] text-zinc-500 mt-1">
                {analysis.gap > 0 ? "Gap to Fill" : "Fully Covered"}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="vela-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-zinc-300">Progress to {targetMonths}-Month Goal</p>
              <p className={`text-sm font-bold tabular ${analysis.gradeColor}`}>
                {Math.min(100, (analysis.monthsCovered / targetMonths) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="h-4 bg-zinc-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all ${analysis.gradeBg}`}
                style={{ width: `${Math.min(100, (analysis.monthsCovered / targetMonths) * 100)}%` }}
              />
              {/* Month markers */}
              {Array.from({ length: targetMonths - 1 }, (_, i) => i + 1).map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-full w-px bg-zinc-700/50"
                  style={{ left: `${(m / targetMonths) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-zinc-600">0 months</span>
              <span className="text-[9px] text-zinc-600">{targetMonths} months</span>
            </div>
          </div>

          {/* Timeline to target */}
          {timelineData.length > 0 && analysis.monthsToTarget != null && analysis.monthsToTarget > 0 && (
            <div className="vela-card">
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Savings Timeline</h3>
              <p className="text-xs text-zinc-500 mb-4">
                At your current savings rate of {formatCompact(analysis.monthlySavings)}/mo, you&apos;ll reach your target in{" "}
                <span className="text-zinc-200 font-medium">{analysis.monthsToTarget} months</span>
                {analysis.monthsToTarget > 12 && <> ({(analysis.monthsToTarget / 12).toFixed(1)} years)</>}.
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={50} />
                    <Tooltip cursor={false}
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number) => [formatCurrency(val), "Saved"]}
                    />
                    <ReferenceLine y={analysis.targetAmount} stroke="#14b8a6" strokeDasharray="4 4" label={{ value: "Target", fill: "#14b8a6", fontSize: 10, position: "right" }} />
                    <Bar dataKey="Saved" radius={[3, 3, 0, 0]} fill="#34d399" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Recommendations</h3>

            {analysis.grade === "A" && (
              <Tip
                title="You're set — consider optimizing"
                body="Your emergency fund is fully funded. Make sure it's in a high-yield savings account (4-5% APY) rather than a regular checking account. Any savings beyond your target can go toward investing."
                color="text-emerald-400"
              />
            )}

            {(analysis.grade === "B" || analysis.grade === "C") && (
              <Tip
                title={`${formatCompact(analysis.gap)} more to reach your target`}
                body={`At ${formatCompact(analysis.monthlySavings)}/mo savings, you'll get there in ${analysis.monthsToTarget ?? "—"} months. Consider automating a transfer to a dedicated HYSA on payday to make it effortless.`}
                color="text-amber-400"
              />
            )}

            {(analysis.grade === "D" || analysis.grade === "F") && (
              <>
                <Tip
                  title="Start with a $1,000 mini-fund"
                  body="Before building a full emergency fund, a $1,000 buffer handles most unexpected expenses (car repair, medical copay, appliance). It's a psychologically achievable first goal."
                  color="text-rose-400"
                />
                <Tip
                  title="Automate it"
                  body="Set up an automatic transfer of even $50-100/month to a separate HYSA. Treating it like a bill payment removes willpower from the equation."
                  color="text-zinc-400"
                />
              </>
            )}

            {analysis.liquidAssets > 0 && analysis.monthlyExpenses > 0 && (
              <Tip
                title="Where to keep it"
                body="Emergency funds should be liquid and safe — a high-yield savings account (HYSA) is ideal. Avoid CDs (locked up) or brokerage accounts (volatile). Check the Savings Finder page for current HYSA rates."
                color="text-zinc-400"
              />
            )}
          </div>

          {/* Educational note */}
          <div className="vela-card px-4 py-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div className="text-xs text-zinc-500 leading-relaxed space-y-1">
                <p>
                  <span className="text-zinc-300 font-medium">How much do you need?</span>{" "}
                  3 months for dual-income households with stable jobs. 6 months is the standard recommendation.
                  9-12 months if you&apos;re self-employed, have variable income, or are the sole earner.
                </p>
                <p>
                  <span className="text-zinc-300 font-medium">What counts as liquid?</span>{" "}
                  Checking, savings, HYSA, and money market accounts. Not investments (they fluctuate),
                  not retirement accounts (penalties), not home equity (can&apos;t access quickly).
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Based on your Cash Flow expenses and Net Worth liquid assets. Update both to keep this accurate.
            </p>
          </div>
        </>
      )}
    </PageTransition>
    </TierGate>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-vela-teal" />
        Emergency Fund
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        How many months of expenses can your liquid savings cover?
      </p>
    </div>
  );
}

// ── Tip Card ─────────────────────────────────────────────────────────────────

function Tip({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div className="vela-card py-3 px-4">
      <p className={`text-xs font-medium ${color} mb-0.5`}>{title}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
    </div>
  );
}

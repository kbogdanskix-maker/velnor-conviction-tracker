"use client";

import { useMemo } from "react";
import { Brain, AlertTriangle, CheckCircle, Info, Shield } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useJournal } from "@/hooks/useJournal";
import { analyzeBehavior } from "@/lib/behavioral-analysis";
import type { BehaviorInput, BiasDetection } from "@/lib/behavioral-analysis";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BehaviorPage() {
  const { summary } = useDefaultPortfolio();
  const { entries: journalEntries } = useJournal();

  const result = useMemo(() => {
    if (!summary) return null;

    const totalValue = summary.total_value || 1;
    const input: BehaviorInput = {
      holdings: summary.holdings.map((h) => ({
        ticker: h.ticker,
        weight: (h.market_value ?? h.total_cost ?? 0) / totalValue,
        unrealizedPnlPct: Number(h.unrealized_pnl_pct) || 0,
        dayChangePct: Number(h.day_change_pct) || 0,
        avgCost: h.avg_cost_basis,
        currentPrice: h.current_price ?? h.avg_cost_basis,
        marketValue: h.market_value ?? h.total_cost,
      })),
      journalEntries: journalEntries.map((e) => ({
        action: e.action,
        conviction: e.conviction,
        outcome: e.outcome,
        priceAtDecision: e.price_at_decision,
        priceAtReview: e.price_at_review,
        decidedAt: e.decided_at,
        ticker: e.ticker,
        timeHorizon: e.time_horizon,
      })),
      portfolioValue: summary.total_value,
      dayChangePct: Number(summary.day_change_pct) || 0,
    };

    return analyzeBehavior(input);
  }, [summary, journalEntries]);

  if (!result) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="vela-card animate-pulse h-24" />
          ))}
        </div>
      </PageTransition>
    );
  }

  const detected = result.biases.filter((b) => b.detected);
  const clear = result.biases.filter((b) => !b.detected);

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {/* Score */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="vela-card flex flex-col items-center justify-center py-6">
          <p className={`text-5xl font-bold tabular ${scoreColor(result.biasScore)}`}>
            {result.biasScore}
          </p>
          <p className={`text-sm font-medium mt-1 ${scoreColor(result.biasScore)}`}>
            {scoreLabel(result.biasScore)}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Behavior Score</p>
        </div>
        <div className="vela-card text-center py-6">
          <p className="text-3xl font-bold tabular text-amber-400">{result.detectedCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Biases Detected</p>
        </div>
        <div className="vela-card text-center py-6">
          <p className="text-3xl font-bold tabular text-emerald-400">
            {result.totalChecked - result.detectedCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">All Clear</p>
        </div>
      </div>

      {/* Top bias callout */}
      {result.topBias && (
        <div className="vela-card border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">{result.topBias.emoji}</span>
            <div>
              <p className="text-sm font-medium text-amber-400">
                Top concern: {result.topBias.name}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">{result.topBias.evidence}</p>
              <p className="text-xs text-zinc-500 mt-1 italic">{result.topBias.tip}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detected biases */}
      {detected.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Potential Biases
          </h2>
          {detected.map((bias) => (
            <BiasCard key={bias.id} bias={bias} />
          ))}
        </div>
      )}

      {/* Clear checks */}
      {clear.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Looking Good
          </h2>
          {clear.map((bias) => (
            <BiasCard key={bias.id} bias={bias} />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="vela-card border-zinc-700">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">How this works</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We analyze your portfolio positions and journal entries to detect common cognitive
              biases that affect investment decisions. The behavior score reflects how many biases
              are currently present. A higher score means fewer biases detected.
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Log more decisions in the Journal to get better insights over time. The more
              data we have, the more accurate the analysis becomes.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          This analysis is educational and based on common behavioral finance patterns.
          It is not financial advice. Consult a professional for personalized guidance.
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <Brain className="w-7 h-7 text-vela-teal" />
        Behavioral Finance
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Identify cognitive biases in your investment behavior and learn to overcome them.
      </p>
    </div>
  );
}

// ── Bias Card ────────────────────────────────────────────────────────────────

function BiasCard({ bias }: { bias: BiasDetection }) {
  const severityColor = {
    high: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    moderate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    low: "text-zinc-400 bg-zinc-800 border-zinc-700",
  };

  return (
    <div className={`vela-card border ${bias.detected ? severityColor[bias.severity] : "border-emerald-500/20 bg-emerald-500/5"}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{bias.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-medium ${bias.detected ? severityColor[bias.severity].split(" ")[0] : "text-emerald-400"}`}>
              {bias.name}
            </h3>
            {bias.detected && (
              <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                bias.severity === "high" ? "bg-rose-500/20 text-rose-400" :
                bias.severity === "moderate" ? "bg-amber-500/20 text-amber-400" :
                "bg-zinc-700 text-zinc-400"
              }`}>
                {bias.severity}
              </span>
            )}
            {!bias.detected && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{bias.description}</p>
          <p className="text-xs text-zinc-400 mt-1.5">{bias.evidence}</p>
          {bias.detected && (
            <p className="text-xs text-zinc-500 mt-1 italic flex items-start gap-1">
              <Shield className="w-3 h-3 mt-0.5 shrink-0 text-vela-teal" />
              {bias.tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-teal-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Disciplined";
  if (score >= 60) return "Aware";
  if (score >= 40) return "Needs Work";
  return "High Risk";
}

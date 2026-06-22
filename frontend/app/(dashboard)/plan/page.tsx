"use client";

import { useState, useCallback } from "react";
import {
  Sparkles, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  TrendingUp, Shield, Target, BarChart2, AlertTriangle,
} from "lucide-react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import TierGate from "@/components/shared/TierGate";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useGoals } from "@/hooks/useGoals";
import { useTier } from "@/hooks/useTier";
import { apiStream } from "@/lib/api";

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Renders the streamed markdown plan without pulling in a full MD library.

function PlanSection({ content, icon: Icon, color }: {
  content: string;
  icon: typeof Sparkles;
  color: string;
}) {
  const lines = content.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} className={`flex items-center gap-2 mb-3 ${color}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <h3 className="font-semibold text-sm">{trimmed.slice(3)}</h3>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 text-xs text-zinc-300 leading-relaxed">
              <span className={`font-bold tabular-nums shrink-0 ${color}`}>
                {trimmed.match(/^\d+/)?.[0]}.
              </span>
              <span>{trimmed.replace(/^\d+\.\s*/, "")}</span>
            </div>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 text-xs text-zinc-300 leading-relaxed">
              <span className={`shrink-0 ${color}`}>•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <p key={i} className="text-xs font-semibold text-zinc-200">
              {trimmed.slice(2, -2)}
            </p>
          );
        }
        return (
          <p key={i} className="text-xs text-zinc-400 leading-relaxed">
            {trimmed.replace(/\*\*(.+?)\*\*/g, "$1")}
          </p>
        );
      })}
    </div>
  );
}

// ── Section splitter ─────────────────────────────────────────────────────────

const SECTION_CONFIG: Record<string, { icon: typeof Sparkles; color: string; bg: string }> = {
  "Financial Health Overview": { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/5 border-emerald-400/10" },
  "Priority Actions":          { icon: Target,       color: "text-teal-400",    bg: "bg-teal-400/5 border-teal-400/10" },
  "Goals Analysis":             { icon: TrendingUp,   color: "text-vela-teal",   bg: "bg-vela-teal/5 border-vela-teal/10" },
  "Investment Strategy":        { icon: BarChart2,    color: "text-vela-teal",   bg: "bg-vela-teal/5 border-vela-teal/10" },
  "Risks to Watch":             { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-400/5 border-amber-400/10" },
};

function splitIntoSections(text: string): { title: string; content: string }[] {
  const parts = text.split(/(?=^## )/m);
  return parts
    .filter((p) => p.trim())
    .map((p) => {
      const lines = p.split("\n");
      const heading = lines[0]?.replace(/^## /, "").trim() ?? "";
      const body = lines.slice(1).join("\n").trim();
      return { title: heading, content: p };
    });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const { summary: nwSummary, isLoading: nwLoading } = useNetWorthSummary();
  const { summary: cfSummary, isLoading: cfLoading } = useCashFlowSummary();
  const { goals, isLoading: goalsLoading } = useGoals();
  const { isVoyager } = useTier();

  const [planText, setPlanText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const loading = nwLoading || cfLoading || goalsLoading;
  const hasData = nwSummary || cfSummary;

  const generate = useCallback(async () => {
    setPlanText("");
    setError(null);
    setGenerating(true);
    setGenerated(false);

    try {
      const res = await apiStream("/ai/plan");
      if (res.status === 403) {
        setError("AI plans are available on Voyager and Navigator. Upgrade to generate yours.");
        setGenerating(false);
        return;
      }
      if (res.status === 429) {
        setError("You've reached today's AI insight limit. It resets at midnight — or upgrade to Navigator for unlimited insights.");
        setGenerating(false);
        return;
      }
      if (!res.ok || !res.body) {
        setError("Failed to connect to plan generator.");
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            if (msg.text) setPlanText((t) => t + msg.text);
            if (msg.done) setGenerated(true);
            if (msg.error) setError(msg.error);
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }, []);

  if (loading) return <DashboardSkeleton />;

  const sections = planText ? splitIntoSections(planText) : [];
  const monthlySavings = cfSummary
    ? (cfSummary.total_income - cfSummary.total_expenses)
    : null;
  const savingsRate = cfSummary && cfSummary.total_income > 0
    ? Math.round((monthlySavings! / cfSummary.total_income) * 100)
    : null;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-teal-400" />
            My Financial Plan
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            AI-generated plan tailored to your goals, net worth, and cash flow
          </p>
        </div>
        {isVoyager ? (
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : generated ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? "Generating…" : generated ? "Regenerate" : "Generate Plan"}
          </button>
        ) : null}
      </div>

      {/* Context summary cards */}
      {hasData && (
        <RevealOnScroll>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Net Worth",
                value: nwSummary ? `$${(nwSummary.net_worth / 1000).toFixed(0)}k` : " -",
                sub: "total",
                color: "text-emerald-400",
              },
              {
                label: "Monthly Income",
                value: cfSummary ? `$${(cfSummary.total_income / 1000).toFixed(1)}k` : " -",
                sub: "recurring",
                color: "text-teal-400",
              },
              {
                label: "Savings Rate",
                value: savingsRate != null ? `${savingsRate}%` : " -",
                sub: "of income",
                color: savingsRate != null && savingsRate >= 20 ? "text-emerald-400" : "text-amber-400",
              },
              {
                label: "Active Goals",
                value: String(goals.length),
                sub: "goals set",
                color: "text-vela-teal",
              },
            ].map((card) => (
              <div key={card.label} className="vela-card text-center py-4">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{card.label}</p>
                <p className={`text-xl font-display font-bold tabular-nums ${card.color}`}>{card.value}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      )}

      {/* AI plan generation — gated to Voyager+ (backend enforces too) */}
      <TierGate requiredTier="voyager">
      {/* Empty state */}
      {!planText && !generating && !error && (
        <FloatingCard glowColor="rgba(26, 168, 187,0.08)" tilt={false}>
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <p className="text-zinc-200 font-medium text-lg">Your personalised plan is waiting</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
                Claude will analyse your net worth, cash flow, and goals to build a plan with concrete action steps.
              </p>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-500 text-zinc-950 font-semibold text-sm hover:bg-teal-400 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate My Plan
            </button>
            {!hasData && (
              <p className="text-xs text-zinc-600">
                Add your net worth and cash flow data for a richer plan.
              </p>
            )}
          </div>
        </FloatingCard>
      )}

      {/* Error */}
      {error && (
        <div className="vela-card flex items-center gap-3 border-rose-500/20 bg-rose-500/5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-sm text-rose-400 font-medium">Generation failed</p>
            <p className="text-xs text-zinc-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Streaming raw text (before sections are parsed) */}
      {generating && planText && sections.length === 0 && (
        <div className="vela-card">
          <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
            {planText}
            <span className="inline-block w-1.5 h-3.5 bg-teal-400 ml-0.5 animate-pulse align-middle" />
          </p>
        </div>
      )}

      {/* Rendered sections */}
      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section, i) => {
            const cfg = SECTION_CONFIG[section.title] ?? {
              icon: Shield,
              color: "text-zinc-400",
              bg: "bg-zinc-800/30 border-zinc-700/30",
            };
            return (
              <RevealOnScroll key={section.title || i} delay={i * 0.05}>
                <div className={`vela-card border ${cfg.bg}`}>
                  <PlanSection
                    content={section.content}
                    icon={cfg.icon}
                    color={cfg.color}
                  />
                  {/* Streaming cursor on last section */}
                  {generating && i === sections.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-teal-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {generated && !generating && (
        <RevealOnScroll>
          <p className="text-xs text-zinc-600 text-center">
            Generated by Claude · Based on your Velnor data · Not financial advice
          </p>
        </RevealOnScroll>
      )}
      </TierGate>
    </PageTransition>
  );
}

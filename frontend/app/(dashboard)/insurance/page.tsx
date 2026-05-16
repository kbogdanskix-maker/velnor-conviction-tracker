"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Shield, Heart, Car, Home, Umbrella, User, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, Info, Plus, Trash2, Edit2, Check, X,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCloudStore } from "@/hooks/useCloudStore";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Types ───────────────────────────────────────────────────────────────────

type InsuranceType = "health" | "auto" | "home_renters" | "life" | "disability" | "umbrella";

interface Policy {
  id: string;
  type: InsuranceType;
  provider: string;
  premium: number; // monthly
  deductible: number;
  coverage: number; // coverage limit
  notes: string;
}

interface GapResult {
  type: InsuranceType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "covered" | "gap" | "missing";
  message: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
}

const TYPE_META: Record<InsuranceType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  health: { label: "Health", icon: Heart },
  auto: { label: "Auto", icon: Car },
  home_renters: { label: "Home / Renters", icon: Home },
  life: { label: "Life", icon: User },
  disability: { label: "Disability", icon: Shield },
  umbrella: { label: "Umbrella", icon: Umbrella },
};

const INSURANCE_TYPES: InsuranceType[] = ["health", "auto", "home_renters", "life", "disability", "umbrella"];

// localStorage helpers removed — now uses useCloudStore

// ── Page ────────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const { summary: cashFlow } = useCashFlowSummary();
  const { summary: netWorth } = useNetWorthSummary();
  const { data: cloudPolicies, save: savePolicies } = useCloudStore<Policy[]>("insurance");
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Sync from cloud store — only when cloud data actually has content
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current && Array.isArray(cloudPolicies) && cloudPolicies.length > 0) {
      synced.current = true;
      setPolicies(cloudPolicies);
    }
  }, [cloudPolicies]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<InsuranceType>("health");
  const [formProvider, setFormProvider] = useState("");
  const [formPremium, setFormPremium] = useState("");
  const [formDeductible, setFormDeductible] = useState("");
  const [formCoverage, setFormCoverage] = useState("");
  const [formNotes, setFormNotes] = useState("");

  function resetForm() {
    setFormType("health");
    setFormProvider("");
    setFormPremium("");
    setFormDeductible("");
    setFormCoverage("");
    setFormNotes("");
    setEditId(null);
    setShowAdd(false);
  }

  function handleSave() {
    const policy: Policy = {
      id: editId || crypto.randomUUID(),
      type: formType,
      provider: formProvider || "Unknown",
      premium: parseFloat(formPremium) || 0,
      deductible: parseFloat(formDeductible) || 0,
      coverage: parseFloat(formCoverage) || 0,
      notes: formNotes,
    };

    let updated: Policy[];
    if (editId) {
      updated = policies.map((p) => (p.id === editId ? policy : p));
    } else {
      updated = [...policies, policy];
    }
    setPolicies(updated);
    savePolicies(updated);
    resetForm();
  }

  function handleEdit(p: Policy) {
    setEditId(p.id);
    setFormType(p.type);
    setFormProvider(p.provider);
    setFormPremium(String(p.premium));
    setFormDeductible(String(p.deductible));
    setFormCoverage(String(p.coverage));
    setFormNotes(p.notes);
    setShowAdd(true);
  }

  function handleDelete(id: string) {
    const updated = policies.filter((p) => p.id !== id);
    setPolicies(updated);
    savePolicies(updated);
  }

  const annualIncome = (cashFlow?.total_income ?? 0) * 12;
  const totalAssets = netWorth?.total_assets ?? 0;
  const totalLiabilities = netWorth?.total_liabilities ?? 0;
  const dependents = 0; // Could be configurable

  // Gap analysis
  const gaps = useMemo((): GapResult[] => {
    const byType = new Map<InsuranceType, Policy[]>();
    for (const p of policies) {
      const arr = byType.get(p.type) || [];
      arr.push(p);
      byType.set(p.type, arr);
    }

    const results: GapResult[] = [];

    // Health
    const healthPolicies = byType.get("health") || [];
    if (healthPolicies.length === 0) {
      results.push({
        type: "health", label: "Health", icon: Heart,
        status: "missing", priority: "high",
        message: "No health insurance on file.",
        recommendation: "Health insurance is essential. If employed, check employer benefits. Otherwise, explore marketplace plans at healthcare.gov.",
      });
    } else {
      const maxDeductible = Math.max(...healthPolicies.map((p) => p.deductible));
      if (maxDeductible > 5000) {
        results.push({
          type: "health", label: "Health", icon: Heart,
          status: "gap", priority: "medium",
          message: `High deductible plan ($${maxDeductible.toLocaleString()}). Ensure you have savings to cover it.`,
          recommendation: "Consider pairing a high-deductible plan with an HSA. Keep at least 1x your deductible in liquid savings.",
        });
      } else {
        results.push({
          type: "health", label: "Health", icon: Heart,
          status: "covered", priority: "low",
          message: `Health insurance active with ${formatCurrency(maxDeductible)} deductible.`,
          recommendation: "Review annually during open enrollment for better rates or coverage.",
        });
      }
    }

    // Auto
    const autoPolicies = byType.get("auto") || [];
    if (autoPolicies.length === 0) {
      results.push({
        type: "auto", label: "Auto", icon: Car,
        status: "missing", priority: "medium",
        message: "No auto insurance on file.",
        recommendation: "If you own or lease a vehicle, auto insurance is legally required in most states. Add your policy to track coverage.",
      });
    } else {
      const minCoverage = Math.min(...autoPolicies.map((p) => p.coverage));
      if (minCoverage < 100000) {
        results.push({
          type: "auto", label: "Auto", icon: Car,
          status: "gap", priority: "medium",
          message: `Auto coverage limit is ${formatCurrency(minCoverage)}. May be insufficient for serious accidents.`,
          recommendation: "Consider at least $100k/$300k liability coverage. If your net worth exceeds your coverage, you're exposed.",
        });
      } else {
        results.push({
          type: "auto", label: "Auto", icon: Car,
          status: "covered", priority: "low",
          message: `Auto insurance active with ${formatCurrency(minCoverage)} coverage.`,
          recommendation: "Shop annually. Bundle with home/renters for discounts.",
        });
      }
    }

    // Home / Renters
    const homePolicies = byType.get("home_renters") || [];
    if (homePolicies.length === 0) {
      results.push({
        type: "home_renters", label: "Home / Renters", icon: Home,
        status: "missing", priority: "high",
        message: "No home or renters insurance on file.",
        recommendation: "Whether you rent or own, property insurance protects your belongings and provides liability coverage. Renters insurance is typically $15-30/month.",
      });
    } else {
      results.push({
        type: "home_renters", label: "Home / Renters", icon: Home,
        status: "covered", priority: "low",
        message: `Property insurance active. ${homePolicies.length} policy(ies) on file.`,
        recommendation: "Update coverage after major purchases. Review replacement cost vs. actual cash value.",
      });
    }

    // Life
    const lifePolicies = byType.get("life") || [];
    const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.coverage, 0);
    if (lifePolicies.length === 0) {
      if (annualIncome > 0 || totalLiabilities > 50000) {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "missing", priority: "high",
          message: "No life insurance on file.",
          recommendation: annualIncome > 0
            ? `Rule of thumb: 10-12x annual income (${formatCurrency(annualIncome * 10)} – ${formatCurrency(annualIncome * 12)}). Term life is the most cost-effective option.`
            : "Consider life insurance if you have dependents or significant debt that would burden others.",
        });
      } else {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "missing", priority: "low",
          message: "No life insurance on file. May not be needed if no dependents or major debts.",
          recommendation: "Life insurance becomes important when others depend on your income or you carry shared debt.",
        });
      }
    } else {
      const idealCoverage = annualIncome * 10;
      if (annualIncome > 0 && totalLifeCoverage < idealCoverage * 0.6) {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "gap", priority: "high",
          message: `Life coverage (${formatCurrency(totalLifeCoverage)}) is below 60% of the recommended ${formatCurrency(idealCoverage)} (10x income).`,
          recommendation: "Consider increasing coverage. A supplemental term policy can fill the gap affordably.",
        });
      } else {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "covered", priority: "low",
          message: `Life insurance: ${formatCurrency(totalLifeCoverage)} coverage.`,
          recommendation: "Review beneficiaries annually and after major life events (marriage, kids, home purchase).",
        });
      }
    }

    // Disability
    const disPolicies = byType.get("disability") || [];
    if (disPolicies.length === 0 && annualIncome > 0) {
      results.push({
        type: "disability", label: "Disability", icon: Shield,
        status: "missing", priority: "high",
        message: "No disability insurance on file. This is the most underinsured risk for working adults.",
        recommendation: "1 in 4 workers will experience a disability before retirement. Short-term + long-term disability insurance protects your income. Check if your employer offers it.",
      });
    } else if (disPolicies.length > 0) {
      results.push({
        type: "disability", label: "Disability", icon: Shield,
        status: "covered", priority: "low",
        message: `Disability coverage active. ${disPolicies.length} policy(ies) on file.`,
        recommendation: "Ensure coverage is 60-70% of gross income. Check the elimination period (waiting period before benefits start).",
      });
    }

    // Umbrella
    const umbPolicies = byType.get("umbrella") || [];
    if (umbPolicies.length === 0 && totalAssets > 500000) {
      results.push({
        type: "umbrella", label: "Umbrella", icon: Umbrella,
        status: "gap", priority: "medium",
        message: `Net assets over ${formatCurrency(totalAssets)}. An umbrella policy provides extra liability protection.`,
        recommendation: "Umbrella policies typically cost $200-400/year for $1M coverage. Worth it when your assets exceed your auto/home liability limits.",
      });
    } else if (umbPolicies.length > 0) {
      results.push({
        type: "umbrella", label: "Umbrella", icon: Umbrella,
        status: "covered", priority: "low",
        message: `Umbrella coverage active with ${formatCurrency(umbPolicies.reduce((s, p) => s + p.coverage, 0))} limit.`,
        recommendation: "Ensure umbrella coverage exceeds your total net worth. Adjust as assets grow.",
      });
    }

    return results.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [policies, annualIncome, totalAssets, totalLiabilities]);

  const totalMonthlyPremiums = policies.reduce((s, p) => s + p.premium, 0);
  const coveredCount = gaps.filter((g) => g.status === "covered").length;
  const gapCount = gaps.filter((g) => g.status === "gap").length;
  const missingCount = gaps.filter((g) => g.status === "missing").length;

  const overallScore = Math.round((coveredCount / Math.max(gaps.length, 1)) * 100);

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Insurance Gap Analyzer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Track your coverage and identify protection gaps before they become costly
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Coverage Score</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${overallScore >= 80 ? "text-gain" : overallScore >= 50 ? "text-yellow-400" : "text-loss"}`}>
            {overallScore}%
          </p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Covered</p>
          <p className="text-3xl font-bold text-gain tabular-nums mt-1">{coveredCount}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Gaps</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${gapCount > 0 ? "text-yellow-400" : "text-zinc-500"}`}>{gapCount}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Missing</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${missingCount > 0 ? "text-loss" : "text-zinc-500"}`}>{missingCount}</p>
        </div>
      </div>

      {/* Gap results */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Coverage Analysis</h2>
        {gaps.map((gap) => {
          const Icon = gap.icon;
          return (
            <div
              key={gap.type}
              className={`vela-card p-4 border-l-4 ${
                gap.status === "covered" ? "border-l-gain" : gap.status === "gap" ? "border-l-yellow-400" : "border-l-loss"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${gap.status === "covered" ? "text-gain" : gap.status === "gap" ? "text-yellow-400" : "text-loss"}`}>
                  {gap.status === "covered" ? <CheckCircle2 className="w-5 h-5" /> : gap.status === "gap" ? <AlertTriangle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-200">{gap.label}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      gap.priority === "high" ? "bg-loss/15 text-loss" : gap.priority === "medium" ? "bg-yellow-400/15 text-yellow-400" : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {gap.priority}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300">{gap.message}</p>
                  <p className="text-xs text-zinc-500 mt-1">{gap.recommendation}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Policies list */}
      <div className="vela-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Your Policies</h2>
            {totalMonthlyPremiums > 0 && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Total: {formatCurrency(totalMonthlyPremiums)}/mo ({formatCurrency(totalMonthlyPremiums * 12)}/yr)
              </p>
            )}
          </div>
          <button
            onClick={() => { resetForm(); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-vela-teal/15 text-vela-teal hover:bg-vela-teal/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Policy
          </button>
        </div>

        {/* Add/Edit form */}
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as InsuranceType)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                >
                  {INSURANCE_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Provider</label>
                <input
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  placeholder="e.g. State Farm"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Monthly Premium</label>
                <input
                  type="number"
                  value={formPremium}
                  onChange={(e) => setFormPremium(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Deductible</label>
                <input
                  type="number"
                  value={formDeductible}
                  onChange={(e) => setFormDeductible(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Coverage Limit</label>
                <input
                  type="number"
                  value={formCoverage}
                  onChange={(e) => setFormCoverage(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-vela-teal"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-vela-teal text-zinc-950 hover:bg-vela-teal/90 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {editId ? "Update" : "Add"} Policy
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Policy list */}
        {policies.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No policies added yet. Add your insurance policies to get a personalized gap analysis.
          </p>
        ) : (
          <div className="space-y-2">
            {policies.map((p) => {
              const meta = TYPE_META[p.type];
              const Icon = meta.icon;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors group">
                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">{p.provider}</span>
                      <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">{meta.label}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-zinc-500 mt-0.5">
                      <span>{formatCurrency(p.premium)}/mo</span>
                      {p.deductible > 0 && <span>{formatCurrency(p.deductible)} deductible</span>}
                      {p.coverage > 0 && <span>{formatCurrency(p.coverage)} coverage</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded text-zinc-500 hover:text-loss hover:bg-zinc-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Educational content */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Insurance Priority Guide</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-loss font-bold text-xs mt-0.5 shrink-0">1. ESSENTIAL</span>
            <p className="text-zinc-400">
              <span className="text-zinc-200 font-medium">Health & Auto</span> — legally required or financially catastrophic without. Always maintain these first.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-yellow-400 font-bold text-xs mt-0.5 shrink-0">2. CRITICAL</span>
            <p className="text-zinc-400">
              <span className="text-zinc-200 font-medium">Disability & Home/Renters</span> — protects your earning power and belongings. Disability is the most underinsured risk.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gain font-bold text-xs mt-0.5 shrink-0">3. IMPORTANT</span>
            <p className="text-zinc-400">
              <span className="text-zinc-200 font-medium">Life & Umbrella</span> — important if you have dependents (life) or significant assets to protect (umbrella).
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}

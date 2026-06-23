"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Shield, Heart, Car, Home, Umbrella, User, AlertTriangle,
  CheckCircle2, XCircle, Plus, Trash2, Edit2, Check, X, Users, Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCloudStore } from "@/hooks/useCloudStore";
import { useProfile } from "@/hooks/useProfile";
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const { summary: cashFlow } = useCashFlowSummary();
  const { summary: netWorth } = useNetWorthSummary();
  const { data: cloudPolicies, save: savePolicies } = useCloudStore<Policy[]>("insurance");
  const { profile, update: updateProfile } = useProfile();
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Sync from cloud store — only when cloud data actually has content
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current && Array.isArray(cloudPolicies) && cloudPolicies.length > 0) {
      synced.current = true;
      setPolicies(cloudPolicies);
    }
  }, [cloudPolicies]);

  // Auto-detect homeowner from net worth liabilities (mortgage keyword)
  const liabilityNames = (netWorth?.assets ?? [])
    .filter((a) => a.is_liability)
    .map((a) => a.name?.toLowerCase() ?? "");
  const hasMortgage = liabilityNames.some((n) => n.includes("mortgage") || n.includes("home loan") || n.includes("house"));
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
  const monthlyIncome = cashFlow?.total_income ?? 0;
  const totalAssets = netWorth?.total_assets ?? 0;
  const totalLiabilities = netWorth?.total_liabilities ?? 0;
  const { dependents, isHomeowner } = profile;
  const effectiveHomeowner = isHomeowner || hasMortgage;

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

    // Home / Renters — context-aware for owner vs renter
    const homePolicies = byType.get("home_renters") || [];
    if (homePolicies.length === 0) {
      results.push({
        type: "home_renters", label: "Home / Renters", icon: Home,
        status: "missing", priority: "high",
        message: effectiveHomeowner
          ? "No home insurance on file. As a homeowner, this is essential."
          : "No renters insurance on file.",
        recommendation: effectiveHomeowner
          ? "Home insurance protects your property and provides liability coverage. Required by most mortgage lenders."
          : "Renters insurance is typically $15–30/month and covers your belongings plus liability. One of the best value insurance products.",
      });
    } else {
      results.push({
        type: "home_renters", label: "Home / Renters", icon: Home,
        status: "covered", priority: "low",
        message: `${effectiveHomeowner ? "Home" : "Renters"} insurance active. ${homePolicies.length} policy(ies) on file.`,
        recommendation: effectiveHomeowner
          ? "Update coverage after renovations or major purchases. Review replacement cost vs. actual cash value."
          : "Review annually. Your coverage should reflect the value of your belongings.",
      });
    }

    // Life — priority depends on dependents and shared debt
    const lifePolicies = byType.get("life") || [];
    const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.coverage, 0);
    const lifeNeeded = dependents > 0 || totalLiabilities > 50000;
    if (lifePolicies.length === 0) {
      if (lifeNeeded) {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "missing", priority: dependents > 0 ? "high" : "medium",
          message: dependents > 0
            ? `No life insurance on file. You have ${dependents} dependent${dependents > 1 ? "s" : ""} relying on your income.`
            : "No life insurance on file. You carry significant shared debt.",
          recommendation: annualIncome > 0
            ? `Rule of thumb: ${dependents > 0 ? "10-12x" : "5-7x"} annual income = ${formatCurrency(annualIncome * (dependents > 0 ? 10 : 5))}–${formatCurrency(annualIncome * (dependents > 0 ? 12 : 7))}. Term life is most cost-effective.`
            : "Consider life insurance if others depend on your income or share your debt.",
        });
      } else {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "missing", priority: "low",
          message: "No life insurance on file. Not urgent with no dependents or major shared debt.",
          recommendation: "Life insurance becomes important when others depend on your income. Revisit if your situation changes.",
        });
      }
    } else {
      const idealCoverage = annualIncome * (dependents > 0 ? 10 : 5);
      if (lifeNeeded && annualIncome > 0 && totalLifeCoverage < idealCoverage * 0.6) {
        results.push({
          type: "life", label: "Life", icon: User,
          status: "gap", priority: dependents > 0 ? "high" : "medium",
          message: `Life coverage (${formatCurrency(totalLifeCoverage)}) is below the recommended ${formatCurrency(idealCoverage)} (${dependents > 0 ? "10x" : "5x"} income).`,
          recommendation: "Consider a supplemental term policy to close the gap affordably.",
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
  }, [policies, annualIncome, totalAssets, totalLiabilities, dependents, effectiveHomeowner]);

  const totalMonthlyPremiums = policies.reduce((s, p) => s + p.premium, 0);
  const coveredCount = gaps.filter((g) => g.status === "covered").length;
  const gapCount = gaps.filter((g) => g.status === "gap").length;
  const missingCount = gaps.filter((g) => g.status === "missing").length;
  const overallScore = Math.round((coveredCount / Math.max(gaps.length, 1)) * 100);
  const pctOfIncome = monthlyIncome > 0 ? (totalMonthlyPremiums / monthlyIncome) * 100 : null;

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

      {/* Profile strip */}
      <div className="vela-card p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Your Profile</p>
        <div className="flex flex-wrap gap-6">
          {/* Dependents */}
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="text-sm text-zinc-400">Dependents</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateProfile({ dependents: Math.max(0, dependents - 1) })}
                className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold leading-none flex items-center justify-center transition-colors"
              >−</button>
              <span className="w-6 text-center text-sm font-medium text-zinc-100 tabular-nums">{dependents}</span>
              <button
                onClick={() => updateProfile({ dependents: dependents + 1 })}
                className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-bold leading-none flex items-center justify-center transition-colors"
              >+</button>
            </div>
          </div>
          {/* Homeowner */}
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="text-sm text-zinc-400">I own my home</span>
            <button
              onClick={() => updateProfile({ isHomeowner: !isHomeowner })}
              className={`w-10 h-5 rounded-full transition-colors relative ${(isHomeowner || hasMortgage) ? "bg-teal-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(isHomeowner || hasMortgage) ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
            {hasMortgage && !isHomeowner && (
              <span className="text-[10px] text-vela-teal/70">auto-detected from net worth</span>
            )}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Coverage Score</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${overallScore >= 80 ? "text-gain" : overallScore >= 50 ? "text-amber-400" : "text-loss"}`}>
            {overallScore}%
          </p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Covered</p>
          <p className="text-3xl font-bold text-gain tabular-nums mt-1">{coveredCount}</p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Gaps / Missing</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${gapCount + missingCount > 0 ? "text-loss" : "text-zinc-500"}`}>
            {gapCount + missingCount}
          </p>
        </div>
        <div className="vela-card p-4 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">% of Income</p>
          {pctOfIncome !== null ? (
            <>
              <p className={`text-3xl font-bold tabular-nums mt-1 ${pctOfIncome > 15 ? "text-loss" : pctOfIncome > 10 ? "text-amber-400" : "text-gain"}`}>
                {pctOfIncome.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">target: 10–15%</p>
            </>
          ) : (
            <p className="text-3xl font-bold text-zinc-600 tabular-nums mt-1">—</p>
          )}
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
                gap.status === "covered" ? "border-l-gain" : gap.status === "gap" ? "border-l-amber-400" : "border-l-loss"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${gap.status === "covered" ? "text-gain" : gap.status === "gap" ? "text-amber-400" : "text-loss"}`}>
                  {gap.status === "covered" ? <CheckCircle2 className="w-5 h-5" /> : gap.status === "gap" ? <AlertTriangle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-200">{gap.label}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      gap.priority === "high" ? "bg-loss/15 text-loss" : gap.priority === "medium" ? "bg-amber-400/15 text-amber-400" : "bg-zinc-700 text-zinc-400"
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
              <span className="text-zinc-200 font-medium">Health & Auto</span>  - legally required or financially catastrophic without. Always maintain these first.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-amber-400 font-bold text-xs mt-0.5 shrink-0">2. CRITICAL</span>
            <p className="text-zinc-400">
              <span className="text-zinc-200 font-medium">Disability & Home/Renters</span>  - protects your earning power and belongings. Disability is the most underinsured risk.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gain font-bold text-xs mt-0.5 shrink-0">3. IMPORTANT</span>
            <p className="text-zinc-400">
              <span className="text-zinc-200 font-medium">Life & Umbrella</span>  - important if you have dependents (life) or significant assets to protect (umbrella).
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Home, DollarSign, TrendingUp, Percent, Calculator,
  ArrowUpRight, ArrowDownRight, Info, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Types & helpers ──────────────────────────────────────────────────────────

interface PropertyInputs {
  purchasePrice: number;
  downPaymentPct: number;
  closingCostPct: number;
  mortgageRate: number;
  mortgageYears: number;
  monthlyRent: number;
  vacancyPct: number;
  propertyTaxPct: number;
  insuranceAnnual: number;
  maintenancePct: number;
  mgmtFeePct: number;
  appreciationPct: number;
  rentGrowthPct: number;
}

const DEFAULTS: PropertyInputs = {
  purchasePrice: 300000,
  downPaymentPct: 20,
  closingCostPct: 3,
  mortgageRate: 6.8,
  mortgageYears: 30,
  monthlyRent: 2200,
  vacancyPct: 5,
  propertyTaxPct: 1.2,
  insuranceAnnual: 1800,
  maintenancePct: 1,
  mgmtFeePct: 0,
  appreciationPct: 3,
  rentGrowthPct: 2,
};

const PRESETS = [
  { label: "Starter Home", price: 250000, rent: 1800, down: 20 },
  { label: "Median US", price: 400000, rent: 2800, down: 20 },
  { label: "Multi-Family", price: 600000, rent: 5000, down: 25 },
  { label: "HCOL Market", price: 800000, rent: 4500, down: 25 },
];

function calcMortgagePayment(principal: number, annualRate: number, years: number) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function grade(capRate: number): { letter: string; color: string } {
  if (capRate >= 8) return { letter: "A", color: "text-gain" };
  if (capRate >= 6) return { letter: "B", color: "text-gain" };
  if (capRate >= 4) return { letter: "C", color: "text-yellow-400" };
  if (capRate >= 2) return { letter: "D", color: "text-orange-400" };
  return { letter: "F", color: "text-loss" };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function RealEstatePage() {
  const [inputs, setInputs] = useState<PropertyInputs>(DEFAULTS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function set<K extends keyof PropertyInputs>(key: K, val: string) {
    setInputs((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  const analysis = useMemo(() => {
    const {
      purchasePrice, downPaymentPct, closingCostPct, mortgageRate, mortgageYears,
      monthlyRent, vacancyPct, propertyTaxPct, insuranceAnnual,
      maintenancePct, mgmtFeePct, appreciationPct, rentGrowthPct,
    } = inputs;

    const downPayment = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * (closingCostPct / 100);
    const totalCashIn = downPayment + closingCosts;

    const mortgageMonthly = calcMortgagePayment(loanAmount, mortgageRate, mortgageYears);
    const propertyTaxMonthly = (purchasePrice * (propertyTaxPct / 100)) / 12;
    const insuranceMonthly = insuranceAnnual / 12;
    const maintenanceMonthly = (purchasePrice * (maintenancePct / 100)) / 12;
    const mgmtFeeMonthly = monthlyRent * (mgmtFeePct / 100);

    const effectiveRent = monthlyRent * (1 - vacancyPct / 100);
    const totalExpensesMonthly = mortgageMonthly + propertyTaxMonthly + insuranceMonthly + maintenanceMonthly + mgmtFeeMonthly;
    const cashFlowMonthly = effectiveRent - totalExpensesMonthly;
    const cashFlowAnnual = cashFlowMonthly * 12;

    // NOI (no mortgage — for cap rate)
    const noiAnnual = (effectiveRent * 12) - (propertyTaxMonthly + insuranceMonthly + maintenanceMonthly + mgmtFeeMonthly) * 12;
    const capRate = (noiAnnual / purchasePrice) * 100;
    const cashOnCash = totalCashIn > 0 ? (cashFlowAnnual / totalCashIn) * 100 : 0;
    const grm = monthlyRent > 0 ? purchasePrice / (monthlyRent * 12) : 0;

    // 1% rule
    const onePercentRule = monthlyRent >= purchasePrice * 0.01;

    // Expense breakdown for bar chart
    const expenses = [
      { name: "Mortgage", value: mortgageMonthly },
      { name: "Tax", value: propertyTaxMonthly },
      { name: "Insurance", value: insuranceMonthly },
      { name: "Maintenance", value: maintenanceMonthly },
      ...(mgmtFeeMonthly > 0 ? [{ name: "Mgmt Fee", value: mgmtFeeMonthly }] : []),
    ];

    // 10-year projection
    const projection: { year: number; equity: number; cashFlow: number; value: number; totalReturn: number }[] = [];
    let cumCashFlow = 0;
    let balance = loanAmount;
    const monthlyRate = mortgageRate / 100 / 12;

    for (let y = 1; y <= 10; y++) {
      const yearRent = monthlyRent * Math.pow(1 + rentGrowthPct / 100, y - 1);
      const yearEffective = yearRent * (1 - vacancyPct / 100) * 12;
      const propValue = purchasePrice * Math.pow(1 + appreciationPct / 100, y);

      // Approximate principal paydown for the year
      let yearPrincipalPaid = 0;
      for (let m = 0; m < 12; m++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = mortgageMonthly - interestPayment;
        yearPrincipalPaid += principalPayment;
        balance = Math.max(0, balance - principalPayment);
      }

      const yearOpEx = (propertyTaxMonthly + insuranceMonthly + maintenanceMonthly + mgmtFeeMonthly) * 12;
      const yearCashFlow = yearEffective - (mortgageMonthly * 12) - yearOpEx + (mortgageMonthly * 12 - yearPrincipalPaid * 0); // simplify
      // Actually: cash flow = effective rent - total expenses
      const yearTotalExpenses = mortgageMonthly * 12 + yearOpEx;
      const realCashFlow = yearEffective - yearTotalExpenses;
      cumCashFlow += realCashFlow;

      const equity = propValue - balance;
      const totalReturn = (equity - totalCashIn + cumCashFlow);

      projection.push({
        year: y,
        equity: Math.round(equity),
        cashFlow: Math.round(cumCashFlow),
        value: Math.round(propValue),
        totalReturn: Math.round(totalReturn),
      });
    }

    return {
      downPayment, loanAmount, closingCosts, totalCashIn,
      mortgageMonthly, effectiveRent, totalExpensesMonthly,
      cashFlowMonthly, cashFlowAnnual, noiAnnual, capRate,
      cashOnCash, grm, onePercentRule, expenses, projection,
    };
  }, [inputs]);

  const capGrade = grade(analysis.capRate);

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100">Rental Property Analyzer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Evaluate rental property returns with cap rate, cash-on-cash, and 10-year projections
        </p>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setInputs((prev) => ({
              ...prev,
              purchasePrice: p.price,
              monthlyRent: p.rent,
              downPaymentPct: p.down,
            }))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input + Key metrics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs card */}
        <div className="lg:col-span-2 vela-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Property Details</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InputField label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => set("purchasePrice", v)} prefix="$" />
            <InputField label="Monthly Rent" value={inputs.monthlyRent} onChange={(v) => set("monthlyRent", v)} prefix="$" />
            <InputField label="Down Payment" value={inputs.downPaymentPct} onChange={(v) => set("downPaymentPct", v)} suffix="%" />
            <InputField label="Mortgage Rate" value={inputs.mortgageRate} onChange={(v) => set("mortgageRate", v)} suffix="%" />
            <InputField label="Loan Term" value={inputs.mortgageYears} onChange={(v) => set("mortgageYears", v)} suffix="yr" />
            <InputField label="Vacancy Rate" value={inputs.vacancyPct} onChange={(v) => set("vacancyPct", v)} suffix="%" />
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "" : "-rotate-90"}`} />
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
              <InputField label="Closing Costs" value={inputs.closingCostPct} onChange={(v) => set("closingCostPct", v)} suffix="%" />
              <InputField label="Property Tax" value={inputs.propertyTaxPct} onChange={(v) => set("propertyTaxPct", v)} suffix="%" />
              <InputField label="Insurance/yr" value={inputs.insuranceAnnual} onChange={(v) => set("insuranceAnnual", v)} prefix="$" />
              <InputField label="Maintenance" value={inputs.maintenancePct} onChange={(v) => set("maintenancePct", v)} suffix="%" />
              <InputField label="Mgmt Fee" value={inputs.mgmtFeePct} onChange={(v) => set("mgmtFeePct", v)} suffix="%" />
              <InputField label="Appreciation" value={inputs.appreciationPct} onChange={(v) => set("appreciationPct", v)} suffix="%" />
              <InputField label="Rent Growth" value={inputs.rentGrowthPct} onChange={(v) => set("rentGrowthPct", v)} suffix="%" />
            </div>
          )}
        </div>

        {/* Key metrics */}
        <div className="space-y-4">
          {/* Cap rate + grade */}
          <div className="vela-card p-5 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Cap Rate</p>
            <div className="flex items-center justify-center gap-3">
              <span className={`text-4xl font-bold ${capGrade.color}`}>{capGrade.letter}</span>
              <span className="text-2xl font-bold text-zinc-100 tabular-nums">{analysis.capRate.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">NOI / Purchase Price</p>
          </div>

          {/* Cash flow */}
          <div className="vela-card p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Monthly Cash Flow</p>
            <p className={`text-2xl font-bold tabular-nums ${analysis.cashFlowMonthly >= 0 ? "text-gain" : "text-loss"}`}>
              {analysis.cashFlowMonthly >= 0 ? "+" : ""}{formatCurrency(analysis.cashFlowMonthly)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {formatCurrency(analysis.effectiveRent)} rent − {formatCurrency(analysis.totalExpensesMonthly)} expenses
            </p>
          </div>

          {/* Quick stats */}
          <div className="vela-card p-5 space-y-3">
            <MetricRow label="Cash-on-Cash Return" value={`${analysis.cashOnCash.toFixed(1)}%`} good={analysis.cashOnCash > 0} />
            <MetricRow label="GRM" value={analysis.grm.toFixed(1)} good={analysis.grm < 15} />
            <MetricRow label="1% Rule" value={analysis.onePercentRule ? "Pass" : "Fail"} good={analysis.onePercentRule} />
            <MetricRow label="Total Cash Needed" value={formatCurrency(analysis.totalCashIn)} />
            <MetricRow label="Mortgage Payment" value={formatCurrency(analysis.mortgageMonthly)} />
          </div>
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="vela-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Monthly Expense Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.expenses} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} width={70} />
                <Tooltip cursor={false}
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                  labelStyle={{ color: "#e4e4e7" }}
                  formatter={(v: number) => [formatCurrency(v), "Monthly"]}
                />
                <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses donut-style summary */}
        <div className="vela-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Monthly P&L</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Effective Rent</span>
              <span className="text-sm font-medium text-gain tabular-nums">{formatCurrency(analysis.effectiveRent)}</span>
            </div>
            {analysis.expenses.map((e) => (
              <div key={e.name} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{e.name}</span>
                <span className="text-sm font-medium text-loss tabular-nums">−{formatCurrency(e.value)}</span>
              </div>
            ))}
            <div className="border-t border-zinc-700 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-200">Net Cash Flow</span>
              <span className={`text-lg font-bold tabular-nums ${analysis.cashFlowMonthly >= 0 ? "text-gain" : "text-loss"}`}>
                {analysis.cashFlowMonthly >= 0 ? "+" : ""}{formatCurrency(analysis.cashFlowMonthly)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 10-year projection */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">10-Year Wealth Projection</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analysis.projection} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(y: number) => `Y${y}`} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "0.5rem" }}
                labelStyle={{ color: "#e4e4e7" }}
                formatter={(v: number) => [formatCurrency(v)]}
                labelFormatter={(y: number) => `Year ${y}`}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
              <Area type="monotone" dataKey="equity" name="Equity" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="totalReturn" name="Total Return" stroke="#34d399" fill="#34d399" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="cashFlow" name="Cum. Cash Flow" stroke="#facc15" fill="#facc15" fillOpacity={0.05} strokeWidth={1.5} />
              <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Y5 Equity", value: analysis.projection[4]?.equity },
            { label: "Y10 Equity", value: analysis.projection[9]?.equity },
            { label: "Y5 Total Return", value: analysis.projection[4]?.totalReturn },
            { label: "Y10 Total Return", value: analysis.projection[9]?.totalReturn },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-xs text-zinc-500">{m.label}</p>
              <p className={`text-sm font-bold tabular-nums ${(m.value ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {formatCurrency(m.value ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Rules of thumb */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Rules of Thumb</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RuleCard
            title="1% Rule"
            pass={analysis.onePercentRule}
            detail={`Rent (${formatCurrency(inputs.monthlyRent)}) ${analysis.onePercentRule ? "≥" : "<"} 1% of price (${formatCurrency(inputs.purchasePrice * 0.01)})`}
            explanation="Monthly rent should be at least 1% of the purchase price for good cash flow."
          />
          <RuleCard
            title="Cap Rate"
            pass={analysis.capRate >= 5}
            detail={`${analysis.capRate.toFixed(1)}% ${analysis.capRate >= 5 ? "≥" : "<"} 5% threshold`}
            explanation="Cap rate above 5% is generally considered a good investment. Below 4% is typical of overpriced or appreciation-only markets."
          />
          <RuleCard
            title="Cash-on-Cash"
            pass={analysis.cashOnCash >= 8}
            detail={`${analysis.cashOnCash.toFixed(1)}% ${analysis.cashOnCash >= 8 ? "≥" : "<"} 8% target`}
            explanation="Cash-on-cash return measures annual cash flow vs. total cash invested. 8%+ is a strong return."
          />
        </div>
      </div>

      {/* Glossary */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Key Terms</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <GlossaryItem term="Cap Rate" def="Net Operating Income / Purchase Price. Measures property yield before financing." />
          <GlossaryItem term="Cash-on-Cash" def="Annual cash flow / total cash invested. Measures return on your actual dollars in." />
          <GlossaryItem term="NOI" def="Net Operating Income = Rent − Operating Expenses (excludes mortgage)." />
          <GlossaryItem term="GRM" def="Gross Rent Multiplier = Price / Annual Rent. Lower is better (under 15 is good)." />
          <GlossaryItem term="1% Rule" def="Monthly rent ≥ 1% of purchase price. Quick filter for cash flow potential." />
          <GlossaryItem term="Vacancy Rate" def="% of time the unit sits empty. 5% is typical; higher in seasonal markets." />
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, prefix, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{prefix}</span>}
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal ${prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-8" : "px-3"}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}

function MetricRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${good === true ? "text-gain" : good === false ? "text-loss" : "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}

function RuleCard({ title, pass, detail, explanation }: { title: string; pass: boolean; detail: string; explanation: string }) {
  return (
    <div className={`rounded-lg border p-4 ${pass ? "border-gain/30 bg-gain/5" : "border-loss/30 bg-loss/5"}`}>
      <div className="flex items-center gap-2 mb-1">
        {pass ? <ArrowUpRight className="w-4 h-4 text-gain" /> : <ArrowDownRight className="w-4 h-4 text-loss" />}
        <span className={`text-sm font-semibold ${pass ? "text-gain" : "text-loss"}`}>{title}: {pass ? "Pass" : "Fail"}</span>
      </div>
      <p className="text-xs text-zinc-300 tabular-nums">{detail}</p>
      <p className="text-xs text-zinc-500 mt-1">{explanation}</p>
    </div>
  );
}

function GlossaryItem({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <span className="font-medium text-zinc-300">{term}</span>
      <span className="text-zinc-500"> — {def}</span>
    </div>
  );
}

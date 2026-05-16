"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingDown, CreditCard, Plus, Zap, Layers, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useNetWorthAssets, categoryLabel, type NetWorthAsset } from "@/hooks/useNetWorth";
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";

// ── Payoff math ─────────────────────────────────────────────────────────────

interface Debt {
  id: string;
  name: string;
  balance: number;
  rate: number;   // annual %
  minPayment: number;
}

interface PayoffStep {
  month: number;
  date: string;
  remaining: number;     // total remaining
  interestPaid: number;  // cumulative
}

function simulatePayoff(
  debts: Debt[],
  extraMonthly: number,
  order: "avalanche" | "snowball",
): { steps: PayoffStep[]; totalInterest: number; months: number } {
  if (debts.length === 0) return { steps: [], totalInterest: 0, months: 0 };

  const sorted = [...debts].sort((a, b) =>
    order === "avalanche" ? b.rate - a.rate : a.balance - b.balance,
  );

  const balances = sorted.map((d) => d.balance);
  const rates = sorted.map((d) => d.rate / 100 / 12);
  const mins = sorted.map((d) => d.minPayment);

  const steps: PayoffStep[] = [];
  let cumInterest = 0;
  const now = new Date();

  for (let month = 0; month <= 600; month++) {
    const totalRemaining = balances.reduce((s, b) => s + Math.max(0, b), 0);
    const date = new Date(now.getFullYear(), now.getMonth() + month, 1);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    steps.push({ month, date: dateStr, remaining: totalRemaining, interestPaid: cumInterest });

    if (totalRemaining < 0.01) break;

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] > 0) {
        const interest = balances[i] * rates[i];
        balances[i] += interest;
        cumInterest += interest;
      }
    }

    // Pay minimums first — freed minimums from paid-off debts roll into budget
    let budget = extraMonthly;
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] > 0) {
        const payment = Math.min(mins[i], balances[i]);
        balances[i] -= payment;
        if (balances[i] < 0.01) {
          balances[i] = 0;
          budget += mins[i] - payment; // overpayment + freed minimum
        }
      }
    }

    // Throw extra + freed minimums at the priority debt (cascade if it pays off)
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] > 0 && budget > 0) {
        const payment = Math.min(budget, balances[i]);
        balances[i] -= payment;
        budget -= payment;
        if (balances[i] < 0.01) {
          balances[i] = 0;
          budget += mins[i]; // this debt's minimum is now freed too
        } else {
          break; // only continue cascading if debt was fully paid off
        }
      }
    }
  }

  return { steps, totalInterest: cumInterest, months: steps.length - 1 };
}

// ── Pros & Cons ─────────────────────────────────────────────────────────────

const STRATEGY_INFO = {
  avalanche: {
    pros: [
      "Minimizes total interest paid",
      "Eliminates highest-cost debt first",
      "Fastest to $0 when rates vary significantly",
    ],
    cons: [
      "First payoff can take a while if the highest-rate balance is large",
      "No quick wins early — all math, no momentum",
      "Progress on individual debts is slow until one clears",
    ],
  },
  snowball: {
    pros: [
      "Smallest balances clear first — reduces number of accounts fast",
      "Psychological momentum from early wins",
      "Simpler to track as accounts drop off",
    ],
    cons: [
      "More total interest paid vs avalanche",
      "Longer overall payoff timeline",
      "High-rate debt accrues in the background",
    ],
  },
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function DebtPayoffPage() {
  const { assets, isLoading } = useNetWorthAssets();
  const [extraPayment, setExtraPayment] = useState("200");
  const [selectedStrategy, setSelectedStrategy] = useState<"avalanche" | "snowball">("avalanche");

  const liabilities = useMemo(
    () => assets.filter((a) => a.is_liability && a.value > 0),
    [assets],
  );

  const debts: Debt[] = useMemo(
    () =>
      liabilities.map((l) => ({
        id: l.id,
        name: l.name,
        balance: Number(l.value),
        rate: Number(l.interest_rate ?? 0),
        minPayment: Number(l.minimum_payment ?? 50),
      })),
    [liabilities],
  );

  const extra = Number(extraPayment) || 0;
  const totalMinPayments = debts.reduce((s, d) => s + d.minPayment, 0);
  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);

  const avalanche = useMemo(() => simulatePayoff(debts, extra, "avalanche"), [debts, extra]);
  const snowball = useMemo(() => simulatePayoff(debts, extra, "snowball"), [debts, extra]);

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;
  const monthsDiff = snowball.months - avalanche.months;
  const strategiesDiffer = Math.abs(avalanche.totalInterest - snowball.totalInterest) > 0.01;

  const chartData = useMemo(() => {
    const maxLen = Math.max(avalanche.steps.length, snowball.steps.length);
    const data: { date: string; avalanche: number; snowball?: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const point: { date: string; avalanche: number; snowball?: number } = {
        date: (avalanche.steps[i] ?? snowball.steps[i])?.date ?? "",
        avalanche: avalanche.steps[i]?.remaining ?? 0,
      };
      if (strategiesDiffer) {
        point.snowball = snowball.steps[i]?.remaining ?? 0;
      }
      data.push(point);
    }
    return data;
  }, [avalanche, snowball, strategiesDiffer]);

  // Payoff order for selected strategy
  const payoffOrder = useMemo(() => {
    const sorted = [...debts].sort((a, b) =>
      selectedStrategy === "avalanche" ? b.rate - a.rate : a.balance - b.balance,
    );
    return sorted;
  }, [debts, selectedStrategy]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <PageTransition className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-vela-teal" />
            Debt Payoff
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Compare snowball vs avalanche payoff strategies
          </p>
        </div>
        <div className="vela-card text-center py-16">
          <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-200 mb-1">No debts tracked</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Add liabilities in Net Worth to see payoff projections
          </p>
          <Link href="/net-worth" className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add a liability
          </Link>
        </div>
      </PageTransition>
    );
  }

  const selected = selectedStrategy === "avalanche" ? avalanche : snowball;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-vela-teal" />
          Debt Payoff
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Compare snowball vs avalanche payoff strategies
        </p>
      </div>

      {/* Debts overview + extra payment slider */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 vela-card">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Your Debts</h2>
          <div className="space-y-2">
            {debts.map((d) => {
              const orig = liabilities.find((l) => l.id === d.id);
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-vela-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{d.name}</p>
                    <p className="text-xs text-zinc-500">
                      {orig ? categoryLabel(orig.category) : ""} · {d.rate}% APR · {formatCurrency(d.minPayment)}/mo min
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular text-loss">{formatCurrency(d.balance)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-vela-border flex justify-between text-sm">
            <span className="text-zinc-400">Total debt</span>
            <AnimatedNumber value={totalBalance} format={(n) => formatCurrency(n)} className="font-bold tabular text-loss" />
          </div>
        </div>

        <div className="vela-card">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Extra Monthly Payment</h2>
          <p className="text-xs text-zinc-500 mb-2">
            On top of {formatCurrency(totalMinPayments)}/mo in minimums
          </p>
          <input
            type="number"
            min="0"
            step="50"
            value={extraPayment}
            onChange={(e) => setExtraPayment(e.target.value)}
            className="input-field w-full tabular text-lg font-bold mb-3"
          />
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={extra}
            onChange={(e) => setExtraPayment(e.target.value)}
            className="w-full accent-vela-teal"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>$0</span>
            <span>$2,000</span>
          </div>
        </div>
      </div>

      {/* Strategy selection — clickable cards */}
      <div>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Choose Your Strategy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StrategyCard
            strategy="avalanche"
            title="Avalanche"
            subtitle="Highest interest rate first"
            icon={<Zap className="w-4 h-4" />}
            months={avalanche.months}
            totalInterest={avalanche.totalInterest}
            recommended={avalanche.totalInterest <= snowball.totalInterest}
            selected={selectedStrategy === "avalanche"}
            onSelect={() => setSelectedStrategy("avalanche")}
          />
          <StrategyCard
            strategy="snowball"
            title="Snowball"
            subtitle="Smallest balance first"
            icon={<Layers className="w-4 h-4" />}
            months={snowball.months}
            totalInterest={snowball.totalInterest}
            recommended={snowball.totalInterest < avalanche.totalInterest}
            selected={selectedStrategy === "snowball"}
            onSelect={() => setSelectedStrategy("snowball")}
          />
        </div>
      </div>

      {/* Savings callout */}
      {Math.abs(interestSaved) > 1 && (
        <div className="vela-card flex items-center gap-3 text-sm">
          <Zap className="w-5 h-5 text-vela-teal shrink-0" />
          <span className="text-zinc-300">
            Avalanche saves you <span className="font-bold text-gain">{formatCurrency(Math.abs(interestSaved))}</span> in interest
            {monthsDiff !== 0 && (
              <> and pays off <span className="font-bold text-vela-teal">{Math.abs(monthsDiff)} month{Math.abs(monthsDiff) > 1 ? "s" : ""}</span> sooner</>
            )}
          </span>
        </div>
      )}

      {/* Payoff order */}
      {debts.length > 1 && (
        <div className="vela-card">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">
            {selectedStrategy === "avalanche" ? "Avalanche" : "Snowball"} Payoff Order
          </h2>
          <div className="space-y-2">
            {payoffOrder.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-vela-border last:border-0">
                <span className="w-6 h-6 rounded-full bg-vela-teal/15 text-vela-teal text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{d.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatCurrency(d.balance)} · {d.rate}% APR
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  {selectedStrategy === "avalanche" ? "highest rate" : "smallest balance"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Remaining Balance</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradAvalanche" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSnowball" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
                formatter={(v: number, name: string) => [
                  formatCurrency(v),
                  strategiesDiffer ? (name === "avalanche" ? "Avalanche" : "Snowball") : "Balance",
                ]}
                labelStyle={{ color: "#a1a1aa" }}
              />
              {strategiesDiffer && (
                <Legend
                  wrapperStyle={{ fontSize: "0.75rem", color: "#a1a1aa" }}
                  formatter={(val: string) => val === "avalanche" ? "Avalanche" : "Snowball"}
                />
              )}
              <Area
                type="monotone"
                dataKey="avalanche"
                name={strategiesDiffer ? "avalanche" : "Balance"}
                stroke="#14b8a6"
                fill="url(#gradAvalanche)"
                strokeWidth={2}
              />
              {strategiesDiffer && (
                <Area
                  type="monotone"
                  dataKey="snowball"
                  stroke="#f43f5e"
                  fill="url(#gradSnowball)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-zinc-600 text-center">
        Estimates assume fixed rates and minimum payments. Not financial advice.
      </p>
    </PageTransition>
  );
}


// ── Strategy Card ───────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  title,
  subtitle,
  icon,
  months,
  totalInterest,
  recommended,
  selected,
  onSelect,
}: {
  strategy: "avalanche" | "snowball";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  months: number;
  totalInterest: number;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const timeStr = years > 0
    ? `${years}y ${remainingMonths}mo`
    : `${remainingMonths}mo`;

  const info = STRATEGY_INFO[strategy];

  function handleClick() {
    onSelect();
    if (!selected) {
      setExpanded(true);
    } else {
      setExpanded(!expanded);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`vela-card relative cursor-pointer transition-all duration-200 ${
        selected
          ? "border-vela-teal ring-1 ring-vela-teal/30"
          : "hover:border-zinc-600"
      }`}
    >
      {/* Selection indicator + recommended badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {recommended && (
          <span className="text-[10px] font-medium bg-vela-teal/15 text-vela-teal px-2 py-0.5 rounded-full">
            Recommended
          </span>
        )}
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? "border-vela-teal bg-vela-teal" : "border-zinc-600"
        }`}>
          {selected && <Check className="w-3 h-3 text-zinc-950" strokeWidth={3} />}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          selected ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-400"
        }`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{title}</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-zinc-500">Debt-free in</p>
          <p className="text-lg font-bold tabular text-zinc-100">{timeStr}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Total interest</p>
          <AnimatedNumber value={totalInterest} format={(n) => formatCurrency(n)} className="text-lg font-bold tabular text-loss" />
        </div>
      </div>

      {/* Expandable pros & cons */}
      {selected && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1 text-xs text-vela-teal mt-3 hover:text-vela-teal-dim transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} pros & cons
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-vela-border grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs font-medium text-gain mb-1.5">Pros</p>
                <ul className="space-y-1">
                  {info.pros.map((p, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex gap-2">
                      <span className="text-gain mt-0.5 shrink-0">+</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-loss mb-1.5">Cons</p>
                <ul className="space-y-1">
                  {info.cons.map((c, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex gap-2">
                      <span className="text-loss mt-0.5 shrink-0">-</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

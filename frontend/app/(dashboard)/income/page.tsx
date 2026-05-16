"use client";

import { useMemo } from "react";
import { DollarSign, Briefcase, TrendingUp, PieChart, Coins, Building2, Laptop, Gift } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart as RPieChart, Pie,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary } from "@/hooks/useDividends";
import { useCashFlowSummary, type CashFlowEntry } from "@/hooks/useCashFlow";
import { formatCompact, formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";

// ── Helpers ──────────────────────────────────────────────────────────────────

const STREAM_COLORS: Record<string, string> = {
  salary: "#14b8a6",       // teal
  freelance: "#22d3ee",    // cyan
  rental: "#a78bfa",       // purple
  dividends: "#34d399",    // emerald
  other_income: "#fbbf24", // amber
  business: "#f472b6",     // pink
};

const STREAM_ICONS: Record<string, typeof Briefcase> = {
  salary: Briefcase,
  freelance: Laptop,
  rental: Building2,
  dividends: Coins,
  other_income: Gift,
  business: TrendingUp,
};

const STREAM_LABELS: Record<string, string> = {
  salary: "Salary",
  freelance: "Freelance",
  rental: "Rental Income",
  dividends: "Dividends",
  other_income: "Other Income",
  business: "Business",
};

interface IncomeStream {
  key: string;
  label: string;
  monthly: number;
  annual: number;
  color: string;
  icon: typeof Briefcase;
  items: { name: string; amount: number }[];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = !!summary?.holdings?.length;
  const { dividends } = useDividendSummary(hasHoldings ? portfolioId : null);
  const { summary: cfSummary } = useCashFlowSummary();

  const streams = useMemo(() => {
    const map = new Map<string, IncomeStream>();

    // Cash flow income entries
    if (cfSummary?.entries) {
      const incomeEntries = cfSummary.entries.filter(
        (e: CashFlowEntry) => e.entry_type === "income" && e.is_active
      );
      for (const entry of incomeEntries) {
        const cat = entry.category || "other_income";
        if (!map.has(cat)) {
          map.set(cat, {
            key: cat,
            label: STREAM_LABELS[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            monthly: 0,
            annual: 0,
            color: STREAM_COLORS[cat] || "#71717a",
            icon: STREAM_ICONS[cat] || Gift,
            items: [],
          });
        }
        const stream = map.get(cat)!;
        stream.monthly += entry.amount;
        stream.annual += entry.amount * 12;
        stream.items.push({ name: entry.name, amount: entry.amount });
      }
    }

    // Dividend income (merged as one stream)
    if (dividends && dividends.total_annual_income > 0) {
      const monthlyDiv = dividends.total_annual_income / 12;
      map.set("dividends", {
        key: "dividends",
        label: "Dividends",
        monthly: monthlyDiv,
        annual: dividends.total_annual_income,
        color: STREAM_COLORS.dividends,
        icon: Coins,
        items: dividends.holdings
          .filter((h) => h.annual_income > 0)
          .sort((a, b) => b.annual_income - a.annual_income)
          .map((h) => ({ name: h.ticker, amount: h.annual_income / 12 })),
      });
    }

    return Array.from(map.values()).sort((a, b) => b.annual - a.annual);
  }, [cfSummary, dividends]);

  const totalMonthly = streams.reduce((s, st) => s + st.monthly, 0);
  const totalAnnual = streams.reduce((s, st) => s + st.annual, 0);

  const pieData = streams.map((s) => ({
    name: s.label,
    value: s.annual,
    color: s.color,
  }));

  const barData = streams.map((s) => ({
    name: s.label,
    monthly: Math.round(s.monthly),
    color: s.color,
  }));

  const isEmpty = streams.length === 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-vela-teal" />
          Income Streams
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          A unified view of all your income sources, from salary to dividends.
        </p>
      </div>

      {isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <DollarSign className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No income sources found</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add income entries in Cash Flow or portfolio holdings with dividends to see your streams.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-emerald-400">{formatCurrency(totalMonthly)}</p>
              <p className="text-xs text-zinc-500 mt-1">Monthly Income</p>
            </div>
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-zinc-100">{formatCompact(totalAnnual)}</p>
              <p className="text-xs text-zinc-500 mt-1">Annual Income</p>
            </div>
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-vela-teal">{streams.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Income Streams</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Monthly Breakdown</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      type="number"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip cursor={false}
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(val: number) => [formatCurrency(val), "Monthly"]}
                    />
                    <Bar dataKey="monthly" radius={[0, 4, 4, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie chart */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Income Mix</h2>
              <div className="h-56 flex items-center justify-center">
                {pieData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <RPieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(val: number) => [formatCompact(val), "Annual"]}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-zinc-400">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stream cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Stream Details</h2>
            {streams.map((stream) => {
              const Icon = stream.icon;
              const pct = totalAnnual > 0 ? (stream.annual / totalAnnual) * 100 : 0;
              return (
                <div key={stream.key} className="vela-card">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-zinc-800" style={{ color: stream.color }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-zinc-100">{stream.label}</h3>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular text-zinc-100">
                            {formatCurrency(stream.monthly)}<span className="text-zinc-500 text-xs">/mo</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 tabular">{formatCompact(stream.annual)}/yr</p>
                        </div>
                      </div>

                      {/* Percentage bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: stream.color }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>

                      {/* Sub-items */}
                      {stream.items.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
                          {stream.items.slice(0, 6).map((item) => (
                            <span key={item.name} className="text-[10px] text-zinc-500">
                              {item.name}: <span className="text-zinc-400 tabular">{formatCurrency(item.amount)}/mo</span>
                            </span>
                          ))}
                          {stream.items.length > 6 && (
                            <span className="text-[10px] text-zinc-600">+{stream.items.length - 6} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diversification insight */}
          {streams.length > 0 && (
            <div className="vela-card border-vela-teal/20 px-4 py-3">
              <p className="text-xs text-zinc-400">
                {streams.length === 1
                  ? "All your income comes from one source. Diversifying income streams can reduce financial risk."
                  : streams.length <= 2
                    ? `You have ${streams.length} income streams. Adding more sources can improve financial resilience.`
                    : `You have ${streams.length} income streams across different categories. Good diversification helps protect against income disruptions.`
                }
                {dividends && dividends.total_annual_income > 0 && totalAnnual > 0 && (
                  <>{" "}Dividend income makes up {((dividends.total_annual_income / totalAnnual) * 100).toFixed(0)}% of your total income.</>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Income figures are based on your Cash Flow entries and current dividend rates. Actual income may vary.
        </p>
      </div>
    </PageTransition>
  );
}

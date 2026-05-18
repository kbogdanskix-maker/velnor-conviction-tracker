"use client";

import { useState, useMemo } from "react";
import {
  Receipt, TrendingDown, DollarSign, Info, AlertTriangle,
  CheckCircle, Minus, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import {
  analyzeFees, lookupExpenseRatio, KNOWN_EXPENSE_RATIOS,
} from "@/lib/fee-analyzer";
import type { FeeHolding, HoldingFeeDetail } from "@/lib/fee-analyzer";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  if (isNaN(v)) return "$0";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function fmtER(v: number): string {
  if (isNaN(v)) return "0.00%";
  return `${(v * 100).toFixed(2)}%`;
}

const TIER_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10",
  moderate: "text-teal-400 bg-teal-500/10",
  high: "text-amber-400 bg-amber-500/10",
  "very-high": "text-rose-400 bg-rose-500/10",
};

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-teal-400",
  C: "text-amber-400",
  D: "text-orange-400",
  F: "text-rose-400",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const { summary } = useDefaultPortfolio();
  const holdings = summary?.holdings ?? [];

  // Editable expense ratios — start from known or 0
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const feeHoldings: FeeHolding[] = useMemo(() => {
    return holdings.map((h) => {
      const known = lookupExpenseRatio(h.ticker);
      const er = overrides[h.ticker] ?? known ?? 0;
      return {
        ticker: h.ticker,
        marketValue: h.market_value ?? h.total_cost ?? 0,
        expenseRatio: er,
        isETF: known !== null,
      };
    });
  }, [holdings, overrides]);

  const result = useMemo(() => analyzeFees(feeHoldings), [feeHoldings]);

  const unknownCount = feeHoldings.filter(
    (h) => lookupExpenseRatio(h.ticker) === null && !overrides[h.ticker]
  ).length;

  if (holdings.length === 0) {
    return (
      <PageTransition className="space-y-6">
        <Header />
        <div className="vela-card text-center py-16 space-y-3">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-medium">No holdings to analyze</p>
          <p className="text-zinc-500 text-sm">Add positions to your portfolio first.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {/* Unknown tickers notice */}
      {unknownCount > 0 && (
        <div className="vela-card border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              {unknownCount} holding{unknownCount > 1 ? "s" : ""} ha{unknownCount > 1 ? "ve" : "s"} no
              known expense ratio. Individual stocks typically have no expense ratio (0%).
              ETFs and mutual funds do — edit below to add them.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="vela-card text-center py-4">
          <p className={`text-3xl font-bold ${GRADE_COLORS[result.feeGrade]}`}>
            {result.feeGrade}
          </p>
          <p className={`text-xs font-medium mt-0.5 ${GRADE_COLORS[result.feeGrade]}`}>
            {result.feeGradeLabel}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Fee Grade</p>
        </div>
        <div className="vela-card text-center py-4">
          <p className="text-2xl font-bold tabular text-zinc-100">
            {fmtER(result.weightedExpenseRatio)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Blended Expense Ratio</p>
        </div>
        <div className="vela-card text-center py-4">
          <p className="text-2xl font-bold tabular text-rose-400">
            {fmtCurrency(result.totalAnnualFees)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Annual Fees</p>
        </div>
        <div className="vela-card text-center py-4">
          <p className="text-2xl font-bold tabular text-rose-400">
            {fmtCurrency(result.thirtyYearFeeDrag)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">30-Year Fee Drag</p>
        </div>
      </div>

      {/* Fee Drag Projection Chart */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-1">
          Fee Impact Over Time
        </h2>
        <p className="text-[10px] text-zinc-500 mb-4">
          Assuming 8% annual returns — your fees ({fmtER(result.weightedExpenseRatio)})
          vs low-cost index ({fmtER(result.lowCostER)})
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={result.projection.filter((_, i) => i % 2 === 0 || i === 30)}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="year"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}yr`}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                  return `$${v}`;
                }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number, name: string) => [
                  `$${val.toLocaleString()}`,
                  name === "withLowFees" ? "Low-Cost Index" : "Your Fees",
                ]}
                labelFormatter={(v) => `Year ${v}`}
              />
              <Area
                type="monotone"
                dataKey="withLowFees"
                stroke="rgb(52, 211, 153)"
                fill="rgba(52, 211, 153, 0.08)"
                strokeWidth={2}
                name="withLowFees"
              />
              <Area
                type="monotone"
                dataKey="withCurrentFees"
                stroke="rgb(251, 113, 133)"
                fill="rgba(251, 113, 133, 0.08)"
                strokeWidth={2}
                name="withCurrentFees"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-6 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            <span className="text-[10px] text-zinc-400">Low-Cost Index (0.03%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
            <span className="text-[10px] text-zinc-400">Your Fees ({fmtER(result.weightedExpenseRatio)})</span>
          </div>
        </div>

        {/* Savings callout */}
        {result.potentialSavings30yr > 100 && (
          <div className="mt-4 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <p className="text-xs text-emerald-400 font-medium">
              Switching to low-cost index funds could save you{" "}
              <span className="tabular">{fmtCurrency(result.potentialSavings10yr)}</span> over 10 years
              and <span className="tabular">{fmtCurrency(result.potentialSavings30yr)}</span> over 30 years.
            </p>
          </div>
        )}
      </div>

      {/* Holdings Fee Table */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">
          Holdings Breakdown
        </h2>
        <div className="space-y-2">
          {result.holdings.map((h) => (
            <HoldingRow
              key={h.ticker}
              holding={h}
              onChangeER={(er) =>
                setOverrides((prev) => ({ ...prev, [h.ticker]: er }))
              }
              hasOverride={h.ticker in overrides}
              knownER={lookupExpenseRatio(h.ticker)}
            />
          ))}
        </div>
      </div>

      {/* Benchmark Reference */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Popular Fund Expense Ratios</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { ticker: "VOO", name: "S&P 500" },
            { ticker: "VTI", name: "Total Market" },
            { ticker: "QQQ", name: "Nasdaq 100" },
            { ticker: "ARKK", name: "ARK Innovation" },
            { ticker: "SPY", name: "SPDR S&P 500" },
            { ticker: "SCHD", name: "Schwab Dividend" },
            { ticker: "IWM", name: "Russell 2000" },
            { ticker: "GLD", name: "Gold" },
          ].map((fund) => {
            const er = KNOWN_EXPENSE_RATIOS[fund.ticker] ?? 0;
            const tier = er <= 0.002 ? "low" : er <= 0.005 ? "moderate" : er <= 0.01 ? "high" : "very-high";
            return (
              <div key={fund.ticker} className="bg-zinc-800/50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{fund.ticker}</span>
                  <span className={`text-[10px] font-medium tabular px-1.5 py-0.5 rounded ${TIER_COLORS[tier]}`}>
                    {fmtER(er)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{fund.name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="vela-card border-zinc-700">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">About Fee Analysis</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Expense ratios are annual fees charged by ETFs and mutual funds, deducted from
              your returns. Even small differences compound dramatically over decades.
              Individual stocks have no expense ratio. The projection assumes 8% annual
              gross returns and compares your blended fee against a 0.03% benchmark.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Expense ratios are approximate and may not reflect current fund prospectus values.
          Actual fee impact depends on contributions, withdrawals, and market returns. Not financial advice.
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
        <Receipt className="w-7 h-7 text-vela-teal" />
        Fee Analyzer
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Understand how investment fees compound to erode your returns over time.
      </p>
    </div>
  );
}

// ── Holding Row ──────────────────────────────────────────────────────────────

function HoldingRow({
  holding,
  onChangeER,
  hasOverride,
  knownER,
}: {
  holding: HoldingFeeDetail;
  onChangeER: (er: number) => void;
  hasOverride: boolean;
  knownER: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(
    (holding.expenseRatio * 100).toFixed(2)
  );

  const handleSave = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onChangeER(parsed / 100);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/50">
      {/* Ticker */}
      <span className="text-sm font-semibold text-zinc-100 w-14">{holding.ticker}</span>

      {/* Value */}
      <span className="text-xs text-zinc-500 tabular w-20 hidden sm:block">
        {fmtCurrency(holding.marketValue)}
      </span>

      {/* Expense Ratio (editable) */}
      <div className="flex items-center gap-1.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleSave}
              autoFocus
              className="w-16 bg-zinc-900 border border-vela-teal/40 rounded px-1.5 py-0.5 text-xs text-zinc-100 tabular outline-none"
            />
            <span className="text-[10px] text-zinc-500">%</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setInputVal((holding.expenseRatio * 100).toFixed(2));
              setEditing(true);
            }}
            className={`text-xs tabular font-medium px-1.5 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-vela-teal/30 transition ${
              TIER_COLORS[holding.costTier]
            }`}
          >
            {fmtER(holding.expenseRatio)}
          </button>
        )}
        {knownER !== null && !hasOverride && (
          <CheckCircle className="w-3 h-3 text-emerald-500/50" />
        )}
      </div>

      {/* Annual Fee */}
      <span className="text-xs text-zinc-400 tabular ml-auto">
        {holding.annualFeeDollars > 0.5 ? (
          <span className="text-rose-400">
            -${Math.round(holding.annualFeeDollars).toLocaleString()}/yr
          </span>
        ) : (
          <span className="text-zinc-600">$0/yr</span>
        )}
      </span>

      {/* 10yr drag */}
      <span className="text-[10px] text-zinc-500 tabular w-20 text-right hidden sm:block">
        {holding.tenYearDrag > 1 ? (
          <>
            <TrendingDown className="w-3 h-3 inline mr-0.5 text-rose-400" />
            <span className="text-rose-400">{fmtCurrency(holding.tenYearDrag)}</span>
            <span className="text-zinc-600 ml-0.5">10yr</span>
          </>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </span>
    </div>
  );
}

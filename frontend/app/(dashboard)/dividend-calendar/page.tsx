"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary, type DividendHolding } from "@/hooks/useDividends";
import { formatCompact, formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function DivTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0c1a19",
      border: "1px solid rgba(20,184,166,0.35)",
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 11,
    }}>
      <p style={{ color: "#14b8a6", fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#5eead4" }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Known quarterly payment month offsets (0-indexed months when they typically pay)
// Most US stocks pay quarterly. We estimate pay months from the ex-dividend date.
function estimatePayMonths(holding: DividendHolding): number[] {
  const exDate = holding.ex_dividend_date;

  if (exDate) {
    const [y, m, d] = exDate.split("-").map(Number);
    const month = new Date(y, m - 1, d).getMonth();
    // Assume quarterly: every 3 months from the ex-date month
    return [month, (month + 3) % 12, (month + 6) % 12, (month + 9) % 12];
  }

  // Fallback: spread evenly across Q1-Q4 (Mar, Jun, Sep, Dec)
  return [2, 5, 8, 11];
}

interface MonthlyDividend {
  ticker: string;
  amount: number; // per-share quarterly payment * quantity
}

interface MonthData {
  month: number;
  label: string;
  total: number;
  holdings: MonthlyDividend[];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DividendCalendarPage() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = !!summary?.holdings?.length;
  const { dividends, isLoading, error } = useDividendSummary(hasHoldings ? portfolioId : null);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [year] = useState(() => new Date().getFullYear());
  const currentMonth = new Date().getMonth();

  // Build 12-month calendar from dividend data
  const calendar = useMemo((): MonthData[] => {
    const months: MonthData[] = MONTHS.map((label, i) => ({
      month: i,
      label,
      total: 0,
      holdings: [],
    }));

    if (!dividends?.holdings) return months;

    const payers = dividends.holdings.filter(
      (h) => h.dividend_rate && h.dividend_rate > 0 && h.annual_income > 0
    );

    for (const holding of payers) {
      const payMonths = estimatePayMonths(holding);
      const quarterlyPayment = holding.annual_income / payMonths.length;

      for (const m of payMonths) {
        months[m].total += quarterlyPayment;
        months[m].holdings.push({
          ticker: holding.ticker,
          amount: quarterlyPayment,
        });
      }
    }

    // Sort each month's holdings by amount desc
    for (const m of months) {
      m.holdings.sort((a, b) => b.amount - a.amount);
    }

    return months;
  }, [dividends]);

  const totalAnnual = dividends?.total_annual_income ?? 0;
  const monthlyAvg = totalAnnual / 12;
  const maxMonth = Math.max(...calendar.map((m) => m.total), 1);
  const payingMonths = calendar.filter((m) => m.total > 0).length;

  const selectedData = selectedMonth != null ? calendar[selectedMonth] : null;

  const isEmpty = !isLoading && (!dividends || totalAnnual === 0);

  if (isLoading || (!dividends && hasHoldings)) {
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

  if (error) return <ErrorState message="Failed to load dividend calendar data." onRetry={() => window.location.reload()} />;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      <Header />

      {isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No dividend income to display</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add dividend-paying stocks to your portfolio to see your income calendar.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-emerald-400">{formatCompact(totalAnnual)}</p>
              <p className="text-xs text-zinc-500 mt-1">Annual Income</p>
            </div>
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-zinc-100">{formatCompact(monthlyAvg)}</p>
              <p className="text-xs text-zinc-500 mt-1">Monthly Avg</p>
            </div>
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-vela-teal">
                {dividends?.holdings.filter((h) => h.annual_income > 0).length ?? 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Payers</p>
            </div>
            <div className="vela-card text-center py-4">
              <p className="text-3xl font-bold tabular text-zinc-100">{payingMonths}</p>
              <p className="text-xs text-zinc-500 mt-1">Active Months</p>
            </div>
          </div>

          {/* Bar chart  - monthly income */}
          <div className="vela-card">
            <h2 className="text-sm font-medium text-zinc-300 mb-4">
              {year} Monthly Dividend Income
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={calendar}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  onClick={(e) => {
                    if (e?.activeTooltipIndex != null) {
                      setSelectedMonth(
                        selectedMonth === e.activeTooltipIndex ? null : e.activeTooltipIndex
                      );
                    }
                  }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompact(v)}
                    width={55}
                  />
                  <Tooltip cursor={false} content={<DivTooltip />} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} cursor="pointer">
                    {calendar.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          selectedMonth === i
                            ? "#14b8a6"
                            : i === currentMonth
                              ? "#34d399"
                              : d.total > 0
                                ? "#27272a"
                                : "#1a1a1e"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">
              Click a month to see details. Current month is highlighted in emerald.
            </p>
          </div>

          {/* Month detail */}
          {selectedData && (
            <div className="vela-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-300">
                  {MONTHS_FULL[selectedData.month]} {year}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedMonth(Math.max(0, (selectedMonth ?? 0) - 1))}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
                    disabled={selectedMonth === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedMonth(Math.min(11, (selectedMonth ?? 0) + 1))}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
                    disabled={selectedMonth === 11}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {selectedData.holdings.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">
                  No dividend payments expected this month.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500">
                      {selectedData.holdings.length} payer{selectedData.holdings.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold tabular text-emerald-400">
                      {formatCurrency(selectedData.total)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedData.holdings.map((h) => {
                      const pct = selectedData.total > 0 ? (h.amount / selectedData.total) * 100 : 0;
                      return (
                        <div key={h.ticker} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-zinc-300 w-14">{h.ticker}</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 tabular w-16 text-right">
                            {formatCurrency(h.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Calendar grid  - compact 12-month view */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Calendar Overview</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {calendar.map((m, i) => {
                const barH = maxMonth > 0 ? (m.total / maxMonth) * 100 : 0;
                const isCurrent = i === currentMonth;
                const isSelected = i === selectedMonth;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedMonth(isSelected ? null : i)}
                    className={`vela-card py-3 px-2 text-center hover:border-zinc-600 transition-colors ${
                      isSelected ? "border-vela-teal/40" : isCurrent ? "border-emerald-500/20" : ""
                    }`}
                  >
                    <p className={`text-xs font-medium ${isCurrent ? "text-emerald-400" : "text-zinc-400"}`}>
                      {m.label}
                    </p>
                    {/* Mini bar */}
                    <div className="h-8 flex items-end justify-center mt-1">
                      <div
                        className={`w-4 rounded-t transition-all ${
                          m.total > 0
                            ? isSelected ? "bg-vela-teal" : isCurrent ? "bg-emerald-500/60" : "bg-zinc-700"
                            : "bg-zinc-800/50"
                        }`}
                        style={{ height: `${Math.max(barH, m.total > 0 ? 10 : 2)}%` }}
                      />
                    </div>
                    <p className={`text-[10px] tabular mt-1 ${m.total > 0 ? "text-zinc-300" : "text-zinc-600"}`}>
                      {m.total > 0 ? formatCurrency(m.total) : " -"}
                    </p>
                    {m.holdings.length > 0 && (
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        {m.holdings.length} payer{m.holdings.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Income consistency insight */}
          <div className={`vela-card px-4 py-3 ${
            payingMonths >= 10 ? "border-emerald-500/20" :
            payingMonths >= 6 ? "border-zinc-700" :
            "border-amber-500/20"
          }`}>
            <p className="text-xs text-zinc-400">
              {payingMonths >= 10 ? (
                <>
                  <span className="text-emerald-400 font-medium">Excellent coverage</span>  - you receive dividends in {payingMonths} out of 12 months.
                  This provides consistent passive income throughout the year.
                </>
              ) : payingMonths >= 6 ? (
                <>
                  <span className="text-zinc-300 font-medium">Good coverage</span>  - dividends expected in {payingMonths} months.
                  Adding stocks with different payment schedules could fill the gaps.
                </>
              ) : (
                <>
                  <span className="text-amber-400 font-medium">Sparse coverage</span>  - dividends only in {payingMonths} month{payingMonths !== 1 ? "s" : ""}.
                  Consider diversifying with dividend payers that have staggered schedules for more consistent income.
                </>
              )}
            </p>
          </div>

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Payment months are estimated based on ex-dividend dates and quarterly schedules.
              Actual payment dates and amounts may vary. Not financial advice.
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
        <Calendar className="w-7 h-7 text-vela-teal" />
        Dividend Calendar
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        See when your dividend income arrives throughout the year.
      </p>
    </div>
  );
}

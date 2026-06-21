"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Coins, Calendar, TrendingUp, ArrowUpRight, AlertTriangle, Info,
  ChevronUp, ChevronDown, Download,
} from "lucide-react";
import PageTransition from "@/components/celestial/PageTransition";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary, type DividendHolding } from "@/hooks/useDividends";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { exportCSV } from "@/lib/export";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import ErrorState from "@/components/shared/ErrorState";
import FloatingCard from "@/components/celestial/FloatingCard";

type SortKey = "income" | "yield" | "ticker";

export default function DividendsPage() {
  const { portfolio, loading: portfolioLoading, error: portfolioError } = useDefaultPortfolio();
  const { dividends, isLoading, error: dividendError } = useDividendSummary(portfolio?.id ?? null);
  const [sortBy, setSortBy] = useState<SortKey>("income");
  const [sortAsc, setSortAsc] = useState(false);

  const loading = portfolioLoading || isLoading;

  const sortedHoldings = useMemo(() => {
    if (!dividends?.holdings) return [];
    const list = [...dividends.holdings];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "income") cmp = a.annual_income - b.annual_income;
      else if (sortBy === "yield") cmp = (a.dividend_yield ?? 0) - (b.dividend_yield ?? 0);
      else cmp = a.ticker.localeCompare(b.ticker);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [dividends, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortBy !== k) return null;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (portfolioError || dividendError) return <ErrorState message="Failed to load dividend data." onRetry={() => window.location.reload()} />;

  if (!dividends || dividends.holdings.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="vela-card text-center py-16">
          <Coins className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium">No holdings yet</p>
          <p className="text-xs text-zinc-600 mt-1 mb-4">
            Add holdings to your portfolio to see dividend projections.
          </p>
          <Link href="/portfolio" className="btn-primary text-sm">
            Go to Portfolio
          </Link>
        </div>
      </div>
    );
  }

  const payingHoldings = dividends.holdings.filter((h) => h.annual_income > 0);
  const nonPayingHoldings = dividends.holdings.filter((h) => h.annual_income === 0);
  const monthlyIncome = dividends.total_annual_income / 12;

  // Days until next ex-date
  const nextEx = dividends.next_ex_dates.length > 0 ? dividends.next_ex_dates[0] : null;
  const daysUntilEx = nextEx
    ? Math.ceil((new Date(nextEx.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <PageTransition className="space-y-6">
      <Header holdings={dividends.holdings} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FloatingCard delay={0}>
          <SummaryCard
            label="Annual Income"
            rawValue={dividends.total_annual_income}
            formatFn={(n) => formatCurrency(n)}
            sub={`from ${payingHoldings.length} holding${payingHoldings.length !== 1 ? "s" : ""}`}
            accent
          />
        </FloatingCard>
        <FloatingCard delay={0.08}>
          <SummaryCard
            label="Portfolio Yield"
            rawValue={(dividends.portfolio_yield ?? 0) * 100}
            formatFn={(n) => formatPercent(n, false)}
            sub={`on ${formatCurrency(dividends.total_portfolio_value)} portfolio`}
          />
        </FloatingCard>
        <FloatingCard delay={0.16}>
          <SummaryCard
            label="Monthly Average"
            rawValue={monthlyIncome}
            formatFn={(n) => formatCurrency(n)}
            sub="projected at current rates"
          />
        </FloatingCard>
      </div>

      {/* Upcoming ex-dates */}
      {dividends.next_ex_dates.length > 0 && (
        <RevealOnScroll>
        <div className="vela-card">
          <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            Upcoming ex-dividend dates
          </h2>
          <div className="space-y-1">
            {dividends.next_ex_dates.slice(0, 6).map((ex) => {
              const days = Math.ceil(
                (new Date(ex.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const isPast = days < 0;
              return (
                <div
                  key={ex.ticker}
                  className="flex items-center justify-between py-2 border-b border-vela-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-vela-teal/15 text-vela-teal">
                      {ex.ticker}
                    </span>
                    <span className="text-sm text-zinc-300">{formatDate(ex.date)}</span>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isPast ? "text-zinc-600" : days <= 7 ? "text-amber-400" : "text-zinc-500"
                    }`}
                  >
                    {isPast ? "Passed" : days === 0 ? "Today" : `${days}d away`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        </RevealOnScroll>
      )}

      {/* Holdings table */}
      <RevealOnScroll delay={0.05}>
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-zinc-400" />
          Dividend Breakdown
        </h2>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-vela-border">
                <th
                  className="text-left py-2 font-medium cursor-pointer hover:text-zinc-300"
                  onClick={() => toggleSort("ticker")}
                >
                  Ticker <SortIcon k="ticker" />
                </th>
                <th className="text-right py-2 font-medium">Shares</th>
                <th className="text-right py-2 font-medium">Price</th>
                <th className="text-right py-2 font-medium">Div/Share</th>
                <th
                  className="text-right py-2 font-medium cursor-pointer hover:text-zinc-300"
                  onClick={() => toggleSort("yield")}
                >
                  Yield <SortIcon k="yield" />
                </th>
                <th
                  className="text-right py-2 font-medium cursor-pointer hover:text-zinc-300"
                  onClick={() => toggleSort("income")}
                >
                  Annual Income <SortIcon k="income" />
                </th>
                <th className="text-right py-2 font-medium">Ex-Date</th>
                <th className="text-right py-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => (
                <HoldingRow key={h.ticker} holding={h} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2">
          {sortedHoldings.map((h) => (
            <MobileHoldingCard key={h.ticker} holding={h} />
          ))}
        </div>
      </div>
      </RevealOnScroll>

      {/* Income projection */}
      {dividends.total_annual_income > 0 && (
        <RevealOnScroll delay={0.1}>
        <div className="vela-card bg-zinc-900/50">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-vela-teal mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-300">Income projection</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                At current dividend rates, your portfolio generates{" "}
                <span className="text-gain font-medium">{formatCurrency(dividends.total_annual_income)}/yr</span>{" "}
                or roughly <span className="text-gain font-medium">{formatCurrency(monthlyIncome)}/mo</span>.
                {dividends.portfolio_yield > 0 && (
                  <> That&apos;s a {formatPercent(dividends.portfolio_yield * 100, false)} yield on your {formatCurrency(dividends.total_portfolio_value)} portfolio.</>
                )}
              </p>
              {nonPayingHoldings.length > 0 && (
                <p className="text-xs text-zinc-600 mt-1">
                  {nonPayingHoldings.length} holding{nonPayingHoldings.length !== 1 ? "s don\u2019t" : " doesn\u2019t"} pay dividends ({nonPayingHoldings.map(h => h.ticker).join(", ")}).
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 mt-3 pt-3 border-t border-vela-border text-[10px] text-zinc-600">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              Projections based on current dividend rates. Companies may change or suspend dividends at any time. Not financial advice.
            </span>
          </div>
        </div>
        </RevealOnScroll>
      )}
    </PageTransition>
  );
}


// ── Header ───────────────────────────────────────────────────────────────

function Header({ holdings }: { holdings?: DividendHolding[] }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <Coins className="w-6 h-6 text-vela-teal" />
          Dividends
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Projected income from your holdings  - yields, ex-dates, and payout ratios
        </p>
      </div>
      {holdings && holdings.length > 0 && (
        <button
          onClick={() =>
            exportCSV(
              holdings.map((h) => ({
                Ticker: h.ticker,
                Shares: h.quantity,
                Price: h.current_price,
                "Div/Share": h.dividend_rate ?? "",
                "Yield %": h.dividend_yield != null ? (h.dividend_yield * 100).toFixed(2) : "",
                "Annual Income": h.annual_income,
                "Ex-Date": h.ex_dividend_date ?? "",
                "Payout Ratio": h.payout_ratio != null ? (h.payout_ratio * 100).toFixed(0) + "%" : "",
              })),
              `velnor-dividends-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      )}
    </div>
  );
}


// ── Summary Card ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  rawValue,
  formatFn,
  sub,
  accent,
}: {
  label: string;
  rawValue: number;
  formatFn: (n: number) => string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="vela-card">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <AnimatedNumber
        value={rawValue}
        format={formatFn}
        className={`text-xl font-bold tabular ${accent ? "text-gain" : "text-zinc-100"}`}
      />
      <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}


// ── Holding Row (Desktop) ────────────────────────────────────────────────

function HoldingRow({ holding: h }: { holding: DividendHolding }) {
  const yieldPct = h.dividend_yield != null ? h.dividend_yield * 100 : null;
  const highYield = yieldPct != null && yieldPct > 8;
  const payoutHigh = h.payout_ratio != null && h.payout_ratio > 0.9;

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
      <td className="py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-100 font-medium">{h.ticker}</span>
          {highYield && (
            <span title="Yield above 8%  - may be unsustainable">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            </span>
          )}
        </div>
      </td>
      <td className="py-2 tabular text-right text-zinc-300">
        {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </td>
      <td className="py-2 tabular text-right text-zinc-300">
        {formatCurrency(h.current_price)}
      </td>
      <td className="py-2 tabular text-right text-zinc-300">
        {h.dividend_rate != null ? `$${h.dividend_rate.toFixed(2)}` : " -"}
      </td>
      <td className={`py-2 tabular text-right ${yieldPct != null && yieldPct > 0 ? (highYield ? "text-amber-400" : "text-gain") : "text-zinc-500"}`}>
        {yieldPct != null ? `${yieldPct.toFixed(2)}%` : " -"}
      </td>
      <td className={`py-2 tabular text-right font-medium ${h.annual_income > 0 ? "text-gain" : "text-zinc-500"}`}>
        {h.annual_income > 0 ? formatCurrency(h.annual_income) : " -"}
      </td>
      <td className="py-2 tabular text-right text-zinc-400">
        {h.ex_dividend_date ? formatDate(h.ex_dividend_date) : " -"}
      </td>
      <td className={`py-2 tabular text-right ${payoutHigh ? "text-amber-400" : "text-zinc-400"}`}>
        {h.payout_ratio != null ? `${(h.payout_ratio * 100).toFixed(0)}%` : " -"}
      </td>
    </tr>
  );
}


// ── Mobile Holding Card ──────────────────────────────────────────────────

function MobileHoldingCard({ holding: h }: { holding: DividendHolding }) {
  const yieldPct = h.dividend_yield != null ? h.dividend_yield * 100 : null;
  const highYield = yieldPct != null && yieldPct > 8;

  return (
    <div className="bg-zinc-800/30 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-100">{h.ticker}</span>
          {highYield && <AlertTriangle className="w-3 h-3 text-amber-400" />}
        </div>
        <span className={`text-sm font-bold tabular ${h.annual_income > 0 ? "text-gain" : "text-zinc-500"}`}>
          {h.annual_income > 0 ? `+${formatCurrency(h.annual_income)}/yr` : "No div"}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <span>{h.quantity.toFixed(2)} shares</span>
        {yieldPct != null && yieldPct > 0 && (
          <span className={highYield ? "text-amber-400" : "text-gain"}>
            {yieldPct.toFixed(2)}% yield
          </span>
        )}
        {h.dividend_rate != null && (
          <span>${h.dividend_rate.toFixed(2)}/share</span>
        )}
        {h.ex_dividend_date && (
          <span>Ex: {formatDate(h.ex_dividend_date)}</span>
        )}
      </div>
    </div>
  );
}

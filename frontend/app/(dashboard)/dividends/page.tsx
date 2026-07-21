"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronUp, ChevronDown, Download } from "lucide-react";
import PageTransition from "@/components/celestial/PageTransition";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary, type DividendHolding } from "@/hooks/useDividends";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { exportCSV } from "@/lib/export";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Eyebrow,
  Prose,
} from "@/components/instrument";

type SortKey = "income" | "yield" | "ticker";

const TH =
  "py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-vela-muted whitespace-nowrap";

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

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted hover:text-zinc-100 transition-colors"
    >
      {label}
      <SortIcon k={k} />
    </button>
  );

  if (loading) return <DashboardSkeleton />;

  if (portfolioError || dividendError) {
    return (
      <ErrorState
        message="Failed to load dividend data."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!dividends || dividends.holdings.length === 0) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Dividends" }]} note="no holdings yet" />
        <PageHero title="Dividends" meta="Projected income from your holdings" />
        <div className="mt-8">
          <Panel className="px-6 py-14 text-center">
            <Eyebrow>Nothing to project</Eyebrow>
            <Prose className="mx-auto mt-3 max-w-[380px]">
              There are no holdings on the book yet. Once positions are recorded, their yields,
              ex-dates and payout ratios land here.
            </Prose>
            <Link
              href="/portfolio"
              className="mt-5 inline-flex items-center rounded border border-vela-teal/25 bg-vela-teal/10 px-3 py-1.5
                font-mono text-[10px] uppercase tracking-wider text-vela-teal
                hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
            >
              Go to positions
            </Link>
          </Panel>
        </div>
      </PageTransition>
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

  const exportButton = (
    <button
      onClick={() =>
        exportCSV(
          dividends.holdings.map((h) => ({
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-vela-border
        font-mono text-[10px] uppercase tracking-wider text-vela-muted
        hover:text-zinc-100 hover:border-vela-teal/40 transition-colors"
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      Export
    </button>
  );

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Dividends" }]}
        note={
          daysUntilEx != null && nextEx
            ? `next ex-date ${nextEx.ticker} · ${daysUntilEx <= 0 ? "today or passed" : `${daysUntilEx}d`}`
            : `${payingHoldings.length} ${payingHoldings.length === 1 ? "payer" : "payers"} · at current rates`
        }
      />

      <PageHero
        title="Dividends"
        meta="Projected income at current declared rates"
        figure={formatCurrency(dividends.total_annual_income)}
        figureSub={`${formatCurrency(monthlyIncome)} / month`}
        figureSubClass="text-gain"
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Annual income"
          value={formatCurrency(dividends.total_annual_income)}
          valueClass="text-gain"
          sub={`from ${payingHoldings.length} holding${payingHoldings.length !== 1 ? "s" : ""}`}
        />
        <StatCell
          label="Portfolio yield"
          value={formatPercent((dividends.portfolio_yield ?? 0) * 100, false)}
          sub={`on ${formatCurrency(dividends.total_portfolio_value)}`}
        />
        <StatCell
          label="Monthly average"
          value={formatCurrency(monthlyIncome)}
          sub="projected at current rates"
        />
        <StatCell
          label="Non-payers"
          value={String(nonPayingHoldings.length)}
          sub={nonPayingHoldings.length > 0 ? "no declared dividend" : "every holding pays"}
        />
      </StatStrip>

      {/* ── Upcoming ex-dates ─────────────────────────────────────────────── */}

      {dividends.next_ex_dates.length > 0 && (
        <Section
          label="Upcoming"
          prose="The next ex-dividend dates on record for holdings you already own. Shares held through the ex-date carry the declared payment."
        >
          <div className="border-y border-vela-border divide-y divide-vela-border">
            {dividends.next_ex_dates.slice(0, 6).map((ex) => {
              const days = Math.ceil(
                (new Date(ex.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const isPast = days < 0;
              return (
                <div key={ex.ticker} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 font-mono text-[13px] font-semibold tracking-[0.02em] text-vela-teal">
                      {ex.ticker}
                    </span>
                    <span className="truncate text-[13px] text-vela-body">{formatDate(ex.date)}</span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] tabular-nums ${
                      isPast ? "text-vela-muted" : days <= 7 ? "text-amber-400" : "text-vela-body"
                    }`}
                  >
                    {isPast ? "Passed" : days === 0 ? "Today" : `${days}d away`}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Breakdown ─────────────────────────────────────────────────────── */}

      <Section
        label="Breakdown"
        prose="Every holding, its declared rate, and what that rate produces on the shares you hold."
        controls={exportButton}
      >
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-vela-border">
                <th className={`${TH} text-left`}>
                  <SortHead k="ticker" label="Ticker" />
                </th>
                <th className={`${TH} text-right`}>Shares</th>
                <th className={`${TH} text-right`}>Price</th>
                <th className={`${TH} text-right`}>Div / share</th>
                <th className={`${TH} text-right`}>
                  <SortHead k="yield" label="Yield" />
                </th>
                <th className={`${TH} text-right`}>
                  <SortHead k="income" label="Annual income" />
                </th>
                <th className={`${TH} text-right`}>Ex-date</th>
                <th className={`${TH} text-right`}>Payout</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => (
                <HoldingRow key={h.ticker} holding={h} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile rows */}
        <div className="sm:hidden border-y border-vela-border divide-y divide-vela-border">
          {sortedHoldings.map((h) => (
            <MobileHoldingRow key={h.ticker} holding={h} />
          ))}
        </div>
      </Section>

      {/* ── Projection ────────────────────────────────────────────────────── */}

      {dividends.total_annual_income > 0 && (
        <Section
          label="Income projection"
          prose="What the current declared rates add up to over a full year, before any change in the rates themselves."
        >
          <Prose className="max-w-[640px]">
            At current dividend rates the book generates{" "}
            <span className="font-mono tabular-nums text-gain">
              {formatCurrency(dividends.total_annual_income)}
            </span>{" "}
            a year, or roughly{" "}
            <span className="font-mono tabular-nums text-gain">{formatCurrency(monthlyIncome)}</span>{" "}
            a month.
            {dividends.portfolio_yield > 0 && (
              <>
                {" "}That is a {formatPercent(dividends.portfolio_yield * 100, false)} yield on the{" "}
                {formatCurrency(dividends.total_portfolio_value)} portfolio value.
              </>
            )}
          </Prose>

          {nonPayingHoldings.length > 0 && (
            <p className="mt-3 font-mono text-[11px] text-vela-muted">
              {nonPayingHoldings.length} holding
              {nonPayingHoldings.length !== 1 ? "s do not" : " does not"} pay a dividend (
              {nonPayingHoldings.map((h) => h.ticker).join(", ")}).
            </p>
          )}

          <p className="mt-6 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
            Projections use the dividend rates currently on record. Companies can change or suspend a
            dividend at any time, and past rates do not carry forward. Descriptive only, not investment
            advice.
          </p>
        </Section>
      )}
    </PageTransition>
  );
}


// ── Holding row (desktop) ────────────────────────────────────────────────────

function HoldingRow({ holding: h }: { holding: DividendHolding }) {
  const yieldPct = h.dividend_yield != null ? h.dividend_yield * 100 : null;
  const highYield = yieldPct != null && yieldPct > 8;
  const payoutHigh = h.payout_ratio != null && h.payout_ratio > 0.9;

  return (
    <tr className="border-b border-vela-border last:border-0">
      <td className="py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
            {h.ticker}
          </span>
          {highYield && (
            <span title="Yield above 8%">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
        {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </td>
      <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
        {formatCurrency(h.current_price)}
      </td>
      <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
        {h.dividend_rate != null ? `$${h.dividend_rate.toFixed(2)}` : "—"}
      </td>
      <td
        className={`py-2.5 font-mono tabular-nums text-right ${
          yieldPct != null && yieldPct > 0
            ? highYield
              ? "text-amber-400"
              : "text-gain"
            : "text-vela-muted"
        }`}
      >
        {yieldPct != null ? `${yieldPct.toFixed(2)}%` : "—"}
      </td>
      <td
        className={`py-2.5 font-mono tabular-nums font-medium text-right ${
          h.annual_income > 0 ? "text-gain" : "text-vela-muted"
        }`}
      >
        {h.annual_income > 0 ? formatCurrency(h.annual_income) : "—"}
      </td>
      <td className="py-2.5 font-mono tabular-nums text-right text-vela-body">
        {h.ex_dividend_date ? formatDate(h.ex_dividend_date) : "—"}
      </td>
      <td
        className={`py-2.5 font-mono tabular-nums text-right ${
          payoutHigh ? "text-amber-400" : "text-vela-body"
        }`}
      >
        {h.payout_ratio != null ? `${(h.payout_ratio * 100).toFixed(0)}%` : "—"}
      </td>
    </tr>
  );
}


// ── Holding row (mobile) ─────────────────────────────────────────────────────

function MobileHoldingRow({ holding: h }: { holding: DividendHolding }) {
  const yieldPct = h.dividend_yield != null ? h.dividend_yield * 100 : null;
  const highYield = yieldPct != null && yieldPct > 8;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[13px] font-semibold tracking-[0.02em] text-zinc-100">
            {h.ticker}
          </span>
          {highYield && (
            <span title="Yield above 8%">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            </span>
          )}
        </div>
        <span
          className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${
            h.annual_income > 0 ? "text-gain" : "text-vela-muted"
          }`}
        >
          {h.annual_income > 0 ? `${formatCurrency(h.annual_income)}/yr` : "No dividend"}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-vela-muted">
        <span>{h.quantity.toFixed(2)} shr</span>
        {yieldPct != null && yieldPct > 0 && (
          <span className={highYield ? "text-amber-400" : "text-gain"}>
            {yieldPct.toFixed(2)}% yield
          </span>
        )}
        {h.dividend_rate != null && <span>${h.dividend_rate.toFixed(2)}/shr</span>}
        {h.ex_dividend_date && <span>Ex {formatDate(h.ex_dividend_date)}</span>}
      </div>
    </div>
  );
}

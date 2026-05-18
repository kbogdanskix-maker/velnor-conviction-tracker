"use client";

import { useMemo, useState } from "react";
import { Bell, Filter } from "lucide-react";
import Link from "next/link";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useDividendSummary } from "@/hooks/useDividends";
import { useTaxSummary } from "@/hooks/useTax";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useGoals } from "@/hooks/useGoals";
import {
  evaluateAlerts,
  SEVERITY_CONFIG,
  CATEGORY_LABELS,
} from "@/lib/smart-alerts";
import type { AlertInput, AlertSeverity, AlertCategory } from "@/lib/smart-alerts";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "warning", "info", "positive"];

export default function AlertsPage() {
  const { portfolio, summary, error: pError } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = !!summary?.holdings?.length;

  const { dividends, error: divError } = useDividendSummary(hasHoldings ? portfolioId : null);
  const { tax, error: taxError } = useTaxSummary(hasHoldings ? portfolioId : null);
  const { summary: nwSummary, error: nwError } = useNetWorthSummary();
  const { goals, error: goalsError } = useGoals();

  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | null>(null);

  const alerts = useMemo(() => {
    if (!summary) return [];

    const totalValue = summary.total_value || 1;

    const input: AlertInput = {
      holdings: summary.holdings.map((h) => ({
        ticker: h.ticker,
        quantity: h.quantity,
        avgCost: h.avg_cost_basis,
        currentPrice: h.current_price ?? h.avg_cost_basis,
        marketValue: h.market_value ?? h.total_cost,
        dayChangePct: Number(h.day_change_pct) || 0,
        unrealizedPnlPct: Number(h.unrealized_pnl_pct) || 0,
        weight: (h.market_value ?? h.total_cost ?? 0) / totalValue,
      })),
      portfolioValue: summary.total_value,
      dayChangePct: Number(summary.day_change_pct) || 0,
      unrealizedPnlPct: Number(summary.unrealized_pnl_pct) || 0,
      dividends: dividends
        ? {
            holdings: dividends.holdings.map((h) => ({
              ticker: h.ticker,
              yield: h.dividend_yield ?? 0,
              exDividendDate: h.ex_dividend_date,
            })),
          }
        : undefined,
      tax: tax
        ? {
            holdings: tax.holdings.map((h) => ({
              ticker: h.ticker,
              daysHeld: h.days_held ?? 0,
              isLongTerm: h.is_long_term,
              daysUntilLongTerm: h.days_until_long_term,
              unrealizedGain: h.unrealized_gain,
            })),
            harvestableTotal: tax.harvesting_opportunities.reduce(
              (s, o) => s + Math.abs(o.unrealized_loss),
              0,
            ),
          }
        : undefined,
      goals: goals.map((g) => ({
        name: g.name,
        currentAmount: g.current_amount,
        targetAmount: g.target_amount,
      })),
      netWorth: nwSummary
        ? {
            netWorth: nwSummary.net_worth,
            totalLiabilities: nwSummary.total_liabilities,
            totalAssets: nwSummary.total_assets,
          }
        : undefined,
    };

    return evaluateAlerts(input);
  }, [summary, dividends, tax, goals, nwSummary]);

  const filtered = alerts
    .filter((a) => !severityFilter || a.severity === severityFilter)
    .filter((a) => !categoryFilter || a.category === categoryFilter);

  // Count by severity
  const counts = SEVERITY_ORDER.reduce(
    (acc, s) => {
      acc[s] = alerts.filter((a) => a.severity === s).length;
      return acc;
    },
    {} as Record<AlertSeverity, number>,
  );

  // Unique categories present
  const activeCategories = Array.from(new Set(alerts.map((a) => a.category))) as AlertCategory[];

  const alertError = pError || divError || taxError || nwError || goalsError;
  if (alertError) return <ErrorState message="Failed to load alert data." onRetry={() => window.location.reload()} />;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
          <Bell className="w-7 h-7 text-vela-teal" />
          Smart Alerts
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Automated notifications based on your portfolio activity and thresholds.
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {SEVERITY_ORDER.map((sev) => {
          const conf = SEVERITY_CONFIG[sev];
          const count = counts[sev];
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                severityFilter === sev
                  ? `${conf.bg} ${conf.border} ${conf.text}`
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span>{conf.icon}</span>
              <span className="text-sm font-medium capitalize">{sev}</span>
              <span className={`text-xs tabular ${count > 0 ? conf.text : "text-zinc-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      {activeCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              !categoryFilter
                ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </button>
          {activeCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-vela-teal/15 text-vela-teal border-vela-teal/30"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Alerts list */}
      {filtered.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-3">
          <Bell className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">
              {alerts.length === 0 ? "All clear" : "No alerts match this filter"}
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              {alerts.length === 0
                ? "No notable events detected. We'll surface alerts when something needs your attention."
                : "Try removing filters to see all alerts."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const conf = SEVERITY_CONFIG[alert.severity];
            const inner = (
              <div
                className={`vela-card border ${conf.border} ${conf.bg} transition-colors ${
                  alert.link ? "hover:border-zinc-500 cursor-pointer" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">{conf.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-medium ${conf.text}`}>
                        {alert.title}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {CATEGORY_LABELS[alert.category]}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{alert.message}</p>
                  </div>
                  {alert.link && (
                    <span className="text-xs text-zinc-600 shrink-0">→</span>
                  )}
                </div>
              </div>
            );

            if (alert.link) {
              return (
                <Link href={alert.link} key={alert.id} className="block">
                  {inner}
                </Link>
              );
            }
            return <div key={alert.id}>{inner}</div>;
          })}
        </div>
      )}

      {/* Info */}
      <div className="text-center pt-4 pb-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Alerts are generated in real-time from your portfolio data. They reset when conditions change.
          This is not financial advice.
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}

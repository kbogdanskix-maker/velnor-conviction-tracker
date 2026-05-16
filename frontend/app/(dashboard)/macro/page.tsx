"use client";

import { useState } from "react";
import { TrendingUp, Info, ExternalLink, FileText, DollarSign } from "lucide-react";
import { useMacroDashboard, useFedMinutes, type MacroSeries } from "@/hooks/useMacro";
import { useNetWorthSummary, type NetWorthAsset } from "@/hooks/useNetWorth";
import { formatDate, formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";

export default function MacroPage() {
  const { data, isLoading } = useMacroDashboard();
  const { items: fedItems, isLoading: fedLoading } = useFedMinutes();
  const { summary: nwSummary } = useNetWorthSummary();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-vela-teal" />
          Macro
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Bond yields, inflation, and Fed policy — how they affect your portfolio
        </p>
      </div>

      {/* Yields */}
      {data?.yields && data.yields.length > 0 && (
        <MacroGroup title="Bond Yields" series={data.yields} />
      )}

      {/* Inflation */}
      {data?.inflation && data.inflation.length > 0 && (
        <MacroGroup title="Inflation" series={data.inflation} />
      )}

      {/* Fed / Policy */}
      {data?.fed && data.fed.length > 0 && (
        <MacroGroup title="Fed & Employment" series={data.fed} />
      )}

      {/* Rate Impact on Your Net Worth */}
      {nwSummary && data?.fed && (
        <RateImpactSection
          fedRate={data.fed.find((s) => s.series_id === "FEDFUNDS")?.value ?? null}
          tbillRate={data.yields?.find((s) => s.series_id === "DGS3MO")?.value ?? null}
          assets={nwSummary.assets}
          totalLiabilities={nwSummary.total_liabilities}
        />
      )}

      {/* Fed Minutes */}
      <div className="vela-card">
        <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          Fed Press Releases
        </h2>
        {fedLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : fedItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent FOMC releases found</p>
        ) : (
          <div className="space-y-2">
            {fedItems.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 border-b border-vela-border last:border-0 hover:bg-zinc-800/50 -mx-2 px-2 rounded transition-colors"
              >
                <p className="text-sm text-zinc-200 font-medium flex items-center gap-1.5">
                  {item.title}
                  <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0" />
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {item.published ? formatDate(item.published) : ""}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>

      {data?.updated_at && (
        <p className="text-xs text-zinc-600 text-center">
          Data from FRED (Federal Reserve Economic Data) · Updated {formatDate(data.updated_at)}
        </p>
      )}
    </PageTransition>
    </TierGate>
  );
}


// ── Rate Impact Section ─────────────────────────────────────────────────────

function RateImpactSection({
  fedRate,
  tbillRate,
  assets,
  totalLiabilities,
}: {
  fedRate: number | null;
  tbillRate: number | null;
  assets: NetWorthAsset[];
  totalLiabilities: number;
}) {
  if (fedRate == null) return null;

  // Find rate-sensitive items
  const hysaAssets = assets.filter(
    (a) => !a.is_liability && ["hysa", "savings", "money_market", "cd"].includes(a.category),
  );
  const variableDebt = assets.filter(
    (a) => a.is_liability && a.interest_rate != null && a.interest_rate > 0,
  );

  const totalSavings = hysaAssets.reduce((sum, a) => sum + a.value, 0);
  const totalDebtWithRates = variableDebt.reduce((sum, a) => sum + a.value, 0);

  // Estimate annual interest impact of a 25bps rate change
  const bpsChange = 0.25; // standard Fed move
  const savingsImpact = totalSavings * (bpsChange / 100);
  const debtImpact = totalDebtWithRates * (bpsChange / 100);
  const netImpact = savingsImpact - debtImpact;

  const hasData = totalSavings > 0 || totalDebtWithRates > 0;

  return (
    <div className="vela-card">
      <h2 className="text-sm font-medium text-zinc-300 mb-1 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-vela-teal" />
        What rates mean for you
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Current Fed Funds: {fedRate}%{tbillRate != null ? ` · 3-Mo T-Bill: ${tbillRate}%` : ""}
      </p>

      {!hasData ? (
        <p className="text-xs text-zinc-500">
          Add savings accounts or debt with interest rates in Net Worth to see personalized impact.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Impact of 25bps move */}
          <div className="bg-zinc-800/40 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-2">
              If the Fed moves rates 25bps (0.25%):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {totalSavings > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Savings yield</p>
                  <p className="text-sm font-bold tabular text-gain">
                    +{formatCurrency(savingsImpact)}/yr
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    on {formatCurrency(totalSavings)} in savings
                  </p>
                </div>
              )}
              {totalDebtWithRates > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Debt cost</p>
                  <p className="text-sm font-bold tabular text-loss">
                    +{formatCurrency(debtImpact)}/yr
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    on {formatCurrency(totalDebtWithRates)} variable debt
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Net effect</p>
                <p className={`text-sm font-bold tabular ${netImpact >= 0 ? "text-gain" : "text-loss"}`}>
                  {netImpact >= 0 ? "+" : ""}{formatCurrency(netImpact)}/yr
                </p>
                <p className="text-[10px] text-zinc-600">
                  {netImpact >= 0 ? "Rate hikes help you" : "Rate hikes cost you"}
                </p>
              </div>
            </div>
          </div>

          {/* Rate-sensitive breakdown */}
          {variableDebt.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Your rate-sensitive debt</p>
              {variableDebt.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-zinc-300">{d.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 tabular">{formatCurrency(d.value)}</span>
                    <span className="text-loss tabular">{d.interest_rate}% APR</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Macro Group ─────────────────────────────────────────────────────────────

function MacroGroup({ title, series }: { title: string; series: MacroSeries[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="vela-card">
      <h2 className="text-sm font-medium text-zinc-300 mb-3">{title}</h2>
      <div className="space-y-1">
        {series.map((s) => (
          <div key={s.series_id}>
            <div
              onClick={() => setExpandedId(expandedId === s.series_id ? null : s.series_id)}
              className="flex items-center justify-between py-2.5 border-b border-vela-border last:border-0 cursor-pointer hover:bg-zinc-800/30 -mx-2 px-2 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-200">{s.name}</p>
                <Info className="w-3 h-3 text-zinc-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular text-zinc-100">
                  {s.value !== null ? `${s.value}${s.unit === "%" ? "%" : ""}` : "—"}
                </p>
                {s.date && <p className="text-[10px] text-zinc-600">{s.date}</p>}
              </div>
            </div>
            {expandedId === s.series_id && (
              <div className="px-2 py-2 mb-1 text-xs text-zinc-400 bg-zinc-800/30 rounded-lg -mx-2">
                {s.context}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

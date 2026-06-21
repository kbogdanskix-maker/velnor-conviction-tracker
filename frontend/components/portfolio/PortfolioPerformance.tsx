"use client";

import { Activity, TrendingUp, Shield, BarChart3 } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";

export default function PortfolioPerformance() {
  const { portfolio } = useDefaultPortfolio();
  const { data: risk, isLoading } = useRiskMetrics(portfolio?.id);

  const metrics = [
    {
      label: "Sharpe Ratio",
      value: risk?.sharpe_ratio != null ? risk.sharpe_ratio.toFixed(2) : null,
      hint: sharpeHint(risk?.sharpe_ratio),
      icon: TrendingUp,
    },
    {
      label: "Volatility",
      value: risk?.annualized_volatility != null ? `${risk.annualized_volatility}%` : null,
      hint: volHint(risk?.annualized_volatility),
      icon: Activity,
    },
    {
      label: "Beta",
      value: risk?.beta != null ? risk.beta.toFixed(2) : null,
      hint: betaHint(risk?.beta),
      icon: BarChart3,
    },
    {
      label: "Max Drawdown",
      value: risk?.max_drawdown != null ? `-${risk.max_drawdown}%` : null,
      hint: drawdownHint(risk?.max_drawdown),
      icon: Shield,
    },
  ];

  return (
    <div className="vela-card">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">
        Risk Profile
      </h3>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg bg-zinc-800/50 p-3">
              <div className="skeleton h-3 w-16 mb-2" />
              <div className="skeleton h-5 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-lg bg-zinc-800/50 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-500">{m.label}</span>
                </div>
                <p className="text-lg font-bold tabular text-zinc-100">
                  {m.value ?? " -"}
                </p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {m.hint}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {risk?.annualized_return != null && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Annualized return</span>
          <span className={`tabular font-medium ${risk.annualized_return >= 0 ? "text-gain" : "text-loss"}`}>
            {risk.annualized_return >= 0 ? "+" : ""}{risk.annualized_return}%
          </span>
        </div>
      )}
    </div>
  );
}

function sharpeHint(v: number | null | undefined): string {
  if (v == null) return "Needs price history to calculate";
  if (v >= 2) return "Strong risk-adjusted returns";
  if (v >= 1) return "Decent returns for the risk taken";
  if (v >= 0.5) return "Moderate  - index funds might do better";
  return "Low  - you're taking on a lot of risk for the return";
}

function volHint(v: number | null | undefined): string {
  if (v == null) return "Needs price history to calculate";
  if (v <= 12) return "Low volatility  - steady portfolio";
  if (v <= 20) return "Moderate  - typical for a diversified mix";
  if (v <= 30) return "High  - expect meaningful daily swings";
  return "Very high  - concentrated or growth-heavy";
}

function betaHint(v: number | null | undefined): string {
  if (v == null) return "Needs price history to calculate";
  if (v > 1.3) return "Amplifies market moves significantly";
  if (v > 1) return "Slightly more volatile than the market";
  if (v > 0.7) return "Roughly tracks the broader market";
  return "Defensive  - less sensitive to market swings";
}

function drawdownHint(v: number | null | undefined): string {
  if (v == null) return "Needs price history to calculate";
  if (v <= 10) return "Mild  - you weathered downturns well";
  if (v <= 20) return "Moderate  - check if near-term goals are exposed";
  if (v <= 35) return "Significant  - painful if you needed to sell";
  return "Severe  - consider whether your timeline can handle this";
}

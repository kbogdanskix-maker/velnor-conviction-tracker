"use client";

import Link from "next/link";
import { Route } from "lucide-react";
import { formatCurrency, formatPercent, formatQuantity, changePillClass } from "@/lib/formatters";
import type { Holding } from "@/hooks/usePortfolio";

interface Props {
  holdings: Holding[];
  onTickerClick?: (ticker: string) => void;
}

export default function HoldingsTable({ holdings, onTickerClick }: Props) {
  if (holdings.length === 0) return null;

  const sorted = [...holdings].sort(
    (a, b) => (Number(b.market_value) || 0) - (Number(a.market_value) || 0),
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sorted.map((h) => (
        <HoldingCard
          key={h.ticker}
          holding={h}
          onClick={() => onTickerClick?.(h.ticker)}
          clickable={!!onTickerClick}
        />
      ))}
    </div>
  );
}

function HoldingCard({
  holding,
  onClick,
  clickable,
}: {
  holding: Holding;
  onClick: () => void;
  clickable: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`vela-card flex items-center justify-between ${
        clickable ? "cursor-pointer hover:border-zinc-600 transition-colors" : ""
      }`}
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <p className="text-base font-semibold text-zinc-100">{holding.ticker}</p>
        <p className="text-sm text-zinc-400 tabular">
          {formatQuantity(holding.quantity)} shares · {formatCurrency(holding.market_value)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={changePillClass(holding.unrealized_pnl_pct)}>
          {formatPercent(holding.unrealized_pnl_pct)}
        </span>
        <Link
          href={`/journey/${holding.ticker}`}
          title="View journey"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded text-zinc-600 hover:text-vela-teal transition-colors"
        >
          <Route className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

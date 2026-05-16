"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent, formatPnl, pnlClass, changePillClass } from "@/lib/formatters";
import AnimatedNumber from "@/components/celestial/AnimatedNumber";
import type { PortfolioSummary } from "@/hooks/usePortfolio";

interface Props {
  summary: PortfolioSummary;
}

export default function PnLSummary({ summary }: Props) {
  const dayUp = summary.day_change >= 0;
  const fmtCurrency = useCallback((n: number) => formatCurrency(n), []);

  return (
    <div className="vela-card">
      <p className="text-sm text-zinc-400 mb-1">Portfolio value</p>
      <p className="text-4xl font-bold text-zinc-100 tabular tracking-tight">
        <AnimatedNumber value={summary.total_value} format={fmtCurrency} duration={1000} />
      </p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className={`text-sm tabular ${pnlClass(summary.unrealized_pnl)}`}>
          {formatPnl(summary.unrealized_pnl)} ({formatPercent(summary.unrealized_pnl_pct)})
        </span>
        <span className="text-zinc-700">·</span>
        <motion.span
          className={changePillClass(summary.day_change)}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3, type: "spring", stiffness: 300 }}
        >
          {dayUp ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          Today {formatPercent(summary.day_change_pct)}
        </motion.span>
      </div>
    </div>
  );
}

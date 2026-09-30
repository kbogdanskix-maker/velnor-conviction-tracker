"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { Holding } from "@/hooks/usePortfolio";
import { categoricalColor } from "@/lib/chart-colors";

interface Props {
  holdings: Holding[];
}


interface PieEntry {
  ticker: string;
  value: number;
  pct: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PieEntry }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-800 border border-vela-border rounded-md px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-zinc-100">{d.ticker}</p>
      <p className="text-zinc-400 tabular">{formatCurrency(d.value)}</p>
      <p className="text-zinc-400 tabular">{formatPercent(d.pct, false)}</p>
    </div>
  );
}

export default function AllocationPie({ holdings }: Props) {
  const totalValue = holdings.reduce((s, h) => s + (Number(h.market_value) || 0), 0);

  if (totalValue === 0 || holdings.length === 0) return null;

  const data: PieEntry[] = holdings
    .filter((h) => (Number(h.market_value) || 0) > 0)
    .map((h) => ({
      ticker: h.ticker,
      value: Number(h.market_value) || 0,
      pct: ((Number(h.market_value) || 0) / totalValue) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [animated, setAnimated] = useState(false);

  return (
    <div className="vela-card">
      <p className="section-heading mb-4">Allocation</p>
      <div className="flex items-center gap-4">
        <motion.div
          className="w-48 h-48 shrink-0"
          initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setAnimated(true)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                animationBegin={300}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={categoricalColor(i)} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48">
          {data.map((d, i) => (
            <motion.div
              key={d.ticker}
              className="flex items-center gap-2 text-xs"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.06, duration: 0.3 }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: categoricalColor(i) }}
              />
              <span className="text-zinc-300 truncate flex-1">{d.ticker}</span>
              <span className="text-vela-muted tabular">{d.pct.toFixed(1)}%</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

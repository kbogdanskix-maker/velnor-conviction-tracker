"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import {
  PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Treemap,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useSectorBreakdown, type SectorEntry, type IndustryEntry, type SectorHolding } from "@/hooks/useSectors";
import { formatCompact, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import ErrorState from "@/components/shared/ErrorState";

// ── Constants ────────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  "Technology":            "#14b8a6",
  "Healthcare":            "#22d3ee",
  "Financial Services":    "#a78bfa",
  "Consumer Cyclical":     "#f472b6",
  "Communication Services":"#fbbf24",
  "Industrials":           "#34d399",
  "Consumer Defensive":    "#fb923c",
  "Energy":                "#ef4444",
  "Real Estate":           "#818cf8",
  "Utilities":             "#2dd4bf",
  "Basic Materials":       "#a3e635",
  "ETF / Fund":            "#71717a",
  "Unknown":               "#52525b",
};

const FALLBACK_COLORS = [
  "#14b8a6", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24",
  "#34d399", "#fb923c", "#ef4444", "#818cf8", "#2dd4bf",
  "#a3e635", "#71717a",
];

function getSectorColor(name: string, idx: number): string {
  return SECTOR_COLORS[name] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// S&P 500 approximate sector weights (as of 2024-2025) for comparison
const SP500_SECTORS: Record<string, number> = {
  "Technology":            0.32,
  "Healthcare":            0.12,
  "Financial Services":    0.13,
  "Consumer Cyclical":     0.10,
  "Communication Services":0.09,
  "Industrials":           0.09,
  "Consumer Defensive":    0.06,
  "Energy":                0.04,
  "Real Estate":           0.02,
  "Utilities":             0.02,
  "Basic Materials":       0.02,
};

/** Format a weight (0–1) as a percentage with 1 decimal, no sign. */
function pctWeight(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ── Treemap custom content ──────────────────────────────────────────────────

function TreemapContent(props: any) {
  const { x, y, width, height, name, weight } = props;
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={props.color || "#27272a"} stroke="#18181b" strokeWidth={2} />
      <text x={x + 6} y={y + 16} fill="#fafafa" fontSize={11} fontWeight={500}>
        {width > 70 ? name : name?.slice(0, 6)}
      </text>
      {height > 40 && (
        <text x={x + 6} y={y + 30} fill="#a1a1aa" fontSize={10}>
          {pctWeight(weight)}
        </text>
      )}
    </g>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SectorsPage() {
  const { portfolio, summary } = useDefaultPortfolio();
  const portfolioId = portfolio?.id ?? null;
  const hasHoldings = !!summary?.holdings?.length;
  const { breakdown, loading, error } = useSectorBreakdown(hasHoldings ? portfolioId : null);

  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const colorMap = useMemo(() => {
    if (!breakdown) return {};
    const map: Record<string, string> = {};
    breakdown.sectors.forEach((s, i) => {
      map[s.name] = getSectorColor(s.name, i);
    });
    return map;
  }, [breakdown]);

  // Treemap data
  const treemapData = useMemo(() => {
    if (!breakdown) return [];
    return breakdown.sectors.map((s, i) => ({
      name: s.name,
      size: s.value,
      weight: s.weight,
      color: getSectorColor(s.name, i),
    }));
  }, [breakdown]);

  // Industries for selected sector
  const sectorIndustries = useMemo(() => {
    if (!breakdown || !expandedSector) return [];
    return breakdown.industries.filter((ind) => ind.sector === expandedSector);
  }, [breakdown, expandedSector]);

  const sectorHoldings = useMemo(() => {
    if (!breakdown || !expandedSector) return [];
    return breakdown.holdings.filter((h) => h.sector === expandedSector);
  }, [breakdown, expandedSector]);

  const isEmpty = !loading && (!breakdown || breakdown.sectors.length === 0);

  if (loading || (!breakdown && hasHoldings)) {
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

  if (error) return <ErrorState message="Failed to load sector breakdown." onRetry={() => window.location.reload()} />;

  return (
    <PageTransition className="space-y-6">
      <Header />

      {isEmpty ? (
        <div className="vela-card text-center py-16 space-y-3">
          <LayoutGrid className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <p className="text-zinc-300 font-medium">No holdings to analyze</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add stocks or ETFs to your portfolio to see sector breakdown.
            </p>
          </div>
        </div>
      ) : breakdown && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FloatingCard delay={0}>
              <div className="text-center py-4 px-4">
                <p className="text-3xl font-bold tabular text-zinc-100">{breakdown.sectors.length}</p>
                <p className="text-xs text-zinc-500 mt-1">Sectors</p>
              </div>
            </FloatingCard>
            <FloatingCard delay={0.08}>
              <div className="text-center py-4 px-4">
                <p className="text-3xl font-bold tabular text-zinc-100">{breakdown.industries.length}</p>
                <p className="text-xs text-zinc-500 mt-1">Industries</p>
              </div>
            </FloatingCard>
            <FloatingCard delay={0.16}>
              <div className="text-center py-4 px-4">
                <p className="text-3xl font-bold tabular text-vela-teal">
                  {pctWeight(breakdown.sectors[0]?.weight ?? 0)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Largest Sector</p>
              </div>
            </FloatingCard>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Sector Allocation</h2>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={breakdown.sectors}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {breakdown.sectors.map((s, i) => (
                        <Cell key={s.name} fill={getSectorColor(s.name, i)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(val: number) => [formatCompact(val), "Value"]}
                    />
                  </RPieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {breakdown.sectors.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getSectorColor(s.name, i) }} />
                    <span className="text-[10px] text-zinc-400">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Treemap */}
            <div className="vela-card">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Proportional Map</h2>
              <div className="h-64">
                {treemapData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={treemapData}
                      dataKey="size"
                      stroke="none"
                      content={<TreemapContent />}
                    />
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Sector rows with S&P 500 comparison */}
          <RevealOnScroll>
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Sector Details</h2>
            {breakdown.sectors.map((sector, i) => {
              const color = getSectorColor(sector.name, i);
              const sp500Weight = SP500_SECTORS[sector.name];
              const isExpanded = expandedSector === sector.name;
              const overweight = sp500Weight != null ? sector.weight - sp500Weight : null;

              return (
                <motion.div
                  key={sector.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <button
                    onClick={() => setExpandedSector(isExpanded ? null : sector.name)}
                    className="vela-card w-full text-left hover:border-zinc-600 transition-colors group/sector"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-zinc-100">{sector.name}</h3>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular text-zinc-100">{pctWeight(sector.weight)}</p>
                              <p className="text-[10px] text-zinc-500 tabular">{formatCompact(sector.value)}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                        </div>

                        {/* Weight bar with hover glow */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all group-hover/sector:shadow-[0_0_8px_var(--bar-color)]"
                              style={{
                                width: `${Math.min(sector.weight * 100, 100)}%`,
                                backgroundColor: color,
                                ["--bar-color" as string]: color,
                              }}
                            />
                            {/* S&P 500 marker */}
                            {sp500Weight != null && (
                              <div
                                className="absolute top-0 h-full w-0.5 bg-zinc-400"
                                style={{ left: `${Math.min(sp500Weight * 100, 100)}%` }}
                                title={`S&P 500: ${pctWeight(sp500Weight)}`}
                              />
                            )}
                          </div>
                          {overweight != null && (
                            <span className={`text-[10px] tabular w-16 text-right ${
                              overweight > 0.05 ? "text-amber-400" :
                              overweight < -0.05 ? "text-sky-400" :
                              "text-zinc-500"
                            }`}>
                              {overweight > 0 ? "+" : ""}{(overweight * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {sp500Weight != null && (
                          <p className="text-[10px] text-zinc-600 mt-1">
                            S&P 500: {pctWeight(sp500Weight)} · You: {pctWeight(sector.weight)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: industries + holdings */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {sectorIndustries.map((ind) => (
                        <div key={ind.name} className="vela-card py-2 px-3 border-l-2" style={{ borderColor: color }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-300">{ind.name}</span>
                            <span className="text-xs text-zinc-500 tabular">{pctWeight(ind.weight)}</span>
                          </div>
                        </div>
                      ))}
                      {sectorHoldings.length > 0 && (
                        <div className="vela-card py-2 px-3">
                          <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">Holdings</p>
                          <div className="flex flex-wrap gap-2">
                            {sectorHoldings.map((h) => (
                              <span
                                key={h.ticker}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 tabular"
                              >
                                {h.ticker} · {pctWeight(h.weight)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          </RevealOnScroll>

          {/* Concentration insight */}
          <ConcentrationInsight sectors={breakdown.sectors} />

          {/* Disclaimer */}
          <div className="text-center pt-4 pb-8 border-t border-zinc-800">
            <p className="text-xs text-zinc-600">
              Sector data is sourced from Yahoo Finance. ETFs are grouped separately as they span multiple sectors.
              S&P 500 weights are approximate benchmarks.
            </p>
          </div>
        </>
      )}
    </PageTransition>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
        <LayoutGrid className="w-7 h-7 text-vela-teal" />
        Sector Breakdown
      </h1>
      <p className="text-zinc-500 text-sm mt-1">
        Understand your portfolio diversification across sectors and industries.
      </p>
    </div>
  );
}

// ── Concentration Insight ────────────────────────────────────────────────────

function ConcentrationInsight({ sectors }: { sectors: SectorEntry[] }) {
  if (sectors.length === 0) return null;

  const top = sectors[0];
  const hhi = sectors.reduce((sum, s) => sum + s.weight * s.weight, 0);
  const concentration = hhi > 0.25 ? "high" : hhi > 0.15 ? "moderate" : "low";

  const overweightSectors = sectors.filter((s) => {
    const sp = SP500_SECTORS[s.name];
    return sp != null && s.weight - sp > 0.05;
  });

  return (
    <div className={`vela-card px-4 py-3 ${
      concentration === "high" ? "border-amber-500/20" :
      concentration === "moderate" ? "border-zinc-700" :
      "border-vela-teal/20"
    }`}>
      <p className="text-xs text-zinc-400">
        {concentration === "high" ? (
          <>
            Your portfolio is <span className="text-amber-400 font-medium">highly concentrated</span> in {top.name} ({pctWeight(top.weight)}).
            Consider diversifying across more sectors to reduce risk.
          </>
        ) : concentration === "moderate" ? (
          <>
            <span className="text-zinc-300 font-medium">Moderate concentration</span> — {top.name} is your largest sector at {pctWeight(top.weight)}.
            {sectors.length >= 4 ? " Good spread across multiple sectors." : " Adding exposure to more sectors could help."}
          </>
        ) : (
          <>
            <span className="text-emerald-400 font-medium">Well diversified</span> across {sectors.length} sectors.
            No single sector dominates your portfolio.
          </>
        )}
        {overweightSectors.length > 0 && (
          <>{" "}You&apos;re overweight vs S&P 500 in: {overweightSectors.map((s) => s.name).join(", ")}.</>
        )}
      </p>
    </div>
  );
}

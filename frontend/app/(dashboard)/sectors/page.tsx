"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Treemap,
} from "recharts";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useSectorBreakdown, type SectorEntry } from "@/hooks/useSectors";
import { formatCompact } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
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

// ── Constants ────────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  "Technology":            "#1AA8BB",
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
  "#1AA8BB", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24",
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
      {/* Sector fills span light pastels (#a78bfa, #f472b6) through dark greys, so
          no single label colour reads on all of them at full strength. The cell is
          drawn as a tint of its sector colour over the page background, which keeps
          the hue identity used by the ring and the legend while giving every cell a
          mid-to-dark surface — one consistent light label works across the map. */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        fill={props.color || "#0B1322"}
        fillOpacity={0.55}
        stroke="#050A16"
        strokeWidth={2}
      />
      <text x={x + 6} y={y + 16} fill="#EAEEF5" fontSize={11} fontWeight={500}>
        {width > 70 ? name : name?.slice(0, 6)}
      </text>
      {height > 40 && Number.isFinite(weight) && (
        <text x={x + 6} y={y + 30} fill="#AEB9CC" fontSize={10}>
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

  if (loading || (!breakdown && hasHoldings)) return <DashboardSkeleton />;

  if (error) return <ErrorState message="Failed to load sector breakdown." onRetry={() => window.location.reload()} />;

  if (isEmpty || !breakdown) {
    return (
      <PageTransition>
        <TopBar trail={[{ label: "Lab" }, { label: "Sectors" }]} note="no positions yet" />
        <PageHero title="Sectors" meta="Where the book sits across the market" />
        <div className="mt-8">
          <Panel className="px-6 py-14 text-center">
            <Eyebrow>Nothing to break down</Eyebrow>
            <Prose className="mx-auto mt-3 max-w-[380px]">
              There are no holdings on the book yet. Once stocks or funds are recorded, their sector
              and industry weights land here.
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

  const topSector = breakdown.sectors[0];
  const hhi = breakdown.sectors.reduce((sum, s) => sum + s.weight * s.weight, 0);
  const concentration = hhi > 0.25 ? "High" : hhi > 0.15 ? "Moderate" : "Low";

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Lab" }, { label: "Sectors" }]}
        note={`${breakdown.sectors.length} ${breakdown.sectors.length === 1 ? "sector" : "sectors"} · ${breakdown.industries.length} ${breakdown.industries.length === 1 ? "industry" : "industries"}`}
      />

      <PageHero
        title="Sectors"
        meta="Where the book sits across the market"
        figure={pctWeight(topSector?.weight ?? 0)}
        figureSub={topSector ? `in ${topSector.name}` : undefined}
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Sectors held"
          value={String(breakdown.sectors.length)}
          sub={`${breakdown.industries.length} ${breakdown.industries.length === 1 ? "industry" : "industries"}`}
        />
        <StatCell
          label="Largest sector"
          value={pctWeight(topSector?.weight ?? 0)}
          sub={topSector?.name ?? "—"}
        />
        <StatCell
          label="Concentration"
          value={concentration}
          sub={`HHI ${hhi.toFixed(2)}`}
        />
        <StatCell
          label="Book value"
          value={formatCompact(breakdown.total_value)}
          sub="across all sectors"
        />
      </StatStrip>

      {/* ── Allocation ────────────────────────────────────────────────────── */}

      <Section
        label="Allocation"
        prose="Market value split by sector, shown as a ring and as a proportional map. Each sector keeps the same colour throughout the page."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
          <div className="min-w-0">
            <Eyebrow>Sector ring</Eyebrow>
            <div className="mt-3 h-64">
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
                      backgroundColor: "#0B1322",
                      border: "1px solid #1B2638",
                      borderRadius: 4,
                      fontSize: 12,
                      color: "#EAEEF5",
                    }}
                    itemStyle={{ color: "#EAEEF5" }}
                    labelStyle={{ color: "#8A97AC" }}
                    formatter={(val: number) => [formatCompact(val), "Value"]}
                  />
                </RPieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {breakdown.sectors.map((s, i) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-vela-muted"
                >
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 inline-block shrink-0"
                    style={{ backgroundColor: getSectorColor(s.name, i) }}
                  />
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <Eyebrow>Proportional map</Eyebrow>
            <div className="mt-3 h-64">
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
      </Section>

      {/* ── Sector detail ─────────────────────────────────────────────────── */}

      <Section
        label="By sector"
        prose="Each sector's weight on the book against its weight in the S&P 500, marked on the bar. Select a row to open its industries and the holdings behind it."
      >
        <div className="border-t border-vela-border">
          {breakdown.sectors.map((sector, i) => {
            const color = getSectorColor(sector.name, i);
            const sp500Weight = SP500_SECTORS[sector.name];
            const isExpanded = expandedSector === sector.name;
            const overweight = sp500Weight != null ? sector.weight - sp500Weight : null;

            return (
              <div key={sector.name} className="border-b border-vela-border">
                <button
                  onClick={() => setExpandedSector(isExpanded ? null : sector.name)}
                  aria-expanded={isExpanded}
                  className="w-full text-left py-3.5 group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-100 group-hover:text-vela-teal transition-colors">
                      {sector.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[13px] font-semibold tabular-nums text-zinc-100">
                        {pctWeight(sector.weight)}
                      </span>
                      <span className="block font-mono text-[10px] tabular-nums text-vela-muted">
                        {formatCompact(sector.value)}
                      </span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 shrink-0 text-vela-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-vela-muted" />
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-sm border border-vela-border bg-vela-card">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(sector.weight * 100, 100)}%`,
                          backgroundColor: color,
                        }}
                      />
                      {sp500Weight != null && (
                        <span
                          aria-hidden="true"
                          className="absolute top-0 h-full w-px bg-zinc-100"
                          style={{ left: `${Math.min(sp500Weight * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {overweight != null && (
                      <span
                        className={`w-24 shrink-0 text-right font-mono text-[10px] tabular-nums ${
                          overweight > 0.05 ? "text-amber-400" : "text-vela-muted"
                        }`}
                      >
                        {overweight > 0 ? "+" : ""}
                        {(overweight * 100).toFixed(1)}% vs S&amp;P
                      </span>
                    )}
                  </div>

                  {sp500Weight != null && (
                    <p className="mt-1.5 font-mono text-[10px] tabular-nums text-vela-muted">
                      S&amp;P 500 {pctWeight(sp500Weight)} · book {pctWeight(sector.weight)}
                    </p>
                  )}
                </button>

                {isExpanded && (
                  <div
                    className="mb-4 border-l pl-4 space-y-2.5"
                    style={{ borderColor: color }}
                  >
                    {sectorIndustries.length > 0 && (
                      <div>
                        <Eyebrow>Industries</Eyebrow>
                        <div className="mt-1.5 divide-y divide-vela-border">
                          {sectorIndustries.map((ind) => (
                            <div
                              key={ind.name}
                              className="flex items-center justify-between gap-3 py-1.5"
                            >
                              <span className="min-w-0 truncate text-[13px] text-vela-body">
                                {ind.name}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-vela-muted">
                                {pctWeight(ind.weight)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sectorHoldings.length > 0 && (
                      <div>
                        <Eyebrow>Holdings</Eyebrow>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                          {sectorHoldings.map((h) => (
                            <span
                              key={h.ticker}
                              className="font-mono text-[11px] tabular-nums text-vela-body"
                            >
                              <span className="text-zinc-100">{h.ticker}</span>{" "}
                              {pctWeight(h.weight)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Concentration ─────────────────────────────────────────────────── */}

      <ConcentrationInsight sectors={breakdown.sectors} />
    </PageTransition>
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
    <Section
      label="Concentration"
      prose="A read of how tightly the book clusters, using the Herfindahl-Hirschman index of sector weights."
    >
      <Prose className="max-w-[620px]">
        {concentration === "high" ? (
          <>
            Sector weights are tightly clustered, with{" "}
            <span className="text-zinc-100">{top.name}</span> at{" "}
            <span className="font-mono tabular-nums text-zinc-100">{pctWeight(top.weight)}</span> of
            the book. An index above 0.25 is conventionally read as high concentration.
          </>
        ) : concentration === "moderate" ? (
          <>
            Sector weights sit in the middle of the range, with{" "}
            <span className="text-zinc-100">{top.name}</span> largest at{" "}
            <span className="font-mono tabular-nums text-zinc-100">{pctWeight(top.weight)}</span>.
            The book spreads across {sectors.length} {sectors.length === 1 ? "sector" : "sectors"}.
          </>
        ) : (
          <>
            Sector weights are evenly spread across {sectors.length}{" "}
            {sectors.length === 1 ? "sector" : "sectors"}, with no single sector taking a dominant
            share. {top.name} is largest at{" "}
            <span className="font-mono tabular-nums text-zinc-100">{pctWeight(top.weight)}</span>.
          </>
        )}
        {overweightSectors.length > 0 && (
          <>
            {" "}
            Relative to the S&amp;P 500, the book carries more weight in{" "}
            {overweightSectors.map((s) => s.name).join(", ")}.
          </>
        )}
      </Prose>

      <p className="mt-6 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
        Sector data is sourced from Yahoo Finance. Funds are grouped separately because they span
        multiple sectors, and S&amp;P 500 weights are approximate benchmarks. Descriptive only, not
        investment advice.
      </p>
    </Section>
  );
}

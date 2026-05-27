"use client";

import { useState, useMemo, useCallback } from "react";
import { BarChart2, Search, ChevronUp, ChevronDown, Filter, ArrowUpDown, Lightbulb, X, Loader2 } from "lucide-react";
import { useScreener, type ScreenerStock } from "@/hooks/useScreener";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent, changePillClass } from "@/lib/formatters";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";

// ── Filter config ────────────────────────────────────────────────────────────

const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Communication Services",
  "Energy",
  "Industrials",
];

interface Filters {
  search: string;
  sectors: Set<string>;
  peMin: string;
  peMax: string;
  capMin: string;      // billions
  capMax: string;
  divYieldMin: string;  // percent
  betaMax: string;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  sectors: new Set<string>(),
  peMin: "",
  peMax: "",
  capMin: "",
  capMax: "",
  divYieldMin: "",
  betaMax: "",
};

type SortKey = "ticker" | "name" | "sector" | "market_cap" | "trailing_pe" | "forward_pe" | "dividend_yield" | "beta" | "profit_margins" | "price" | "change_pct";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMarketCap(v: number | null): string {
  if (v == null) return " -";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function capLabel(v: number | null): string {
  if (v == null) return "";
  if (v >= 200e9) return "Mega";
  if (v >= 10e9) return "Large";
  if (v >= 2e9) return "Mid";
  if (v >= 300e6) return "Small";
  return "Micro";
}

function formatRatio(v: number | null, decimals = 1): string {
  if (v == null) return " -";
  return v.toFixed(decimals);
}

function formatYield(v: number | null): string {
  if (v == null) return " -";
  return `${(v * 100).toFixed(2)}%`;
}

function formatMargin(v: number | null): string {
  if (v == null) return " -";
  return `${(v * 100).toFixed(1)}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScreenerPage() {
  const { stocks, isLoading, error } = useScreener();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("market_cap");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [customStocks, setCustomStocks] = useState<ScreenerStock[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookupTicker = useCallback(async (ticker: string) => {
    const t = ticker.toUpperCase().trim();
    if (!t) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const result = await api.get<ScreenerStock>(`/screener/lookup/${t}`);
      setCustomStocks((prev) => {
        const exists = prev.some((s) => s.ticker === t) || stocks.some((s) => s.ticker === t);
        return exists ? prev : [result, ...prev];
      });
      setSelectedTicker(t);
    } catch {
      setLookupError(`"${t}" not found  - check the ticker symbol`);
    } finally {
      setLookupLoading(false);
    }
  }, [stocks]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSector(s: string) {
    setFilters((prev) => {
      const next = new Set(prev.sectors);
      if (next.has(s)) next.delete(s); else next.add(s);
      return { ...prev, sectors: next };
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "name" || key === "sector" ? "asc" : "desc");
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  // ── Apply filters ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const allStocks = [...customStocks.filter(c => !stocks.some(s => s.ticker === c.ticker)), ...stocks];
    let list = [...allStocks];

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          (s.name || "").toLowerCase().includes(q) ||
          (s.sector || "").toLowerCase().includes(q) ||
          (s.industry || "").toLowerCase().includes(q),
      );
    }

    // Sector
    if (filters.sectors.size > 0) {
      list = list.filter((s) => s.sector && filters.sectors.has(s.sector));
    }

    // P/E
    if (filters.peMin) {
      const min = Number(filters.peMin);
      list = list.filter((s) => s.trailing_pe != null && s.trailing_pe >= min);
    }
    if (filters.peMax) {
      const max = Number(filters.peMax);
      list = list.filter((s) => s.trailing_pe != null && s.trailing_pe <= max);
    }

    // Market cap (input in billions)
    if (filters.capMin) {
      const min = Number(filters.capMin) * 1e9;
      list = list.filter((s) => s.market_cap != null && s.market_cap >= min);
    }
    if (filters.capMax) {
      const max = Number(filters.capMax) * 1e9;
      list = list.filter((s) => s.market_cap != null && s.market_cap <= max);
    }

    // Dividend yield (input in percent)
    if (filters.divYieldMin) {
      const min = Number(filters.divYieldMin) / 100;
      list = list.filter((s) => s.dividend_yield != null && s.dividend_yield >= min);
    }

    // Beta
    if (filters.betaMax) {
      const max = Number(filters.betaMax);
      list = list.filter((s) => s.beta != null && s.beta <= max);
    }

    // Sort
    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    return list;
  }, [stocks, customStocks, filters, sortKey, sortDir]);

  const hasActiveFilters =
    filters.search || filters.sectors.size > 0 || filters.peMin || filters.peMax || filters.capMin || filters.capMax || filters.divYieldMin || filters.betaMax;

  // ── Unique sectors from actual data ────────────────────────────────────────

  const availableSectors = useMemo(() => {
    const s = new Set<string>();
    stocks.forEach((stock) => { if (stock.sector) s.add(stock.sector); });
    return Array.from(s).sort();
  }, [stocks]);

  if (error) return <ErrorState message="Failed to load screener data." onRetry={() => window.location.reload()} />;

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-vela-teal" />
          Screener
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Filter {stocks.length} stocks by fundamentals, valuation, and risk metrics
        </p>
      </div>

      {/* Search + Filter toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => { updateFilter("search", e.target.value); setLookupError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filters.search.trim()) {
                lookupTicker(filters.search.trim());
              }
            }}
            placeholder="Search universe or type any ticker + Enter to look up..."
            className="input-field w-full pl-9"
          />
          {lookupLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            showFilters || hasActiveFilters
              ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-transparent"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-vela-teal" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Lookup hint / error */}
      {lookupError && (
        <p className="text-xs text-rose-400 flex items-center gap-1.5">
          <X className="w-3 h-3" />{lookupError}
        </p>
      )}
      {!lookupError && filters.search && filtered.length === 0 && !isLoading && !lookupLoading && (
        <p className="text-xs text-zinc-500">
          No results in universe.{" "}
          <button
            onClick={() => lookupTicker(filters.search)}
            className="text-vela-teal hover:underline"
          >
            Look up &quot;{filters.search.toUpperCase()}&quot; directly →
          </button>
        </p>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <div className="vela-card space-y-4">
          {/* Market Cap Quick Filters */}
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-2 block">Market Cap</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Mega ($200B+)", min: "200", max: "" },
                { label: "Large ($10-200B)", min: "10", max: "200" },
                { label: "Mid ($2-10B)", min: "2", max: "10" },
                { label: "Small (<$2B)", min: "", max: "2" },
              ].map((preset) => {
                const isActive = filters.capMin === preset.min && filters.capMax === preset.max;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      if (isActive) {
                        updateFilter("capMin", "");
                        updateFilter("capMax", "");
                      } else {
                        setFilters((prev) => ({ ...prev, capMin: preset.min, capMax: preset.max }));
                      }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      isActive
                        ? "bg-vela-teal/15 text-vela-teal"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-2 block">Sector</label>
            <div className="flex flex-wrap gap-2">
              {(availableSectors.length > 0 ? availableSectors : SECTORS).map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSector(s)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    filters.sectors.has(s)
                      ? "bg-vela-teal/15 text-vela-teal"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">P/E min</label>
              <input
                type="number"
                value={filters.peMin}
                onChange={(e) => updateFilter("peMin", e.target.value)}
                placeholder="0"
                className="input-field w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">P/E max</label>
              <input
                type="number"
                value={filters.peMax}
                onChange={(e) => updateFilter("peMax", e.target.value)}
                placeholder="100"
                className="input-field w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Mkt cap min ($B)</label>
              <input
                type="number"
                value={filters.capMin}
                onChange={(e) => updateFilter("capMin", e.target.value)}
                placeholder="0"
                className="input-field w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Mkt cap max ($B)</label>
              <input
                type="number"
                value={filters.capMax}
                onChange={(e) => updateFilter("capMax", e.target.value)}
                placeholder="5000"
                className="input-field w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Min dividend yield (%)</label>
              <input
                type="number"
                value={filters.divYieldMin}
                onChange={(e) => updateFilter("divYieldMin", e.target.value)}
                placeholder="0"
                step="0.1"
                className="input-field w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Max beta</label>
              <input
                type="number"
                value={filters.betaMax}
                onChange={(e) => updateFilter("betaMax", e.target.value)}
                placeholder="3.0"
                step="0.1"
                className="input-field w-full tabular"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {isLoading ? "Loading..." : `${filtered.length} stocks`}
          {hasActiveFilters && ` (filtered from ${stocks.length})`}
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="vela-card p-0 overflow-hidden">
          <div className="space-y-0">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-vela-border last:border-0">
                <div className="skeleton h-4 w-14" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="vela-card text-center py-16">
          <BarChart2 className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-200 mb-1">No matches</h2>
          <p className="text-sm text-zinc-500">Adjust your filters to see more stocks</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {/* Sort bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {(["market_cap", "price", "change_pct", "trailing_pe", "dividend_yield"] as SortKey[]).map((key) => {
                const labels: Record<string, string> = { market_cap: "Cap", price: "Price", change_pct: "Day %", trailing_pe: "P/E", dividend_yield: "Yield" };
                const active = sortKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => toggleSort(key)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                      active ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {labels[key]}
                    {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {filtered.map((stock) => (
                <MobileStockCard key={stock.ticker} stock={stock} onClick={() => setSelectedTicker(stock.ticker)} />
              ))}
            </div>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block vela-card p-0 overflow-hidden" style={{ maxHeight: "70vh" }}>
            <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-vela-border">
                    <SortHeader label="Ticker" sortKey="ticker" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                    <SortHeader label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                    <SortHeader label="Sector" sortKey="sector" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" className="hidden lg:table-cell" />
                    <SortHeader label="Price" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Day" sortKey="change_pct" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Mkt Cap" sortKey="market_cap" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="P/E" sortKey="trailing_pe" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Fwd P/E" sortKey="forward_pe" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                    <SortHeader label="Yield" sortKey="dividend_yield" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Beta" sortKey="beta" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                    <SortHeader label="Margin" sortKey="profit_margins" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((stock) => (
                    <StockRow key={stock.ticker} stock={stock} onClick={() => setSelectedTicker(stock.ticker)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Insights */}
      {!isLoading && filtered.length > 0 && (
        <ScreenerInsights stocks={filtered} />
      )}

      {/* Ticker detail modal */}
      <TickerDetailModal
        ticker={selectedTicker}
        open={!!selectedTicker}
        onOpenChange={(open) => { if (!open) setSelectedTicker(null); }}
      />
    </PageTransition>
    </TierGate>
  );
}


// ── Sort Header ──────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2.5 font-medium text-xs cursor-pointer select-none transition-colors hover:text-zinc-100 ${
        active ? "text-vela-teal" : "text-zinc-500"
      } ${align === "left" ? "text-left" : "text-right"} ${className}`}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );
}


// ── Stock Row ────────────────────────────────────────────────────────────────

function StockRow({ stock, onClick }: { stock: ScreenerStock; onClick?: () => void }) {
  const from52Low =
    stock.price != null && stock.fifty_two_week_low != null && stock.fifty_two_week_high != null
      ? ((stock.price - stock.fifty_two_week_low) / (stock.fifty_two_week_high - stock.fifty_two_week_low)) * 100
      : null;

  return (
    <tr className="border-b border-vela-border last:border-0 hover:bg-zinc-800/40 transition-colors cursor-pointer" onClick={onClick}>
      {/* Ticker */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-100">{stock.ticker}</span>
          {stock.market_cap != null && (
            <span className="text-[9px] font-medium text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded hidden sm:inline">
              {capLabel(stock.market_cap)}
            </span>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="px-3 py-2.5 text-zinc-400 max-w-[180px] truncate hidden sm:table-cell">
        {stock.name || " -"}
      </td>

      {/* Sector */}
      <td className="px-3 py-2.5 text-zinc-500 text-xs hidden lg:table-cell">
        {stock.sector || " -"}
      </td>

      {/* Price */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-100 font-medium">
        {stock.price != null ? `$${stock.price.toFixed(2)}` : " -"}
      </td>

      {/* Day Change */}
      <td className="px-3 py-2.5 text-right">
        {stock.change_pct != null ? (
          <span className={changePillClass(stock.change_pct)}>
            {formatPercent(stock.change_pct)}
          </span>
        ) : (
          <span className="text-zinc-600"> -</span>
        )}
      </td>

      {/* Market Cap */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-300">
        {formatMarketCap(stock.market_cap)}
      </td>

      {/* P/E */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-300">
        {formatRatio(stock.trailing_pe)}
      </td>

      {/* Forward P/E */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-400 hidden xl:table-cell">
        {formatRatio(stock.forward_pe)}
      </td>

      {/* Div Yield */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-300">
        {formatYield(stock.dividend_yield)}
      </td>

      {/* Beta */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-400 hidden lg:table-cell">
        {formatRatio(stock.beta)}
      </td>

      {/* Profit Margin */}
      <td className="px-3 py-2.5 text-right tabular text-zinc-400 hidden xl:table-cell">
        {formatMargin(stock.profit_margins)}
      </td>
    </tr>
  );
}


// ── Mobile Stock Card ─────────────────────────────────────────────────────────

function MobileStockCard({ stock, onClick }: { stock: ScreenerStock; onClick?: () => void }) {
  return (
    <div className="vela-card py-3 px-4 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{stock.ticker}</span>
            {stock.market_cap != null && (
              <span className="text-[9px] font-medium text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                {capLabel(stock.market_cap)}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{stock.name || " -"}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-sm font-semibold tabular text-zinc-100">
            {stock.price != null ? `$${stock.price.toFixed(2)}` : " -"}
          </p>
          {stock.change_pct != null ? (
            <span className={changePillClass(stock.change_pct) + " text-[10px]"}>
              {formatPercent(stock.change_pct)}
            </span>
          ) : (
            <span className="text-xs text-zinc-600"> -</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
        <span>Cap: {formatMarketCap(stock.market_cap)}</span>
        <span>P/E: {formatRatio(stock.trailing_pe)}</span>
        <span>Yield: {formatYield(stock.dividend_yield)}</span>
        {stock.profit_margins != null && (
          <span>Margin: {formatMargin(stock.profit_margins)}</span>
        )}
      </div>
    </div>
  );
}


// ── Screener Insights ────────────────────────────────────────────────────────

function ScreenerInsights({ stocks }: { stocks: ScreenerStock[] }) {
  const insights: { title: string; body: string }[] = [];

  // Highest dividend yield
  const topDividend = [...stocks]
    .filter((s) => s.dividend_yield != null && s.dividend_yield > 0)
    .sort((a, b) => (b.dividend_yield ?? 0) - (a.dividend_yield ?? 0))[0];
  if (topDividend) {
    insights.push({
      title: `Highest yield: ${topDividend.ticker} at ${formatYield(topDividend.dividend_yield)}`,
      body: `Among the stocks in your current view, ${topDividend.ticker} offers the highest dividend yield. `
        + `A ${formatYield(topDividend.dividend_yield)} yield on a ${formatMarketCap(topDividend.market_cap)} company `
        + `${(topDividend.dividend_yield ?? 0) > 0.03 ? "is attractive for income-focused portfolios" : "is modest but adds up over time"}. `
        + `Always check the payout ratio  - high yields from companies with unsustainable payouts can signal a cut ahead.`,
    });
  }

  // Lowest P/E (value play)
  const valuePlays = [...stocks]
    .filter((s) => s.trailing_pe != null && s.trailing_pe > 0 && s.trailing_pe < 15)
    .sort((a, b) => (a.trailing_pe ?? 0) - (b.trailing_pe ?? 0));
  if (valuePlays.length > 0) {
    const names = valuePlays.slice(0, 3).map((s) => s.ticker).join(", ");
    insights.push({
      title: `Value candidates: ${names}`,
      body: `These stocks trade at trailing P/E ratios below 15  - cheaper than the S&P 500 average of ~22. `
        + `Low P/E can mean the market is undervaluing the business, or it can reflect slow growth expectations. `
        + `Use the Reverse DCF tool to check what growth rate the market is pricing in  - if it's too pessimistic, `
        + `there may be an opportunity.`,
    });
  }

  // Highest beta
  const highBeta = [...stocks]
    .filter((s) => s.beta != null && s.beta > 1.5)
    .sort((a, b) => (b.beta ?? 0) - (a.beta ?? 0));
  if (highBeta.length > 0) {
    const names = highBeta.slice(0, 3).map((s) => s.ticker).join(", ");
    insights.push({
      title: `High beta: ${names}`,
      body: `These stocks move significantly more than the market. A beta above 1.5 means when the S&P drops 10%, `
        + `these could drop 15%+. Great for upside in bull markets, but consider your goals timeline  - if you need `
        + `money within 2-3 years, high-beta holdings add unnecessary risk. Check your portfolio's overall beta `
        + `with the Performance & Risk metrics.`,
    });
  }

  // Best margins
  const highMargin = [...stocks]
    .filter((s) => s.profit_margins != null && s.profit_margins > 0.30)
    .sort((a, b) => (b.profit_margins ?? 0) - (a.profit_margins ?? 0));
  if (highMargin.length > 0 && highMargin.length <= 10) {
    const names = highMargin.slice(0, 3).map((s) => s.ticker).join(", ");
    insights.push({
      title: `Profit powerhouses: ${names}`,
      body: `Companies with 30%+ profit margins typically have strong pricing power and competitive moats. `
        + `They're better positioned to weather economic downturns because they have room to absorb cost increases `
        + `without going unprofitable. Higher margins also mean more free cash flow to return to shareholders `
        + `or reinvest in growth.`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="vela-card bg-zinc-900/50 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-vela-teal" />
        What stands out
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-zinc-400">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-300">{insight.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

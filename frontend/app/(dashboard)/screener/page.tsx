"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, ChevronUp, ChevronDown, ArrowUpDown, X, Loader2 } from "lucide-react";
import { useScreener, type ScreenerStock } from "@/hooks/useScreener";
import { api } from "@/lib/api";
import { formatPercent } from "@/lib/formatters";
import TickerDetailModal from "@/components/shared/TickerDetailModal";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import ErrorState from "@/components/shared/ErrorState";
import { TopBar, PageHero, Section, Eyebrow, Prose, PillGroup } from "@/components/instrument";

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

type CapKey = "all" | "mega" | "large" | "mid" | "small" | "custom";

const CAP_PRESETS: { key: CapKey; label: string; min: string; max: string }[] = [
  { key: "all", label: "All", min: "", max: "" },
  { key: "mega", label: "Mega 200B+", min: "200", max: "" },
  { key: "large", label: "Large 10-200B", min: "10", max: "200" },
  { key: "mid", label: "Mid 2-10B", min: "2", max: "10" },
  { key: "small", label: "Small <2B", min: "", max: "2" },
];

type SortKey = "ticker" | "name" | "sector" | "market_cap" | "trailing_pe" | "forward_pe" | "dividend_yield" | "beta" | "profit_margins" | "price" | "change_pct";
type SortDir = "asc" | "desc";

const MOBILE_SORTS: { key: SortKey; label: string }[] = [
  { key: "market_cap", label: "Cap" },
  { key: "price", label: "Price" },
  { key: "change_pct", label: "Day" },
  { key: "trailing_pe", label: "P/E" },
  { key: "dividend_yield", label: "Yield" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMarketCap(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function capLabel(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "";
  if (v >= 200e9) return "Mega";
  if (v >= 10e9) return "Large";
  if (v >= 2e9) return "Mid";
  if (v >= 300e6) return "Small";
  return "Micro";
}

function formatRatio(v: number | null, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function formatYield(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function formatMargin(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const filterInputClass =
  "w-full rounded bg-vela-card border border-vela-border px-2.5 py-1.5 " +
  "font-mono text-[13px] tabular-nums text-zinc-100 placeholder-vela-muted " +
  "outline-none transition-colors focus:border-vela-teal/60";

function chipClass(active: boolean): string {
  return `rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
    active
      ? "bg-vela-teal/15 border-vela-teal/40 text-vela-teal"
      : "border-vela-border text-vela-muted hover:text-zinc-100 hover:border-vela-teal/30"
  }`;
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
      setLookupError(`"${t}" not found. Check the ticker symbol.`);
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

  function applyCapPreset(key: CapKey) {
    const preset = CAP_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setFilters((prev) => ({ ...prev, capMin: preset.min, capMax: preset.max }));
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

  const hasActiveFilters = Boolean(
    filters.search || filters.sectors.size > 0 || filters.peMin || filters.peMax ||
    filters.capMin || filters.capMax || filters.divYieldMin || filters.betaMax,
  );

  const activeCapPreset: CapKey =
    CAP_PRESETS.find((p) => p.min === filters.capMin && p.max === filters.capMax)?.key ?? "custom";

  // ── Unique sectors from actual data ────────────────────────────────────────

  const availableSectors = useMemo(() => {
    const s = new Set<string>();
    stocks.forEach((stock) => { if (stock.sector) s.add(stock.sector); });
    return Array.from(s).sort();
  }, [stocks]);

  if (error) return <ErrorState message="Failed to load screener data." onRetry={() => window.location.reload()} />;

  const filterControls = (
    <div className="flex items-center gap-3">
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider
            text-vela-muted hover:text-zinc-100 transition-colors"
        >
          <X className="w-3 h-3 shrink-0" /> Clear
        </button>
      )}
      <button
        onClick={() => setShowFilters(!showFilters)}
        aria-expanded={showFilters}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border
          font-mono text-[10px] uppercase tracking-wider transition-colors ${
          showFilters || hasActiveFilters
            ? "bg-vela-teal/10 border-vela-teal/30 text-vela-teal"
            : "border-vela-border text-vela-muted hover:text-zinc-100 hover:border-vela-teal/40"
        }`}
      >
        Filters
        {hasActiveFilters && <span aria-hidden="true" className="w-1.5 h-1.5 rotate-45 bg-vela-teal" />}
      </button>
    </div>
  );

  return (
    <TierGate requiredTier="voyager">
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "Screener" }]}
        note={isLoading ? "loading universe" : `${stocks.length} names in universe`}
      />

      <PageHero
        title="Screener"
        meta="Fundamentals, valuation, risk"
        figure={isLoading ? undefined : filtered.length.toLocaleString()}
        figureSub={isLoading ? undefined : hasActiveFilters ? `of ${stocks.length} names` : "names in view"}
        figureSubClass="text-vela-body"
      />

      {/* ── Search + filters ─────────────────────────────────────────────── */}

      <Section
        label="Search"
        prose="Type to filter the universe, or enter any ticker and press Enter to look it up directly."
        controls={filterControls}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vela-muted pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => { updateFilter("search", e.target.value); setLookupError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filters.search.trim()) {
                lookupTicker(filters.search.trim());
              }
            }}
            placeholder="Ticker, company, or sector"
            aria-label="Search the screener universe"
            className="w-full rounded bg-vela-card border border-vela-border pl-9 pr-10 py-2.5
              text-sm text-zinc-100 placeholder-vela-muted outline-none transition-colors
              focus:border-vela-teal/60"
          />
          {lookupLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vela-teal animate-spin" />
          )}
        </div>

        {/* Lookup hint / error */}
        {lookupError && (
          <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-loss">
            <X className="w-3 h-3 shrink-0" />{lookupError}
          </p>
        )}
        {!lookupError && filters.search && filtered.length === 0 && !isLoading && !lookupLoading && (
          <p className="mt-2.5 text-[13px] text-vela-body">
            No results in the universe.{" "}
            <button
              onClick={() => lookupTicker(filters.search)}
              className="text-vela-teal hover:underline"
            >
              Look up &quot;{filters.search.toUpperCase()}&quot; directly →
            </button>
          </p>
        )}

        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-5 border-t border-vela-border pt-5 space-y-5">
            {/* Market cap */}
            <div>
              <Eyebrow>Market cap</Eyebrow>
              <div className="mt-2 overflow-x-auto pb-1">
                <PillGroup
                  options={CAP_PRESETS.map((p) => ({ key: p.key, label: p.label }))}
                  value={activeCapPreset}
                  onChange={applyCapPreset}
                  ariaLabel="Market cap band"
                />
              </div>
            </div>

            {/* Sectors */}
            <div>
              <Eyebrow>Sector</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(availableSectors.length > 0 ? availableSectors : SECTORS).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSector(s)}
                    aria-pressed={filters.sectors.has(s)}
                    className={chipClass(filters.sectors.has(s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Numeric filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-4">
              <NumericFilter
                label="P/E min"
                value={filters.peMin}
                placeholder="0"
                onChange={(v) => updateFilter("peMin", v)}
              />
              <NumericFilter
                label="P/E max"
                value={filters.peMax}
                placeholder="100"
                onChange={(v) => updateFilter("peMax", v)}
              />
              <NumericFilter
                label="Cap min $B"
                value={filters.capMin}
                placeholder="0"
                onChange={(v) => updateFilter("capMin", v)}
              />
              <NumericFilter
                label="Cap max $B"
                value={filters.capMax}
                placeholder="5000"
                onChange={(v) => updateFilter("capMax", v)}
              />
              <NumericFilter
                label="Min yield %"
                value={filters.divYieldMin}
                placeholder="0"
                step="0.1"
                onChange={(v) => updateFilter("divYieldMin", v)}
              />
              <NumericFilter
                label="Max beta"
                value={filters.betaMax}
                placeholder="3.0"
                step="0.1"
                onChange={(v) => updateFilter("betaMax", v)}
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── Results ──────────────────────────────────────────────────────── */}

      <Section
        label="Results"
        labelAside={
          isLoading
            ? "loading"
            : hasActiveFilters
              ? `— ${filtered.length} of ${stocks.length}`
              : `— ${filtered.length}`
        }
      >
        {isLoading ? (
          <div className="border-y border-vela-border divide-y divide-vela-border">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="skeleton h-4 w-14" />
                <div className="skeleton h-4 w-32 hidden sm:block" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-12 hidden sm:block" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-vela-border px-6 py-14 text-center">
            <Eyebrow>No matches</Eyebrow>
            <Prose className="mt-2.5 mx-auto max-w-[340px]">
              Nothing in the universe fits the current filters. Widen a range or clear the filters to see more.
            </Prose>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden">
              {/* Sort bar */}
              <div className="overflow-x-auto pb-2 -mx-1 px-1">
                <PillGroup
                  options={MOBILE_SORTS.map((s) => ({
                    key: s.key,
                    label:
                      sortKey === s.key
                        ? `${s.label} ${sortDir === "asc" ? "↑" : "↓"}`
                        : s.label,
                  }))}
                  value={sortKey}
                  onChange={toggleSort}
                  ariaLabel="Sort results"
                />
              </div>
              <div
                className="border-y border-vela-border divide-y divide-vela-border"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                {filtered.map((stock) => (
                  <MobileStockRow key={stock.ticker} stock={stock} onClick={() => setSelectedTicker(stock.ticker)} />
                ))}
              </div>
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block border border-vela-border rounded overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "70vh" }}>
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10 bg-vela-bg">
                    <tr className="border-b border-vela-border">
                      <SortHeader label="Ticker" sortKey="ticker" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                      <SortHeader label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                      <SortHeader label="Sector" sortKey="sector" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" className="hidden lg:table-cell" />
                      <SortHeader label="Price" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortHeader label="Day" sortKey="change_pct" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortHeader label="Mkt cap" sortKey="market_cap" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
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
      </Section>

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


// ── Numeric filter ───────────────────────────────────────────────────────────

function NumericFilter({
  label,
  value,
  placeholder,
  step,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  step?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className={filterInputClass}
      />
    </label>
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
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]
        cursor-pointer select-none transition-colors hover:text-zinc-100 ${
        active ? "text-vela-teal" : "text-vela-muted"
      } ${align === "left" ? "text-left" : "text-right"} ${className}`}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 shrink-0 text-vela-subtle" />
        )}
      </div>
    </th>
  );
}


// ── Stock Row ────────────────────────────────────────────────────────────────

function changeClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-vela-muted";
  if (v > 0) return "text-gain";
  if (v < 0) return "text-loss";
  return "text-vela-body";
}

function StockRow({ stock, onClick }: { stock: ScreenerStock; onClick?: () => void }) {
  return (
    <tr
      className="border-b border-vela-border last:border-0 transition-colors cursor-pointer hover:bg-vela-teal/[0.04]"
      onClick={onClick}
    >
      {/* Ticker */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium tracking-wide text-zinc-100">{stock.ticker}</span>
          {stock.market_cap != null && (
            <span className="hidden sm:inline rounded border border-vela-border px-1.5 py-0.5
              font-mono text-[9px] uppercase tracking-wider text-vela-muted">
              {capLabel(stock.market_cap)}
            </span>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="px-3 py-2.5 text-vela-body max-w-[180px] truncate hidden sm:table-cell">
        {stock.name || "—"}
      </td>

      {/* Sector */}
      <td className="px-3 py-2.5 text-vela-muted text-xs hidden lg:table-cell">
        {stock.sector || "—"}
      </td>

      {/* Price */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-100">
        {stock.price != null ? `$${stock.price.toFixed(2)}` : "—"}
      </td>

      {/* Day Change */}
      <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${changeClass(stock.change_pct)}`}>
        {stock.change_pct != null ? formatPercent(stock.change_pct) : "—"}
      </td>

      {/* Market Cap */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body">
        {formatMarketCap(stock.market_cap)}
      </td>

      {/* P/E */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body">
        {formatRatio(stock.trailing_pe)}
      </td>

      {/* Forward P/E */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body hidden xl:table-cell">
        {formatRatio(stock.forward_pe)}
      </td>

      {/* Div Yield */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body">
        {formatYield(stock.dividend_yield)}
      </td>

      {/* Beta */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body hidden lg:table-cell">
        {formatRatio(stock.beta)}
      </td>

      {/* Profit Margin */}
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-vela-body hidden xl:table-cell">
        {formatMargin(stock.profit_margins)}
      </td>
    </tr>
  );
}


// ── Mobile Stock Row ─────────────────────────────────────────────────────────

function MobileStockRow({ stock, onClick }: { stock: ScreenerStock; onClick?: () => void }) {
  return (
    <div className="py-3 cursor-pointer transition-colors hover:bg-vela-teal/[0.04]" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] font-medium tracking-wide text-zinc-100">
              {stock.ticker}
            </span>
            {stock.market_cap != null && (
              <span className="rounded border border-vela-border px-1.5 py-0.5
                font-mono text-[9px] uppercase tracking-wider text-vela-muted">
                {capLabel(stock.market_cap)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-vela-body truncate">{stock.name || "—"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[14px] tabular-nums text-zinc-100">
            {stock.price != null ? `$${stock.price.toFixed(2)}` : "—"}
          </p>
          <p className={`mt-0.5 font-mono text-[11px] tabular-nums ${changeClass(stock.change_pct)}`}>
            {stock.change_pct != null ? formatPercent(stock.change_pct) : "—"}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] tabular-nums text-vela-muted">
        <span>Cap {formatMarketCap(stock.market_cap)}</span>
        <span aria-hidden="true" className="text-vela-subtle">/</span>
        <span>P/E {formatRatio(stock.trailing_pe)}</span>
        <span aria-hidden="true" className="text-vela-subtle">/</span>
        <span>Yield {formatYield(stock.dividend_yield)}</span>
        {stock.profit_margins != null && (
          <>
            <span aria-hidden="true" className="text-vela-subtle">/</span>
            <span>Margin {formatMargin(stock.profit_margins)}</span>
          </>
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
        + `${(topDividend.dividend_yield ?? 0) > 0.03 ? "sits at the income-focused end of the range" : "is modest but adds up over time"}. `
        + `Always check the payout ratio. High yields from companies with unsustainable payouts can signal a cut ahead.`,
    });
  }

  // Lowest P/E (value play)
  const valuePlays = [...stocks]
    .filter((s) => s.trailing_pe != null && s.trailing_pe > 0 && s.trailing_pe < 15)
    .sort((a, b) => (a.trailing_pe ?? 0) - (b.trailing_pe ?? 0));
  if (valuePlays.length > 0) {
    const names = valuePlays.slice(0, 3).map((s) => s.ticker).join(", ");
    insights.push({
      title: `Low multiples: ${names}`,
      body: `These stocks trade at trailing P/E ratios below 15, cheaper than the S&P 500 average of roughly 22. `
        + `A low P/E can mean the market is undervaluing the business, or it can reflect slow growth expectations. `
        + `Use the Reverse DCF tool to check what growth rate the market is pricing in.`,
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
      body: `These stocks move significantly more than the market. A beta above 1.5 means that when the S&P drops 10%, `
        + `these could drop 15% or more. That cuts both ways against your goals timeline: money you need within `
        + `2 to 3 years sits in a shorter window than high-beta swings tend to resolve in. You can check your `
        + `portfolio's overall beta in Performance and Risk.`,
    });
  }

  // Best margins
  const highMargin = [...stocks]
    .filter((s) => s.profit_margins != null && s.profit_margins > 0.30)
    .sort((a, b) => (b.profit_margins ?? 0) - (a.profit_margins ?? 0));
  if (highMargin.length > 0 && highMargin.length <= 10) {
    const names = highMargin.slice(0, 3).map((s) => s.ticker).join(", ");
    insights.push({
      title: `Wide margins: ${names}`,
      body: `Companies with margins above 30% typically have strong pricing power and competitive moats. `
        + `They have more room to absorb cost increases without going unprofitable, and higher margins also mean `
        + `more free cash flow to return to shareholders or reinvest in growth.`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <Section label="What stands out" prose="Patterns in the names currently in view. Descriptive only, not a recommendation.">
      <div className="border-y border-vela-border divide-y divide-vela-border">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 py-4">
            <span
              aria-hidden="true"
              className="mt-[7px] w-[7px] h-[7px] rotate-45 bg-vela-teal shrink-0"
            />
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-100">
                {insight.title}
              </p>
              <Prose className="mt-1.5 max-w-[640px]">{insight.body}</Prose>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp, TrendingDown,
  FileText, BookOpen, Newspaper, Globe, Target, Wallet, Calculator,
  DollarSign, Sparkles, Coins, Receipt, GraduationCap,
  Activity, Bell, Umbrella, Banknote, Brain, Users, RotateCcw, Settings,
  Scale, BadgePercent, LayoutGrid, Calendar, GitBranch, CreditCard, Shield, Repeat, Trophy,
} from "lucide-react";

// ── Search items ─────────────────────────────────────────────────────────────

interface SearchItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  group: string;
}

const ITEMS: SearchItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "summary"], group: "Main" },
  { label: "Portfolio", href: "/portfolio", icon: PieChart, keywords: ["holdings", "stocks", "positions", "equities"], group: "Equities" },
  { label: "Dividends", href: "/dividends", icon: Coins, keywords: ["income", "yield", "payout", "ex-date"], group: "Equities" },
  { label: "Watchlist", href: "/watchlist", icon: Eye, keywords: ["watch", "track", "monitor"], group: "Equities" },
  { label: "Rebalance", href: "/rebalance", icon: Scale, keywords: ["rebalance", "allocation", "drift", "weight"], group: "Equities" },
  { label: "Fee Analyzer", href: "/fees", icon: BadgePercent, keywords: ["fees", "expense ratio", "cost", "etf fees", "fund fees", "drag"], group: "Equities" },
  { label: "Sector Breakdown", href: "/sectors", icon: LayoutGrid, keywords: ["sector", "industry", "diversification", "allocation", "concentration", "technology", "healthcare"], group: "Equities" },
  { label: "Dividend Calendar", href: "/dividend-calendar", icon: Calendar, keywords: ["dividend", "calendar", "monthly", "income", "schedule", "payout"], group: "Equities" },
  { label: "Position Size Calculator", href: "/position-size", icon: Calculator, keywords: ["position", "size", "sizing", "risk", "shares", "stop loss", "kelly"], group: "Equities" },
  { label: "Diversification Score", href: "/correlation", icon: Shield, keywords: ["diversification", "correlation", "overlap", "risk", "hedge", "clusters"], group: "Equities" },
  { label: "Net Worth", href: "/net-worth", icon: Wallet, keywords: ["assets", "liabilities", "balance sheet", "wealth"], group: "Financial Planning" },
  { label: "Cash Flow", href: "/cash-flow", icon: DollarSign, keywords: ["income", "expenses", "savings", "budget", "spending"], group: "Financial Planning" },
  { label: "Expense Breakdown", href: "/expenses", icon: CreditCard, keywords: ["expenses", "spending", "budget", "categories", "50/30/20", "fixed", "variable"], group: "Financial Planning" },
  { label: "Monthly Budget", href: "/budget", icon: Target, keywords: ["budget", "target", "limit", "spending", "track", "over budget"], group: "Financial Planning" },
  { label: "Tax Awareness", href: "/tax", icon: Receipt, keywords: ["tax", "capital gains", "harvest", "loss", "ltcg"], group: "Financial Planning" },
  { label: "Income Streams", href: "/income", icon: Banknote, keywords: ["income", "salary", "revenue", "streams", "earnings"], group: "Financial Planning" },
  { label: "Stress Index", href: "/stress-index", icon: Activity, keywords: ["stress", "anxiety", "health", "financial health"], group: "Financial Planning" },
  { label: "Smart Alerts", href: "/alerts", icon: Bell, keywords: ["alerts", "notifications", "warnings"], group: "Financial Planning" },
  { label: "Subscription Tracker", href: "/subscriptions", icon: Repeat, keywords: ["subscription", "recurring", "netflix", "spotify", "monthly", "annual", "cancel"], group: "Financial Planning" },
  { label: "Behavioral Finance", href: "/behavior", icon: Brain, keywords: ["behavior", "bias", "psychology", "cognitive", "emotions"], group: "Financial Planning" },
  { label: "Goals", href: "/goals", icon: Target, keywords: ["goal", "target", "save for", "plan"], group: "Projections" },
  { label: "Retirement", href: "/retirement", icon: Umbrella, keywords: ["retire", "retirement", "401k", "nest egg", "pension"], group: "Projections" },
  { label: "Portfolio Comparison", href: "/compare", icon: GitBranch, keywords: ["compare", "benchmark", "sp500", "nasdaq", "index", "radar", "growth", "projection"], group: "Projections" },
  { label: "Benchmarking", href: "/benchmark", icon: Users, keywords: ["benchmark", "compare", "percentile", "average", "median"], group: "Projections" },
  { label: "Learn", href: "/learn", icon: GraduationCap, keywords: ["learn", "education", "cards", "tips", "knowledge"], group: "Projections" },
  { label: "Currency Converter", href: "/fx", icon: Globe, keywords: ["currency", "fx", "exchange", "convert", "euro", "pound", "yen", "forex"], group: "News & Markets" },
  { label: "Markets", href: "/markets", icon: Globe, keywords: ["market", "index", "sp500", "nasdaq", "dow"], group: "News & Markets" },
  { label: "Macro", href: "/macro", icon: TrendingUp, keywords: ["macro", "economy", "gdp", "inflation", "rates", "fed"], group: "News & Markets" },
  { label: "News", href: "/news", icon: Newspaper, keywords: ["news", "articles", "headlines"], group: "News & Markets" },
  { label: "Thesis", href: "/thesis", icon: BookOpen, keywords: ["thesis", "research", "notes", "analysis"], group: "Research" },
  { label: "Decision Journal", href: "/journal", icon: FileText, keywords: ["journal", "decision", "log", "trade", "rationale"], group: "Research" },
  { label: "Screener", href: "/screener", icon: BarChart2, keywords: ["screener", "screen", "filter", "stocks", "scan"], group: "Research" },
  { label: "DCF", href: "/valuation/dcf", icon: FileText, keywords: ["dcf", "valuation", "intrinsic", "discount"], group: "Research" },
  { label: "Reverse DCF", href: "/valuation/reverse-dcf", icon: RotateCcw, keywords: ["reverse dcf", "implied", "growth"], group: "Research" },
  { label: "Settings", href: "/settings", icon: Settings, keywords: ["settings", "preferences", "account", "profile"], group: "System" },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ITEMS;
    const q = query.toLowerCase();
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)) ||
        item.group.toLowerCase().includes(q)
    );
  }, [query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      scrollIntoView(Math.min(selectedIndex + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      scrollIntoView(Math.max(selectedIndex - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    }
  }

  function scrollIntoView(index: number) {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <div className="fixed inset-x-0 top-[15%] z-[61] mx-auto w-full max-w-lg px-4">
            <motion.div
              className="bg-vela-card/95 backdrop-blur-md border border-vela-border rounded-lg shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
                <Search className="w-5 h-5 text-vela-teal/60 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages, tools, features..."
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none caret-vela-teal"
                />
                <kbd className="hidden sm:block text-[10px] text-zinc-600 bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.5 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-zinc-500">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  filtered.map((item, i) => {
                    const Icon = item.icon;
                    const isSelected = i === selectedIndex;
                    return (
                      <motion.button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        initial={i < 10 ? { opacity: 0, x: -8 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 ${
                          isSelected
                            ? "bg-vela-teal/10 text-vela-teal shadow-[inset_2px_0_0_0_rgb(26, 168, 187)]"
                            : "text-zinc-300 hover:bg-white/[0.03]"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? "text-vela-teal" : "text-zinc-500"}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        <span className={`text-[10px] transition-colors ${isSelected ? "text-vela-teal/50" : "text-zinc-600"}`}>{item.group}</span>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <ArrowRight className="w-3 h-3 text-vela-teal" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-zinc-600">
                <span>
                  <kbd className="bg-zinc-800/80 border border-zinc-700/60 px-1 py-0.5 rounded">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="bg-zinc-800/80 border border-zinc-700/60 px-1 py-0.5 rounded">↵</kbd> Open
                </span>
                <span>
                  <kbd className="bg-zinc-800/80 border border-zinc-700/60 px-1 py-0.5 rounded">Esc</kbd> Close
                </span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

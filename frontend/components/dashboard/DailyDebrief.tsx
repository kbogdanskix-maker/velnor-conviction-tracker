"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Globe,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { useNewsFeed, type NewsArticle } from "@/hooks/useNews";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useAIStylePrefs } from "@/contexts/AIStyleContext";
import FloatingCard from "@/components/celestial/FloatingCard";

// ── Types ───────────────────────────────────────────────────────────────────

interface DebriefItem {
  icon: typeof TrendingUp;
  iconColor: string;
  headline: string;
  detail: string;
  tickers: string[];
  source: string;
  url: string;
  category: "portfolio" | "macro" | "market";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MACRO_KEYWORDS = [
  "fed", "federal reserve", "interest rate", "inflation", "cpi", "gdp",
  "employment", "jobs", "unemployment", "treasury", "bond", "yield",
  "recession", "stimulus", "tariff", "trade war", "geopolitical",
  "sanctions", "election", "congress", "senate", "regulation",
  "sec ", "ftc", "antitrust", "oil", "opec", "commodity",
];

function isMacroArticle(article: NewsArticle): boolean {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return MACRO_KEYWORDS.some((kw) => text.includes(kw));
}

function isPortfolioArticle(article: NewsArticle, holdingTickers: string[]): boolean {
  return article.tickers.some((t) => holdingTickers.includes(t.toUpperCase()));
}

function categorizeArticle(
  article: NewsArticle,
  holdingTickers: string[],
): "portfolio" | "macro" | "market" {
  if (isPortfolioArticle(article, holdingTickers)) return "portfolio";
  if (isMacroArticle(article)) return "macro";
  return "market";
}

function getItemIcon(category: string): { icon: typeof TrendingUp; color: string } {
  switch (category) {
    case "portfolio":
      return { icon: Briefcase, color: "text-vela-teal" };
    case "macro":
      return { icon: Globe, color: "text-violet-400" };
    default:
      return { icon: TrendingUp, color: "text-amber-400" };
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

// ── Tone formatting ─────────────────────────────────────────────────────────

function formatHeadline(title: string, tone: string): string {
  // Strip source prefixes like "Reuters - " or "Bloomberg: "
  const cleaned = title.replace(/^[A-Za-z\s]+[-:–]\s+/, "");
  switch (tone) {
    case "concise":
      return truncate(cleaned, 60);
    case "casual":
      return cleaned;
    case "encouraging":
      return cleaned;
    default: // professional
      return cleaned;
  }
}

function getDebriefGreeting(tone: string, itemCount: number): string {
  if (itemCount === 0) {
    switch (tone) {
      case "casual": return "Nothing major happening right now. Enjoy the calm.";
      case "concise": return "No notable updates.";
      case "encouraging": return "All quiet on the market front  - a good time to review your strategy!";
      default: return "No significant developments to report at this time.";
    }
  }
  switch (tone) {
    case "casual": return `Here's what's been going on  - ${itemCount} things worth knowing:`;
    case "concise": return `${itemCount} updates:`;
    case "encouraging": return `Stay informed! Here are ${itemCount} developments that matter for your journey:`;
    default: return `Your daily briefing  - ${itemCount} key development${itemCount > 1 ? "s" : ""}:`;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DailyDebrief() {
  const { prefs } = useAIStylePrefs();
  const { articles, isLoading: newsLoading } = useNewsFeed();
  const { summary, hasHoldings } = useDefaultPortfolio();

  const holdingTickers = useMemo(
    () => (summary?.holdings ?? []).map((h: any) => h.ticker.toUpperCase()),
    [summary],
  );

  const debriefItems = useMemo((): DebriefItem[] => {
    if (!articles.length) return [];

    // Categorize all articles
    const categorized = articles.map((a) => ({
      article: a,
      category: categorizeArticle(a, holdingTickers),
    }));

    // Filter based on user preferences
    const filtered = categorized.filter(({ category }) => {
      if (category === "macro" && !prefs.includeMacro) return false;
      if (category === "portfolio" && !prefs.includePortfolioNews) return false;
      return true;
    });

    // Determine max items based on debrief length
    const maxItems =
      prefs.debriefLength === "brief" ? 3 :
      prefs.debriefLength === "detailed" ? 8 : 5;

    // Prioritize: portfolio first, then macro, then market
    const sorted = filtered.sort((a, b) => {
      const order = { portfolio: 0, macro: 1, market: 2 };
      return order[a.category] - order[b.category];
    });

    return sorted.slice(0, maxItems).map(({ article, category }) => {
      const { icon, color } = getItemIcon(category);
      return {
        icon,
        iconColor: color,
        headline: formatHeadline(article.title, prefs.tone),
        detail: truncate(article.summary, prefs.debriefLength === "brief" ? 80 : prefs.debriefLength === "detailed" ? 200 : 120),
        tickers: article.tickers,
        source: article.source,
        url: article.url,
        category,
      };
    });
  }, [articles, holdingTickers, prefs]);

  // Don't render if user disabled debrief
  if (!prefs.showDebrief) return null;

  // Loading state
  if (newsLoading) {
    return (
      <FloatingCard glowColor="rgba(26, 168, 187, 0.06)">
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-4 rounded" />
            <div className="skeleton h-4 w-32" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-4 w-4 rounded mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </FloatingCard>
    );
  }

  const greeting = getDebriefGreeting(prefs.tone, debriefItems.length);

  return (
    <FloatingCard glowColor="rgba(26, 168, 187, 0.08)">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-vela-teal" />
            <h2 className="text-sm font-medium text-zinc-300">Daily Debrief</h2>
          </div>
          <Link
            href="/news"
            className="text-xs text-vela-teal hover:text-vela-teal-dim transition-colors flex items-center gap-0.5"
          >
            Full feed <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Greeting */}
        <p className="text-xs text-zinc-500 mb-4">{greeting}</p>

        {/* Items */}
        {debriefItems.length > 0 && (
          <div className="space-y-3">
            {debriefItems.map((item, i) => (
              <motion.a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 group cursor-pointer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
              >
                <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.iconColor} group-hover:scale-110 transition-transform`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors leading-snug">
                    {item.headline}
                  </p>
                  {prefs.debriefLength !== "brief" && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {item.detail}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-zinc-600">{item.source}</span>
                    {item.tickers.length > 0 && (
                      <div className="flex gap-1">
                        {item.tickers.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              holdingTickers.includes(t.toUpperCase())
                                ? "bg-vela-teal/10 text-vela-teal"
                                : "bg-zinc-800 text-zinc-500"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </FloatingCard>
  );
}

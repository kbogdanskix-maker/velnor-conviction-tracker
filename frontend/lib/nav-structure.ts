import type * as React from "react";
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp,
  FileText, BookOpen, Newspaper, Globe, Compass, Users,
  Target, Calculator, RotateCcw, Coins, Receipt,
  GraduationCap, Activity, Brain, Scale, BadgePercent,
  LayoutGrid, Calendar, GitBranch, Shield,
  ArrowLeftRight, Scissors, MapPin, Star, GitCompare,
  Zap, MessageCircle, StickyNote, Building2, Route, Archive,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Visually quieter, lower-priority section (Planning). */
  secondary?: boolean;
  /** Hidden unless the Lab toggle is on. */
  lab?: boolean;
}

export const NAV_STANDALONE = {
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  guide: { href: "/guide", label: "Guide", icon: Compass },
  profile: { href: "/profile", label: "My Profile", icon: Users },
} satisfies Record<string, NavItem>;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Accuracy & Conviction",
    items: [
      { href: "/portfolio", label: "Positions", icon: PieChart },
      { href: "/journey", label: "Stock Journey", icon: Route },
      { href: "/thesis", label: "Thesis", icon: BookOpen },
      { href: "/reflect", label: "Reflect", icon: Brain },
      { href: "/watchlist", label: "Lookout", icon: Eye },
      { href: "/closed", label: "Closed & Lessons", icon: Archive },
      { href: "/calibration", label: "Calibration", icon: Target },
      { href: "/smart-alerts", label: "Smart Alerts", icon: Zap },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/screener", label: "Screener", icon: BarChart2 },
      { href: "/company", label: "Company Deep-Dive", icon: Building2 },
      { href: "/earnings-insights", label: "Earnings AI", icon: TrendingUp },
      { href: "/valuation/dcf", label: "DCF", icon: FileText },
      { href: "/valuation/reverse-dcf", label: "Reverse DCF", icon: RotateCcw },
    ],
  },
  // Planning group (Net Worth, Cash Flow, Goals, Debt Payoff) removed from nav in the
  // 2026-07 equity-only pivot. Net Worth / Cash Flow / Goals routes are KEPT (they feed
  // Reflect context + dashboard) but hidden from nav; Debt Payoff route was deleted.
  {
    label: "Lab",
    lab: true,
    items: [
      // Equity income + portfolio analytics (kept)
      { href: "/dividends", label: "Dividends", icon: Coins },
      { href: "/dividend-calendar", label: "Div Calendar", icon: Calendar },
      { href: "/dividend-forecast", label: "Div Forecast", icon: TrendingUp },
      { href: "/rebalance", label: "Rebalance", icon: Scale },
      { href: "/fees", label: "Fee Analyzer", icon: BadgePercent },
      { href: "/sectors", label: "Sectors", icon: LayoutGrid },
      { href: "/position-size", label: "Position Size", icon: Calculator },
      { href: "/correlation", label: "Diversification", icon: Shield },
      { href: "/risk", label: "Risk", icon: Activity },
      { href: "/attribution", label: "Attribution", icon: BarChart2 },
      { href: "/returns", label: "Returns", icon: TrendingUp },
      { href: "/tax", label: "Tax Awareness", icon: Receipt },
      { href: "/tax-harvest", label: "Tax Harvest", icon: Scissors },
      { href: "/asset-location", label: "Asset Location", icon: MapPin },
      { href: "/behavior", label: "Behavior", icon: Brain },
      { href: "/compare", label: "Portfolio Comparison", icon: GitBranch },
      { href: "/learn", label: "Learn", icon: GraduationCap },
      { href: "/annual-review", label: "Annual Review", icon: Star },
      { href: "/fx", label: "Currency", icon: ArrowLeftRight },
      { href: "/markets", label: "Markets", icon: Globe },
      { href: "/macro", label: "Macro", icon: TrendingUp },
      { href: "/news", label: "News", icon: Newspaper },
      { href: "/sentiment", label: "Sentiment", icon: MessageCircle },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/journal", label: "Journal", icon: FileText },
      { href: "/stock-compare", label: "Stock Compare", icon: GitCompare },
      // CUT (routes deleted): /plan, /affordability, /insurance, /what-if,
      //   /emergency-fund, /milestones, /debt-payoff
      // HIDDEN (routes kept, off nav): /health-score, /stress-index, /fi,
      //   /monte-carlo, /retirement, /benchmark, /net-worth, /cash-flow, /goals
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
export const ITEM_BY_HREF = new Map(ALL_ITEMS.map((i) => [i.href, i] as const));
export const ALL_HREFS: string[] = ALL_ITEMS.map((i) => i.href);

/** Groups to render given the Lab toggle. Lab groups are dropped when `showLab` is false. */
export function buildNav(showLab: boolean): NavGroup[] {
  return NAV_GROUPS.filter((g) => showLab || !g.lab);
}

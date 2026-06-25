import type * as React from "react";
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp, TrendingDown,
  FileText, BookOpen, Newspaper, Globe, Compass, Users,
  Target, Wallet, Calculator, DollarSign, Sparkles, RotateCcw, Coins, Receipt,
  GraduationCap, Activity, Umbrella, Banknote, Brain, Scale, BadgePercent,
  LayoutGrid, Calendar, GitBranch, CreditCard, Shield, Repeat, Trophy,
  ArrowLeftRight, Flame, Dice5, Scissors, MapPin, Star, GitCompare,
  HeartPulse, Zap, MessageCircle, StickyNote, Building2, Route, Archive,
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
  {
    label: "Planning",
    secondary: true,
    items: [
      { href: "/net-worth", label: "Net Worth", icon: Wallet },
      { href: "/cash-flow", label: "Cash Flow", icon: DollarSign },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/debt-payoff", label: "Debt Payoff", icon: TrendingDown },
    ],
  },
  {
    label: "Lab",
    lab: true,
    items: [
      { href: "/plan", label: "My Plan", icon: Sparkles },
      { href: "/health-score", label: "Health Score", icon: HeartPulse },
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
      { href: "/expenses", label: "Expenses", icon: CreditCard },
      { href: "/budget", label: "Budget", icon: Target },
      { href: "/affordability", label: "Affordability", icon: Calculator },
      { href: "/tax", label: "Tax Awareness", icon: Receipt },
      { href: "/tax-harvest", label: "Tax Harvest", icon: Scissors },
      { href: "/income", label: "Income", icon: Banknote },
      { href: "/insurance", label: "Insurance", icon: Shield },
      { href: "/stress-index", label: "Stress Index", icon: Activity },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/asset-location", label: "Asset Location", icon: MapPin },
      { href: "/behavior", label: "Behavior", icon: Brain },
      { href: "/fi", label: "FI Tracker", icon: Flame },
      { href: "/monte-carlo", label: "Monte Carlo", icon: Dice5 },
      { href: "/retirement", label: "Retirement", icon: Umbrella },
      { href: "/compare", label: "Portfolio Comparison", icon: GitBranch },
      { href: "/benchmark", label: "Benchmark", icon: Users },
      { href: "/what-if", label: "What If", icon: Sparkles },
      { href: "/emergency-fund", label: "Emergency Fund", icon: Shield },
      { href: "/milestones", label: "Milestones", icon: Trophy },
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

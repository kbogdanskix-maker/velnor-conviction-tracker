import {
  PieChart, Wallet, DollarSign, Target, Eye,
  Coins, Calendar, Scale, BadgePercent, LayoutGrid, Calculator, Shield,
  CreditCard, Home, TrendingDown, PiggyBank, Receipt, Banknote, Activity,
  Bell, Repeat, Brain,
  Umbrella, GitBranch, Users, Sparkles, TrendingUp, Trophy, GraduationCap,
  Globe, Newspaper, ArrowLeftRight,
  BookOpen, FileText, BarChart2, RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Onboarding Steps ────────────────────────────────────────────────────────

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  cta: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "portfolio",
    title: "Add your first trade",
    description:
      "Track your stock positions, see real-time P&L, and unlock dividend tracking, tax insights, and behavioral analysis.",
    href: "/portfolio",
    icon: PieChart,
    cta: "Go to Portfolio",
  },
  {
    id: "net-worth",
    title: "Track your net worth",
    description:
      "Add assets and liabilities to see your complete financial picture. This powers the affordability calculator and debt payoff tools.",
    href: "/net-worth",
    icon: Wallet,
    cta: "Add Accounts",
  },
  {
    id: "cash-flow",
    title: "Set up cash flow",
    description:
      "Log your income and expenses to calculate your savings rate. This feeds into budgeting, emergency fund planning, and benchmarking.",
    href: "/cash-flow",
    icon: DollarSign,
    cta: "Add Entries",
  },
  {
    id: "goals",
    title: "Create a financial goal",
    description:
      "Set targets with timelines and monthly contributions. Velnor projects your progress and shows how purchases or debts delay your goals.",
    href: "/goals",
    icon: Target,
    cta: "Set a Goal",
  },
  {
    id: "watchlist",
    title: "Build a watchlist",
    description:
      "Track stocks you're researching. See live quotes, daily changes, and get a quick pulse on the market from your dashboard.",
    href: "/watchlist",
    icon: Eye,
    cta: "Add Tickers",
  },
];

// ── Feature Map ─────────────────────────────────────────────────────────────

export interface FeatureItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  tier?: string;
}

export interface FeatureGroup {
  label: string;
  description: string;
  items: FeatureItem[];
}

export const FEATURE_MAP: FeatureGroup[] = [
  {
    label: "Equities",
    description: "Manage your stock portfolio and analyze holdings",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: PieChart, description: "Track positions, P&L, and transactions" },
      { href: "/dividends", label: "Dividends", icon: Coins, description: "Dividend income, yield, and history" },
      { href: "/dividend-calendar", label: "Div Calendar", icon: Calendar, description: "Upcoming ex-dates and payment schedule" },
      { href: "/drip", label: "DRIP Calc", icon: Coins, description: "Dividend reinvestment growth projections" },
      { href: "/watchlist", label: "Watchlist", icon: Eye, description: "Track stocks you're researching" },
      { href: "/rebalance", label: "Rebalance", icon: Scale, description: "Weight targets and trade suggestions" },
      { href: "/fees", label: "Fee Analyzer", icon: BadgePercent, description: "Expense ratio impact on returns" },
      { href: "/sectors", label: "Sectors", icon: LayoutGrid, description: "Sector allocation breakdown" },
      { href: "/position-size", label: "Position Size", icon: Calculator, description: "Risk-based position sizing" },
      { href: "/correlation", label: "Diversification", icon: Shield, description: "Correlation and concentration analysis" },
    ],
  },
  {
    label: "Financial Planning",
    description: "Budget, plan, and manage your complete finances",
    items: [
      { href: "/net-worth", label: "Net Worth", icon: Wallet, description: "Assets, liabilities, and total net worth" },
      { href: "/cash-flow", label: "Cash Flow", icon: DollarSign, description: "Income, expenses, and savings rate" },
      { href: "/expenses", label: "Expenses", icon: CreditCard, description: "Expense breakdown and analysis" },
      { href: "/budget", label: "Budget", icon: Target, description: "Monthly spending limits per category" },
      { href: "/real-estate", label: "Real Estate", icon: Home, description: "Property valuation and rent-vs-buy" },
      { href: "/affordability", label: "Affordability", icon: Calculator, description: "See how a purchase impacts your goals" },
      { href: "/debt-payoff", label: "Debt Payoff", icon: TrendingDown, description: "Snowball vs avalanche payoff strategies" },
      { href: "/savings", label: "Savings Finder", icon: PiggyBank, description: "HYSA and CD comparison tool" },
      { href: "/tax", label: "Tax Awareness", icon: Receipt, description: "Unrealized gains, holding periods, harvesting" },
      { href: "/income", label: "Income", icon: Banknote, description: "Income sources and projections" },
      { href: "/insurance", label: "Insurance", icon: Shield, description: "Coverage needs calculator" },
      { href: "/stress-index", label: "Stress Index", icon: Activity, description: "Financial health score" },
      { href: "/alerts", label: "Alerts", icon: Bell, description: "Price and portfolio alerts" },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat, description: "Track recurring costs" },
      { href: "/behavior", label: "Behavior", icon: Brain, description: "Detect cognitive biases in your investing" },
    ],
  },
  {
    label: "Projections",
    description: "Model your financial future and compare scenarios",
    items: [
      { href: "/goals", label: "Goals", icon: Target, description: "Set targets with CAGR-based projections" },
      { href: "/retirement", label: "Retirement", icon: Umbrella, description: "Retirement readiness calculator" },
      { href: "/compare", label: "Compare", icon: GitBranch, description: "Side-by-side scenario comparison" },
      { href: "/benchmark", label: "Benchmark", icon: Users, description: "Compare your finances to peers" },
      { href: "/what-if", label: "What If", icon: Sparkles, description: "Simulate life changes on your finances" },
      { href: "/growth-calc", label: "Growth Calc", icon: TrendingUp, description: "Compound growth calculator" },
      { href: "/emergency-fund", label: "Emergency Fund", icon: Shield, description: "How many months can you cover?" },
      { href: "/milestones", label: "Milestones", icon: Trophy, description: "Track financial milestones unlocked" },
      { href: "/learn", label: "Learn", icon: GraduationCap, description: "Financial education cards tailored to you" },
    ],
  },
  {
    label: "News & Markets",
    description: "Stay informed on markets and macro trends",
    items: [
      { href: "/fx", label: "Currency", icon: ArrowLeftRight, description: "Live FX rates and conversions" },
      { href: "/markets", label: "Markets", icon: Globe, description: "Index performance and sector heatmap" },
      { href: "/macro", label: "Macro", icon: TrendingUp, description: "Key economic indicators" },
      { href: "/news", label: "News", icon: Newspaper, description: "Market news feed with ticker filtering" },
    ],
  },
  {
    label: "Research",
    description: "Deep analysis and valuation tools",
    items: [
      { href: "/thesis", label: "Thesis", icon: BookOpen, description: "Investment thesis notebook" },
      { href: "/journal", label: "Journal", icon: FileText, description: "Log and review investment decisions" },
      { href: "/screener", label: "Screener", icon: BarChart2, description: "600+ stocks with fundamental filters", tier: "voyager" },
      { href: "/valuation/dcf", label: "DCF", icon: FileText, description: "Discounted cash flow valuation", tier: "voyager" },
      { href: "/valuation/reverse-dcf", label: "Reverse DCF", icon: RotateCcw, description: "What growth is priced in?", tier: "voyager" },
    ],
  },
];

// ── Quick Tips ──────────────────────────────────────────────────────────────

export interface QuickTip {
  emoji: string;
  title: string;
  description: string;
  href?: string;
}

export const QUICK_TIPS: QuickTip[] = [
  {
    emoji: "\u2318",
    title: "Command Palette",
    description: "Press \u2318K (or Ctrl+K) to quickly jump to any page or search for anything.",
  },
  {
    emoji: "\u2699\uFE0F",
    title: "Animation Settings",
    description: "Too many effects? Go to Settings to disable glow, starfield, or motion.",
    href: "/settings",
  },
  {
    emoji: "\uD83C\uDF93",
    title: "Financial Education",
    description: "The Learn page shows personalized tips based on your actual portfolio and finances.",
    href: "/learn",
  },
  {
    emoji: "\uD83E\uDDD1\u200D\uD83C\uDFEB",
    title: "Advisor Recommendations",
    description: "Your dashboard suggests which professional (CFP, CFA, CPA) can help based on your goals.",
  },
];

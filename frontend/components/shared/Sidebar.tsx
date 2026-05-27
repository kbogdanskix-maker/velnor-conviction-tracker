"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp, TrendingDown,
  FileText, BookOpen, Newspaper, Globe, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Settings, Menu, X, Target, Wallet, Calculator, DollarSign, Sparkles,
  RotateCcw, Coins, Receipt, GraduationCap, Activity, Bell, Umbrella,
  Banknote, Brain, Users, Search, Scale, BadgePercent, LayoutGrid, Calendar, GitBranch, CreditCard, Shield, Repeat, Trophy, ArrowLeftRight, Compass, Flame, Dice5, Scissors, LineChart, MapPin, Star, GitCompare, HeartPulse, Zap, MessageCircle,
} from "lucide-react";

// ── Icon animation + color map ──────────────────────────────────────────────
// Each icon gets a hover animation and accent color for personality

type IconAnim = "blink" | "wiggle" | "bounce" | "pulse" | "spin" | "ring";

const ICON_STYLE: Record<string, { anim: IconAnim; color: string }> = {
  // Equities
  "/portfolio":       { anim: "pulse",  color: "text-teal-400" },
  "/dividends":       { anim: "spin",   color: "text-amber-400" },
  "/dividend-calendar": { anim: "bounce", color: "text-amber-300" },
  "/dividend-forecast": { anim: "pulse", color: "text-amber-400" },
  "/watchlist":       { anim: "blink",  color: "text-violet-400" },
  "/rebalance":       { anim: "wiggle", color: "text-blue-400" },
  "/fees":            { anim: "bounce", color: "text-rose-400" },
  "/sectors":         { anim: "pulse",  color: "text-indigo-400" },
  "/position-size":   { anim: "bounce", color: "text-sky-400" },
  "/correlation":     { anim: "pulse",  color: "text-emerald-400" },
  "/risk":            { anim: "pulse",  color: "text-red-400" },
  "/attribution":     { anim: "bounce", color: "text-blue-400" },
  "/optimizer":       { anim: "pulse",  color: "text-cyan-400" },
  "/tax-harvest":     { anim: "wiggle", color: "text-emerald-400" },
  // Financial Planning
  "/net-worth":       { anim: "pulse",  color: "text-emerald-400" },
  "/cash-flow":       { anim: "bounce", color: "text-green-400" },
  "/expenses":        { anim: "wiggle", color: "text-rose-400" },
  "/budget":          { anim: "pulse",  color: "text-orange-400" },
  "/affordability":   { anim: "wiggle", color: "text-cyan-400" },
  "/debt-payoff":     { anim: "bounce", color: "text-red-400" },
  "/tax":             { anim: "wiggle", color: "text-yellow-400" },
  "/income":          { anim: "bounce", color: "text-emerald-400" },
  "/insurance":       { anim: "pulse",  color: "text-blue-400" },
  "/stress-index":    { anim: "pulse",  color: "text-orange-400" },
  "/alerts":          { anim: "ring",   color: "text-amber-400" },
  "/subscriptions":   { anim: "spin",   color: "text-violet-400" },
  "/behavior":        { anim: "pulse",  color: "text-purple-400" },
  // Projections
  "/goals":           { anim: "pulse",  color: "text-teal-400" },
  "/retirement":      { anim: "wiggle", color: "text-sky-400" },
  "/compare":         { anim: "wiggle", color: "text-indigo-400" },
  "/benchmark":       { anim: "bounce", color: "text-blue-400" },
  "/what-if":         { anim: "pulse",  color: "text-fuchsia-400" },
  "/emergency-fund":  { anim: "pulse",  color: "text-red-400" },
  "/milestones":      { anim: "bounce", color: "text-amber-400" },
  "/learn":           { anim: "wiggle", color: "text-cyan-400" },
  "/fi":              { anim: "pulse",  color: "text-orange-400" },
  "/monte-carlo":     { anim: "bounce", color: "text-purple-400" },
  "/nw-history":      { anim: "pulse",  color: "text-teal-400" },
  "/asset-location":  { anim: "bounce", color: "text-sky-400" },
  "/returns":         { anim: "spin",   color: "text-emerald-400" },
  "/annual-review":   { anim: "bounce", color: "text-amber-400" },
  "/stock-compare":   { anim: "wiggle", color: "text-indigo-400" },
  // Intelligence
  "/plan":            { anim: "pulse",  color: "text-teal-400" },
  "/health-score":    { anim: "pulse",  color: "text-rose-400" },
  "/smart-alerts":    { anim: "ring",   color: "text-amber-400" },
  "/earnings-insights": { anim: "bounce", color: "text-amber-400" },
  // News & Markets
  "/fx":              { anim: "wiggle", color: "text-green-400" },
  "/markets":         { anim: "spin",   color: "text-blue-400" },
  "/macro":           { anim: "bounce", color: "text-teal-400" },
  "/news":            { anim: "wiggle", color: "text-sky-400" },
  "/sentiment":       { anim: "pulse",  color: "text-violet-400" },
  // Research
  "/thesis":          { anim: "bounce", color: "text-violet-400" },
  "/journal":         { anim: "wiggle", color: "text-slate-300" },
  "/screener":        { anim: "pulse",  color: "text-cyan-400" },
  "/valuation/dcf":   { anim: "bounce", color: "text-emerald-400" },
  "/valuation/reverse-dcf": { anim: "spin", color: "text-orange-400" },
  // Top-level
  "/dashboard":       { anim: "pulse",  color: "text-teal-400" },
  "/guide":           { anim: "spin",   color: "text-cyan-400" },
  "/profile":         { anim: "pulse",  color: "text-teal-400" },
};

const ANIM_CLASS: Record<IconAnim, string> = {
  blink:  "animate-icon-blink",
  wiggle: "animate-icon-wiggle",
  bounce: "animate-icon-bounce",
  pulse:  "animate-icon-pulse",
  spin:   "animate-icon-spin",
  ring:   "animate-icon-ring",
};

// ── Nav structure ───────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tier?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_TOP: NavItem = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard };
const NAV_GUIDE: NavItem = { href: "/guide", label: "Guide", icon: Compass };
const NAV_PROFILE: NavItem = { href: "/profile", label: "My Profile", icon: Users };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { href: "/plan", label: "My Plan", icon: Sparkles },
      { href: "/health-score", label: "Health Score", icon: HeartPulse },
      { href: "/smart-alerts", label: "Smart Alerts", icon: Zap },
    ],
  },
  {
    label: "Equities",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: PieChart },
      { href: "/dividends", label: "Dividends", icon: Coins },
      { href: "/dividend-calendar", label: "Div Calendar", icon: Calendar, tier: "voyager" },
      { href: "/dividend-forecast", label: "Div Forecast", icon: TrendingUp, tier: "voyager" },
      { href: "/watchlist", label: "Watchlist", icon: Eye },
      { href: "/rebalance", label: "Rebalance", icon: Scale, tier: "voyager" },
      { href: "/fees", label: "Fee Analyzer", icon: BadgePercent, tier: "voyager" },
      { href: "/sectors", label: "Sectors", icon: LayoutGrid },
      { href: "/position-size", label: "Position Size", icon: Calculator, tier: "voyager" },
      { href: "/correlation", label: "Diversification", icon: Shield, tier: "navigator" },
      { href: "/risk", label: "Risk", icon: Activity },
      { href: "/attribution", label: "Attribution", icon: BarChart2, tier: "voyager" },
      { href: "/optimizer", label: "Reflect", icon: Brain, tier: "navigator" },
      { href: "/returns", label: "Returns", icon: TrendingUp },
    ],
  },
  {
    label: "Financial Planning",
    items: [
      { href: "/net-worth", label: "Net Worth", icon: Wallet },
      { href: "/nw-history", label: "NW History", icon: LineChart },
      { href: "/cash-flow", label: "Cash Flow", icon: DollarSign, tier: "voyager" },
      { href: "/expenses", label: "Expenses", icon: CreditCard },
      { href: "/budget", label: "Budget", icon: Target, tier: "voyager" },
      { href: "/affordability", label: "Affordability", icon: Calculator },
      { href: "/debt-payoff", label: "Debt Payoff", icon: TrendingDown },
      { href: "/tax", label: "Tax Awareness", icon: Receipt, tier: "voyager" },
      { href: "/tax-harvest", label: "Tax Harvest", icon: Scissors, tier: "voyager" },
      { href: "/income", label: "Income", icon: Banknote },
      { href: "/insurance", label: "Insurance", icon: Shield, tier: "voyager" },
      { href: "/stress-index", label: "Stress Index", icon: Activity },
      { href: "/alerts", label: "Alerts", icon: Bell, tier: "voyager" },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/asset-location", label: "Asset Location", icon: MapPin, tier: "voyager" },
      { href: "/behavior", label: "Behavior", icon: Brain, tier: "voyager" },
    ],
  },
  {
    label: "Projections",
    items: [
      { href: "/fi", label: "FI Tracker", icon: Flame },
      { href: "/monte-carlo", label: "Monte Carlo", icon: Dice5, tier: "navigator" },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/retirement", label: "Retirement", icon: Umbrella, tier: "voyager" },
      { href: "/compare", label: "Compare", icon: GitBranch, tier: "voyager" },
      { href: "/benchmark", label: "Benchmark", icon: Users, tier: "voyager" },
      { href: "/what-if", label: "What If", icon: Sparkles, tier: "navigator" },
      { href: "/emergency-fund", label: "Emergency Fund", icon: Shield, tier: "voyager" },
      { href: "/milestones", label: "Milestones", icon: Trophy },
      { href: "/learn", label: "Learn", icon: GraduationCap },
      { href: "/annual-review", label: "Annual Review", icon: Star },
    ],
  },
  {
    label: "News & Markets",
    items: [
      { href: "/fx", label: "Currency", icon: ArrowLeftRight, tier: "voyager" },
      { href: "/markets", label: "Markets", icon: Globe },
      { href: "/macro", label: "Macro", icon: TrendingUp, tier: "voyager" },
      { href: "/news", label: "News", icon: Newspaper },
      { href: "/sentiment", label: "Sentiment", icon: MessageCircle },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/earnings-insights", label: "Earnings AI", icon: TrendingUp },
      { href: "/thesis", label: "Thesis", icon: BookOpen },
      { href: "/journal", label: "Journal", icon: FileText },
      { href: "/screener", label: "Screener", icon: BarChart2, tier: "voyager" },
      { href: "/valuation/dcf", label: "DCF", icon: FileText, tier: "voyager" },
      { href: "/valuation/reverse-dcf", label: "Reverse DCF", icon: RotateCcw, tier: "voyager" },
      { href: "/stock-compare", label: "Stock Compare", icon: GitCompare, tier: "voyager" },
    ],
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const { adminMode } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-open the group that contains the active page
  const initialOpen = NAV_GROUPS
    .filter((g) => g.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .map((g) => g.label);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(initialOpen.length > 0 ? initialOpen : ["Equities", "Financial Planning"]));

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const showLabels = !collapsed || mobileOpen;

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 glass-sidebar flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 ml-3 group">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-shadow">
            <span className="text-xs font-display font-black text-zinc-950 leading-none">V</span>
          </div>
          <span className="text-lg font-display font-bold tracking-tight">
            <span className="text-vela-teal">V</span>
            <span className="text-zinc-100">ela</span>
          </span>
        </Link>
        <button
          onClick={() => {
            const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
            window.dispatchEvent(evt);
          }}
          className="ml-auto p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:sticky md:top-0 z-50 flex flex-col shrink-0
          glass-sidebar
          transition-all duration-300 ease-in-out
          h-full md:h-screen
          ${collapsed ? "md:w-16" : "md:w-56"}
          ${mobileOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/[0.04]">
          {showLabels ? (
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-shadow">
                <span className="text-sm font-display font-black text-zinc-950 leading-none">V</span>
              </div>
              <span className="text-xl font-display font-bold tracking-tight">
                <span className="text-vela-teal">V</span>
                <span className="text-zinc-100">ela</span>
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" className="mx-auto group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-shadow">
                <span className="text-sm font-display font-black text-zinc-950 leading-none">V</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
          {/* Dashboard  - always visible, no group */}
          <NavLink item={NAV_TOP} active={pathname === NAV_TOP.href} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_GUIDE} active={pathname === NAV_GUIDE.href} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_PROFILE} active={pathname === NAV_PROFILE.href} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />

          {/* Search trigger */}
          <button
            onClick={() => {
              const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              window.dispatchEvent(evt);
            }}
            title={collapsed && !mobileOpen ? "Search" : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
          >
            <Search className="w-4 h-4 shrink-0" />
            {showLabels && (
              <>
                <span className="flex-1 text-left">Search</span>
                <kbd className="text-[9px] text-zinc-600 bg-white/5 border border-white/[0.06] px-1.5 py-0.5 rounded">⌘K</kbd>
              </>
            )}
          </button>

          {/* Grouped sections */}
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.has(group.label);
            const hasActive = group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

            return (
              <div key={group.label}>
                {/* Group header */}
                {showLabels ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors
                      ${hasActive ? "text-vela-teal" : "text-zinc-500 hover:text-zinc-300"}
                    `}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                ) : (
                  <div className="h-px bg-white/[0.04] mx-2 my-2" />
                )}

                {/* Group items */}
                {(isOpen || !showLabels) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        showLabel={showLabels}
                        collapsed={collapsed}
                        mobileOpen={mobileOpen}
                        adminMode={adminMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 border-t border-white/[0.04] space-y-0.5">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {showLabels && <span>Settings</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-loss hover:bg-loss/5 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {showLabels && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle  - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-16 w-6 h-6 rounded-full items-center justify-center text-zinc-500 hover:text-zinc-100 transition-all
            bg-zinc-900/80 border border-white/[0.06] backdrop-blur-md shadow-lg hover:shadow-glow"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </>
  );
}


// ── Nav Link ────────────────────────────────────────────────────────────────

function NavLink({ item, active, showLabel, collapsed, mobileOpen, adminMode }: {
  item: NavItem;
  active: boolean;
  showLabel: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  adminMode?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  const style = ICON_STYLE[item.href];
  const hoverColor = style?.color || "text-zinc-100";
  const animClass = style ? ANIM_CLASS[style.anim] : "";

  return (
    <Link
      href={item.href}
      title={collapsed && !mobileOpen ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200
        ${active
          ? "text-vela-teal font-medium"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
        }
      `}
    >
      {/* Active indicator glow */}
      {active && (
        <div className="absolute inset-0 rounded-md bg-vela-teal/8 border border-vela-teal/15" />
      )}
      <Icon
        className={`
          w-4 h-4 shrink-0 relative z-10 transition-colors duration-200
          ${active ? "drop-shadow-[0_0_6px_rgba(20,184,166,0.4)]" : ""}
          ${!active && hovered ? hoverColor : ""}
          ${!active && hovered ? animClass : ""}
        `}
      />
      {showLabel && (
        <>
          <span className="truncate relative z-10">{item.label}</span>
          {item.tier && !adminMode && (
            <span className={`ml-auto text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 relative z-10 ${
              item.tier === "navigator"
                ? "text-violet-400/70 bg-violet-500/10"
                : "text-vela-teal/70 bg-vela-teal/10"
            }`}>
              {item.tier === "voyager" ? "V+" : item.tier === "navigator" ? "N+" : item.tier}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

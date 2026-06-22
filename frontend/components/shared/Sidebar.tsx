"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";
import { useProfile } from "@/hooks/useProfile";
import {
  LayoutDashboard, PieChart, Eye, BarChart2, TrendingUp, TrendingDown,
  FileText, BookOpen, Newspaper, Globe, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Settings, Menu, X, Target, Wallet, Calculator, DollarSign, Sparkles,
  RotateCcw, Coins, Receipt, GraduationCap, Activity, Umbrella,
  Banknote, Brain, Users, Search, Scale, BadgePercent, LayoutGrid, Calendar, GitBranch, CreditCard, Shield, Repeat, Trophy, ArrowLeftRight, Compass, Flame, Dice5, Scissors, LineChart, MapPin, Star, GitCompare, HeartPulse, Zap, MessageCircle, StickyNote, Building2,
} from "lucide-react";


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
      { href: "/reflect", label: "Reflect", icon: Brain, tier: "navigator" },
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
      { href: "/compare", label: "Portfolio Comparison", icon: GitBranch, tier: "voyager" },
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
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/journal", label: "Journal", icon: FileText },
      { href: "/screener", label: "Screener", icon: BarChart2, tier: "voyager" },
      { href: "/valuation/dcf", label: "DCF", icon: FileText, tier: "voyager" },
      { href: "/valuation/reverse-dcf", label: "Reverse DCF", icon: RotateCcw, tier: "voyager" },
      { href: "/stock-compare", label: "Stock Compare", icon: GitCompare, tier: "voyager" },
      { href: "/company", label: "Company Deep-Dive", icon: Building2, tier: "navigator" },
    ],
  },
];

// Curated "core" pages shown in Simple view. Everything else is Advanced.
// (Dashboard, Guide, and Profile are standalone and always shown.)
const CORE_HREFS = new Set<string>([
  "/health-score",
  "/portfolio", "/watchlist", "/reflect",
  "/net-worth", "/cash-flow",
  "/goals", "/learn",
  "/markets", "/news",
]);

// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const { adminMode } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Simple vs Advanced navigation. Beginners/intermediate default to a curated
  // core; advanced users see everything. A manual toggle is remembered.
  const { profile } = useProfile();
  const [showAdvanced, setShowAdvanced] = useState(true);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("vela_nav_advanced") : null;
    if (stored === "true") { setShowAdvanced(true); return; }
    if (stored === "false") { setShowAdvanced(false); return; }
    setShowAdvanced(profile.sophistication === "advanced");
  }, [profile.sophistication]);
  function toggleAdvanced() {
    setShowAdvanced((v) => {
      const next = !v;
      try { localStorage.setItem("vela_nav_advanced", String(next)); } catch { /* ignore */ }
      return next;
    });
  }

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
          <div className="w-6 h-6 rounded-md bg-vela-teal/15 border border-vela-teal/30 flex items-center justify-center">
            <span className="text-xs font-display font-extrabold text-vela-teal leading-none">V</span>
          </div>
          <span className="text-lg font-display font-bold tracking-tight">
            <span className="text-vela-teal">V</span>
            <span className="text-zinc-100">elnor</span>
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
        <div className="flex items-center justify-between h-14 px-4 border-b border-vela-border">
          {showLabels ? (
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-lg bg-vela-teal/15 border border-vela-teal/30 flex items-center justify-center">
                <span className="text-sm font-display font-extrabold text-vela-teal leading-none">V</span>
              </div>
              <span className="text-xl font-display font-bold tracking-tight">
                <span className="text-vela-teal">V</span>
                <span className="text-zinc-100">elnor</span>
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" className="mx-auto group">
              <div className="w-7 h-7 rounded-lg bg-vela-teal/15 border border-vela-teal/30 flex items-center justify-center">
                <span className="text-sm font-display font-extrabold text-vela-teal leading-none">V</span>
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
            // In Simple view, show only core items (plus whichever page is active,
            // so the current page never disappears from the nav).
            const visibleItems = showAdvanced
              ? group.items
              : group.items.filter(
                  (it) => CORE_HREFS.has(it.href) || pathname === it.href || pathname.startsWith(`${it.href}/`),
                );
            if (visibleItems.length === 0) return null;
            const isOpen = openGroups.has(group.label);
            const hasActive = visibleItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

            return (
              <div key={group.label}>
                {/* Group header */}
                {showLabels ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md font-mono text-[10px] uppercase tracking-[0.16em] transition-colors
                      ${hasActive ? "text-vela-teal" : "text-vela-muted hover:text-zinc-200"}
                    `}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                ) : (
                  <div className="h-px bg-vela-border mx-2 my-2" />
                )}

                {/* Group items */}
                {(isOpen || !showLabels) && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
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

          {showLabels && (
            <button
              onClick={toggleAdvanced}
              className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-md text-[11px] font-medium text-zinc-500 hover:text-vela-teal transition-colors border-t border-vela-border pt-3"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {showAdvanced ? "Switch to Simple view" : "Show all tools"}
            </button>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 border-t border-vela-border space-y-0.5">
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
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex absolute -right-2.5 top-16 z-50 w-5 h-5 rounded items-center justify-center text-vela-muted hover:text-zinc-100 transition-colors
            bg-vela-card border border-vela-border hover:border-vela-teal/40"
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
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed && !mobileOpen ? item.label : undefined}
      className={`
        group flex items-center gap-3 pl-2.5 pr-3 py-2 text-sm border-l-2 rounded-r transition-colors duration-150
        ${active
          ? "border-vela-teal bg-vela-teal/[0.06] text-zinc-100 font-medium"
          : "border-transparent text-vela-muted hover:text-zinc-100 hover:bg-white/[0.03]"
        }
      `}
    >
      <Icon
        className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
          active ? "text-vela-teal" : "text-vela-muted group-hover:text-zinc-200"
        }`}
      />
      {showLabel && (
        <>
          <span className="truncate">{item.label}</span>
          {item.tier && !adminMode && (
            <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-vela-border text-vela-muted">
              {item.tier === "voyager" ? "V+" : item.tier === "navigator" ? "N+" : item.tier}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

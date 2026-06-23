"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";
import { useProfile } from "@/hooks/useProfile";
import VelnorMark from "@/components/shared/VelnorMark";
import { tailoredHrefs, hasPersonalization } from "@/lib/sidebar-personalization";
import {
  ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Settings, Menu, X, Search, Sparkles, LayoutGrid,
} from "lucide-react";
import {
  NAV_STANDALONE, buildNav, ALL_HREFS, ITEM_BY_HREF,
  type NavItem,
} from "@/lib/nav-structure";


// ── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();
  const { adminMode } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { profile } = useProfile();

  // Lab toggle: the conviction spine shows by default; Lab reveals deferred tools.
  const [showLab, setShowLab] = useState(false);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("velnor_nav_lab") : null;
    if (stored === "true") setShowLab(true);
  }, []);
  function toggleLab() {
    setShowLab((v) => {
      const next = !v;
      try { localStorage.setItem("velnor_nav_lab", String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // Auto-open the group that contains the active page
  const navGroups = buildNav(showLab);
  const initialOpen = buildNav(true)
    .filter((g) => g.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .map((g) => g.label);

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(initialOpen.length > 0 ? initialOpen : ["Accuracy & Conviction", "Research"]),
  );

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // "For you" — top tools ranked from profile options + investing philosophy.
  const tailored = useMemo(() => {
    if (!hasPersonalization(profile)) return [] as NavItem[];
    return tailoredHrefs(profile, ALL_HREFS, 6)
      .map((href) => ITEM_BY_HREF.get(href))
      .filter((i): i is NavItem => Boolean(i));
  }, [profile]);
  const [showForYou, setShowForYou] = useState(true);
  // Render the personalized section only after mount: it derives from the
  // client-side profile (localStorage/SWR), so gating avoids a server/client
  // hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
          <VelnorMark className="w-6 h-6 text-vela-teal shrink-0" />
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
              <VelnorMark className="w-7 h-7 text-vela-teal shrink-0" />
              <span className="text-xl font-display font-bold tracking-tight">
                <span className="text-vela-teal">V</span>
                <span className="text-zinc-100">elnor</span>
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" className="mx-auto group">
              <VelnorMark className="w-7 h-7 text-vela-teal shrink-0" />
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
          {/* Standalone links — always visible, no group */}
          <NavLink item={NAV_STANDALONE.dashboard} active={pathname === "/dashboard"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_STANDALONE.guide} active={pathname === "/guide"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />
          <NavLink item={NAV_STANDALONE.profile} active={pathname === "/profile"} showLabel={showLabels} collapsed={collapsed} mobileOpen={mobileOpen} adminMode={adminMode} />

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

          {/* For you — ranked from profile options + investing philosophy */}
          {mounted && tailored.length > 0 && (
            <div>
              {showLabels ? (
                <button
                  onClick={() => setShowForYou((v) => !v)}
                  title="Ranked from your profile and investing philosophy"
                  className="w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md font-mono text-[10px] uppercase tracking-[0.16em] text-vela-teal transition-colors"
                >
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" />For you</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showForYou ? "" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="h-px bg-vela-border mx-2 my-2" />
              )}
              {(showForYou || !showLabels) && (
                <div className="space-y-0.5">
                  {tailored.map((item) => (
                    <NavLink
                      key={`fy-${item.href}`}
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
          )}

          {/* Grouped sections */}
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            const hasActive = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
            );
            return (
              <div key={group.label}>
                {showLabels ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded-md font-mono text-[10px] uppercase tracking-[0.16em] transition-colors
                      ${hasActive ? "text-vela-teal" : group.secondary ? "text-vela-subtle hover:text-vela-muted" : "text-vela-muted hover:text-zinc-200"}
                    `}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                ) : (
                  <div className="h-px bg-vela-border mx-2 my-2" />
                )}
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

          {showLabels && (
            <button
              onClick={toggleLab}
              className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-md text-[11px] font-medium text-zinc-500 hover:text-vela-teal transition-colors border-t border-vela-border pt-3"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {showLab ? "Hide Lab tools" : "Show Lab tools"}
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
        <span className="truncate">{item.label}</span>
      )}
    </Link>
  );
}

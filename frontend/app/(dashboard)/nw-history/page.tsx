"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  LineChart as LineChartIcon,
  Plus,
  Trash2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Camera,
  Download,
  Settings2,
  CalendarPlus,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNetWorthSummary } from "@/hooks/useNetWorth";
import { useCloudStore } from "@/hooks/useCloudStore";
import { exportCSV } from "@/lib/export";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────

interface NwSnapshot {
  id: string;
  date: string; // ISO date string
  assets: number;
  liabilities: number;
  netWorth: number;
  portfolioValue: number;
  note?: string;
}

type AutoInterval = "weekly" | "monthly" | "off";

interface NwHistoryStore {
  snapshots: NwSnapshot[];
  autoInterval: AutoInterval;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const INTERVAL_DAYS: Record<AutoInterval, number> = {
  weekly: 7,
  monthly: 30,
  off: Infinity,
};

// ── Chart tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-1">{fullDate(label)}</p>
      {payload.map((p) => {
        const names: Record<string, string> = { netWorth: "Net Worth", assets: "Assets", liabilities: "Liabilities" };
        const colors: Record<string, string> = { netWorth: "text-teal-400", assets: "text-gain", liabilities: "text-loss" };
        return (
          <p key={p.dataKey} className={colors[p.dataKey] ?? "text-zinc-300"}>
            {names[p.dataKey] ?? p.dataKey}: {formatCompact(p.value)}
          </p>
        );
      })}
    </div>
  );
}

// ── Add Past Entry Modal ─────────────────────────────────────────────

function AddPastEntryModal({ open, onClose, onAdd, existingDates }: {
  open: boolean;
  onClose: () => void;
  onAdd: (snap: NwSnapshot) => void;
  existingDates: Set<string>;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [assets, setAssets] = useState("");
  const [liabilities, setLiabilities] = useState("");
  const [note, setNote] = useState("");

  const netWorth = (Number(assets) || 0) - (Number(liabilities) || 0);
  const dateConflict = existingDates.has(date);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      id: crypto.randomUUID(),
      date,
      assets: Number(assets) || 0,
      liabilities: Number(liabilities) || 0,
      netWorth,
      portfolioValue: 0,
      note: note || "Manual entry",
    });
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-zinc-100">Add Past Snapshot</Dialog.Title>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
                className="input-field w-full"
              />
              {dateConflict && (
                <p className="text-xs text-amber-400 mt-1">A snapshot already exists for this date — it will be replaced.</p>
              )}
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Total Assets</label>
              <input
                type="number"
                value={assets}
                onChange={(e) => setAssets(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className="input-field w-full tabular"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Total Liabilities</label>
              <input
                type="number"
                value={liabilities}
                onChange={(e) => setLiabilities(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-field w-full tabular"
              />
            </div>

            {(Number(assets) > 0) && (
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/60 rounded-lg">
                <span className="text-xs text-zinc-500">Net Worth</span>
                <span className={`text-sm font-bold tabular-nums ${netWorth >= 0 ? "text-teal-400" : "text-rose-400"}`}>
                  {formatCurrency(netWorth)}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Q1 review"
                className="input-field w-full"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button type="submit" disabled={!assets} className="btn-primary text-sm">
                Add Snapshot
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Interval picker ──────────────────────────────────────────────────

function IntervalPicker({ value, onChange }: { value: AutoInterval; onChange: (v: AutoInterval) => void }) {
  const options: { value: AutoInterval; label: string }[] = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "off", label: "Off" },
  ];
  return (
    <div className="flex items-center gap-2">
      <Settings2 className="w-3.5 h-3.5 text-zinc-500" />
      <span className="text-xs text-zinc-500">Auto-snapshot:</span>
      <div className="flex rounded-md overflow-hidden border border-zinc-700">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              value === o.value
                ? "bg-teal-500/20 text-teal-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function NwHistoryPage() {
  const { summary, isLoading: nwLoading } = useNetWorthSummary();
  const { data: cloudData, save, isLoading: storeLoading } = useCloudStore<NwHistoryStore>("nw_history_v2");

  const [snapshots, setSnapshots] = useState<NwSnapshot[]>([]);
  const [autoInterval, setAutoInterval] = useState<AutoInterval>("monthly");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const synced = useRef(false);
  const autoSnapped = useRef(false);

  // Sync from cloud
  useEffect(() => {
    if (cloudData && !synced.current) {
      synced.current = true;
      // Support both new schema (object with snapshots+interval) and legacy (plain array)
      if (Array.isArray(cloudData)) {
        setSnapshots((cloudData as unknown as NwSnapshot[]).map((s) => ({
          ...s,
          assets: Number(s.assets) || 0,
          liabilities: Number(s.liabilities) || 0,
          netWorth: Number(s.netWorth) || 0,
          portfolioValue: Number(s.portfolioValue) || 0,
        })));
      } else {
        if (cloudData.snapshots) {
          setSnapshots(cloudData.snapshots.map((s) => ({
            ...s,
            assets: Number(s.assets) || 0,
            liabilities: Number(s.liabilities) || 0,
            netWorth: Number(s.netWorth) || 0,
            portfolioValue: Number(s.portfolioValue) || 0,
          })));
        }
        if (cloudData.autoInterval) setAutoInterval(cloudData.autoInterval);
      }
    }
  }, [cloudData]);

  // Auto-snapshot: fire if interval has elapsed since last snapshot
  useEffect(() => {
    if (!summary || !synced.current || autoSnapped.current || autoInterval === "off") return;
    autoSnapped.current = true;

    const today = new Date().toISOString().slice(0, 10);
    const hasToday = snapshots.some((s) => s.date.slice(0, 10) === today);
    if (hasToday) return;

    const intervalDays = INTERVAL_DAYS[autoInterval];
    const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
    const lastDate = sorted[0]?.date;
    const daysSinceLast = lastDate
      ? (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (daysSinceLast >= intervalDays) {
      const snap: NwSnapshot = {
        id: crypto.randomUUID(),
        date: today,
        assets: summary.total_assets,
        liabilities: summary.total_liabilities,
        netWorth: summary.net_worth,
        portfolioValue: summary.portfolio_value,
        note: "Auto-snapshot",
      };
      setSnapshots((prev) => [...prev, snap]);
    }
  }, [summary, snapshots, autoInterval]);

  // Save to cloud whenever snapshots or interval changes
  useEffect(() => {
    if (synced.current) {
      save({ snapshots, autoInterval });
    }
  }, [snapshots, autoInterval, save]);

  const saveInterval = (v: AutoInterval) => {
    setAutoInterval(v);
    autoSnapped.current = false; // re-evaluate on next render
  };

  const sorted = useMemo(() => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)), [snapshots]);

  const chartData = useMemo(() => sorted.map((s) => ({
    date: s.date,
    netWorth: s.netWorth,
    assets: s.assets,
    liabilities: s.liabilities,
  })), [sorted]);

  const stats = useMemo(() => {
    if (sorted.length < 2) return null;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const change = last.netWorth - first.netWorth;
    const changePct = first.netWorth !== 0 ? (change / Math.abs(first.netWorth)) * 100 : 0;
    const months = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    const monthlyGrowth = change / months;
    const max = Math.max(...sorted.map((s) => s.netWorth));
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recent = sorted.filter((s) => new Date(s.date) >= threeMonthsAgo);
    const recentChange = recent.length >= 2 ? recent[recent.length - 1].netWorth - recent[0].netWorth : null;
    return { change, changePct, monthlyGrowth, max, recentChange, totalSnapshots: sorted.length };
  }, [sorted]);

  function handleSnapshot() {
    if (!summary) return;
    const now = new Date().toISOString().slice(0, 10);
    if (snapshots.some((s) => s.date.slice(0, 10) === now)) {
      setSnapshots((prev) =>
        prev.map((s) =>
          s.date.slice(0, 10) === now
            ? { ...s, assets: summary.total_assets, liabilities: summary.total_liabilities, netWorth: summary.net_worth, portfolioValue: summary.portfolio_value }
            : s
        )
      );
      return;
    }
    setSnapshots((prev) => [...prev, {
      id: crypto.randomUUID(),
      date: now,
      assets: summary.total_assets,
      liabilities: summary.total_liabilities,
      netWorth: summary.net_worth,
      portfolioValue: summary.portfolio_value,
    }]);
  }

  function handleAddPast(snap: NwSnapshot) {
    setSnapshots((prev) => {
      // Replace if same date exists
      const filtered = prev.filter((s) => s.date.slice(0, 10) !== snap.date.slice(0, 10));
      return [...filtered, snap];
    });
  }

  function handleDelete(id: string) {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  const existingDates = useMemo(() => new Set(snapshots.map((s) => s.date.slice(0, 10))), [snapshots]);
  const loading = nwLoading || storeLoading;

  if (loading) return <DashboardSkeleton />;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-teal-400" />
            Net Worth History
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Track your net worth over time with periodic snapshots
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sorted.length > 0 && (
            <button
              onClick={() =>
                exportCSV(
                  sorted.map((s) => ({
                    Date: s.date,
                    Assets: s.assets.toFixed(2),
                    Liabilities: s.liabilities.toFixed(2),
                    "Net Worth": s.netWorth.toFixed(2),
                    "Portfolio Value": s.portfolioValue.toFixed(2),
                    Note: s.note ?? "",
                  })),
                  `vela-nw-history-${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Past Entry</span>
          </button>
          {summary && (
            <button onClick={handleSnapshot} className="btn-primary text-sm flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Snapshot</span>
            </button>
          )}
        </div>
      </div>

      {/* Auto-interval picker */}
      <IntervalPicker value={autoInterval} onChange={saveInterval} />

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="vela-card text-center py-16 space-y-4">
          <Camera className="w-12 h-12 text-zinc-700 mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-zinc-300">No snapshots yet</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Take periodic snapshots of your net worth to see how it changes over time. Or add past entries to bootstrap your history.
              {!summary && " Set up your net worth first."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {summary ? (
              <button onClick={handleSnapshot} className="btn-primary text-sm inline-flex items-center gap-2">
                <Camera className="w-4 h-4" /> Take First Snapshot
              </button>
            ) : (
              <Link href="/net-worth" className="inline-flex items-center gap-2 btn-primary text-sm">
                Set Up Net Worth <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <button onClick={() => setAddModalOpen(true)} className="btn-ghost text-sm inline-flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" /> Add Past Entry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          {stats && (
            <FloatingCard glowColor="rgba(12, 181, 201, 0.10)" tilt={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs text-zinc-500">Total Change</p>
                  <p className={`text-xl font-display font-bold tabular-nums ${stats.change >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCompact(stats.change)}
                  </p>
                  <p className={`text-xs tabular-nums ${stats.changePct >= 0 ? "text-gain/70" : "text-loss/70"}`}>
                    {stats.changePct >= 0 ? "+" : ""}{stats.changePct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Avg Monthly Growth</p>
                  <p className={`text-xl font-display font-bold tabular-nums ${stats.monthlyGrowth >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCompact(stats.monthlyGrowth)}
                  </p>
                  <p className="text-xs text-zinc-600">per month</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Peak Net Worth</p>
                  <p className="text-xl font-display font-bold tabular-nums text-zinc-200">
                    {formatCompact(stats.max)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Snapshots</p>
                  <p className="text-xl font-display font-bold tabular-nums text-zinc-200">
                    {stats.totalSnapshots}
                  </p>
                  {stats.recentChange != null && (
                    <p className={`text-xs tabular-nums ${stats.recentChange >= 0 ? "text-gain/70" : "text-loss/70"}`}>
                      Last 3mo: {stats.recentChange >= 0 ? "+" : ""}{formatCompact(stats.recentChange)}
                    </p>
                  )}
                </div>
              </div>
            </FloatingCard>
          )}

          {/* Chart */}
          {chartData.length >= 2 && (
            <RevealOnScroll>
              <div className="vela-card">
                <h2 className="section-heading mb-4">Net Worth Over Time</h2>
                <div className="h-[300px] sm:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(12, 181, 201)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="rgb(12, 181, 201)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(39, 39, 42)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={shortDate}
                      />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatCompact(v)}
                        width={60}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="rgb(63, 63, 70)" />
                      <Area type="monotone" dataKey="netWorth" stroke="rgb(12, 181, 201)" strokeWidth={2.5} fill="url(#nwGrad)" animationDuration={1200} />
                      <Area type="monotone" dataKey="assets" stroke="rgb(52, 211, 153)" strokeWidth={1} strokeDasharray="4 4" fill="none" animationDuration={1200} />
                      <Area type="monotone" dataKey="liabilities" stroke="rgb(244, 63, 94)" strokeWidth={1} strokeDasharray="4 4" fill="none" animationDuration={1200} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-6 mt-3 text-xs text-zinc-500 justify-center">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-teal-500 rounded" /> Net Worth</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gain rounded opacity-60" /> Assets</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-loss rounded opacity-60" /> Liabilities</span>
                </div>
              </div>
            </RevealOnScroll>
          )}

          {/* Single snapshot prompt */}
          {sorted.length === 1 && (
            <div className="vela-card flex items-center gap-3 px-4 py-3 border-teal-500/15">
              <LineChartIcon className="w-4 h-4 text-teal-400 shrink-0" />
              <p className="text-xs text-zinc-400">
                Add one more snapshot to see your growth chart and stats.{" "}
                <button onClick={() => setAddModalOpen(true)} className="text-teal-400 underline underline-offset-2 hover:text-teal-300">
                  Add a past entry
                </button>{" "}
                or come back next {autoInterval === "weekly" ? "week" : autoInterval === "monthly" ? "month" : "visit"} for an auto-snapshot.
              </p>
            </div>
          )}

          {/* Snapshot timeline */}
          <RevealOnScroll delay={0.05}>
            <div className="vela-card">
              <h2 className="section-heading mb-4">Snapshot Timeline</h2>
              <div className="space-y-0">
                {[...sorted].reverse().map((snap, i) => {
                  const prev = sorted[sorted.length - 1 - i - 1];
                  const change = prev ? snap.netWorth - prev.netWorth : null;
                  const isPositive = change != null && change >= 0;

                  return (
                    <div key={snap.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 border-zinc-900 mt-1.5 shrink-0 ${snap.note === "Auto-snapshot" ? "bg-teal-500" : "bg-violet-400"}`} />
                        {i < sorted.length - 1 && <div className="w-px flex-1 bg-zinc-800" />}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-zinc-200">{fullDate(snap.date)}</p>
                              {snap.note && snap.note !== "Auto-snapshot" && (
                                <span className="text-[10px] text-zinc-600 italic">{snap.note}</span>
                              )}
                              {snap.note === "Auto-snapshot" && (
                                <span className="text-[10px] text-teal-500/60">auto</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-lg font-display font-bold text-zinc-100 tabular-nums">
                                {formatCurrency(snap.netWorth)}
                              </span>
                              {change != null && (
                                <span className={`text-xs flex items-center gap-0.5 ${isPositive ? "text-gain" : "text-loss"}`}>
                                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {isPositive ? "+" : ""}{formatCompact(change)}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                              <span>Assets: {formatCompact(snap.assets)}</span>
                              <span>Liab: {formatCompact(snap.liabilities)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(snap.id)}
                            className="p-1.5 rounded text-zinc-600 hover:text-loss hover:bg-loss/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </RevealOnScroll>
        </>
      )}

      <AddPastEntryModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddPast}
        existingDates={existingDates}
      />
    </PageTransition>
  );
}

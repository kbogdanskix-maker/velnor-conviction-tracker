"use client";

import { Target } from "lucide-react";
import { useCalibration } from "@/lib/calibration";
import type { ConvictionBucket } from "@/lib/calibration";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";

function fmtPct(v: number | null): string {
  if (v === null) return "--";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Hit-rate bar for one conviction level. Teal accent, hairline track. */
function ConvictionBar({ bucket }: { bucket: ConvictionBucket }) {
  const hasData = bucket.reviewed > 0 && bucket.hit_rate !== null;
  const pct = bucket.hit_rate ?? 0;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-vela-muted w-12 shrink-0 tabular-nums">
        {bucket.conviction}/5
      </span>
      <div className="flex-1 h-6 bg-zinc-900 rounded overflow-hidden border border-zinc-800">
        {hasData && (
          <div
            className="h-full bg-vela-teal/30 border-r border-vela-teal transition-all"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        )}
      </div>
      <span className="font-mono text-xs w-24 shrink-0 text-right tabular-nums text-zinc-300">
        {hasData ? `${fmtPct(bucket.hit_rate)}` : "no reviews"}
        {bucket.reviewed > 0 && (
          <span className="text-zinc-600"> ({bucket.wins}/{bucket.reviewed})</span>
        )}
      </span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function CalibrationPage() {
  const { data, error, isLoading } = useCalibration();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState message="Could not load your calibration." />;
  if (!data) return null;

  const { journal, sells } = data;
  const nothingLogged = journal.total_reviewed === 0 && sells.count === 0;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-8 py-2">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-vela-teal" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Conviction Calibration
            </h1>
          </div>
          <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
            Your own track record, in hindsight. How the conviction you logged lined up with how
            decisions actually turned out, and what your sell timing looks like after the fact.
            This is a mirror of your past, not a prediction or a recommendation.
          </p>
        </div>

        {nothingLogged && (
          <div className="vela-card">
            <p className="text-sm text-zinc-400">
              Nothing to score yet. Log decisions in your Journal with a conviction level and mark
              how they turned out, or record some sells, and your calibration will build up here.
            </p>
          </div>
        )}

        {/* Conviction calibration */}
        {journal.total_reviewed > 0 && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <Stat
                label="Decisions reviewed"
                value={String(journal.total_reviewed)}
                sub={`of ${journal.total_logged} logged`}
              />
              <Stat
                label="Overall hit rate"
                value={fmtPct(journal.overall_hit_rate).replace("+", "")}
                sub="marked wins ÷ reviewed"
              />
              {journal.higher_conviction_wins_more !== null && (
                <Stat
                  label="Conviction signal"
                  value={journal.higher_conviction_wins_more ? "Tracks" : "Inverted"}
                  sub={
                    journal.higher_conviction_wins_more
                      ? "high conviction won more often"
                      : "low conviction won more often"
                  }
                />
              )}
            </div>

            <div className="vela-card space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Hit rate by conviction level
              </p>
              <div className="space-y-2.5">
                {journal.by_conviction.map((b) => (
                  <ConvictionBar key={b.conviction} bucket={b} />
                ))}
              </div>
              <p className="text-xs text-zinc-600 pt-1">
                When you were most sure (5/5), how often were you right? Well-calibrated investors
                tend to win more at higher conviction. The pattern is yours to read.
              </p>
            </div>
          </section>
        )}

        {/* Sell discipline */}
        {sells.count > 0 && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <Stat label="Positions sold" value={String(sells.count)} />
              <Stat
                label="Median realized"
                value={fmtPct(sells.median_realized_pct)}
                sub="on closed trades"
              />
              <Stat
                label="Ran without you"
                value={String(sells.sold_before_gains)}
                sub="up >5% since you sold"
              />
              <Stat
                label="Dodged the drop"
                value={String(sells.dodged_drops)}
                sub="down >5% since you sold"
              />
            </div>
            {sells.avg_since_sold_pct !== null && (
              <div className="vela-card">
                <p className="text-sm text-zinc-400">
                  On average, the names you sold are{" "}
                  <span
                    className={
                      sells.avg_since_sold_pct > 0 ? "text-amber-400 font-mono" : "text-gain font-mono"
                    }
                  >
                    {fmtPct(sells.avg_since_sold_pct)}
                  </span>{" "}
                  {sells.avg_since_sold_pct > 0
                    ? "higher than where you exited. Worth reflecting on whether you tend to sell winners early."
                    : "lower than where you exited, so your sells tended to sidestep declines."}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </PageTransition>
  );
}

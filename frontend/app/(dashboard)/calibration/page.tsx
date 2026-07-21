"use client";

import { useCalibration } from "@/lib/calibration";
import type { ConvictionBucket } from "@/lib/calibration";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import ErrorState from "@/components/shared/ErrorState";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  Pips,
  Prose,
} from "@/components/instrument";

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Rates are unsigned by nature, so drop the leading plus. */
function fmtRate(v: number | null): string {
  return fmtPct(v).replace("+", "");
}

/** Hit-rate bar for one conviction level. Teal accent, hairline track. */
function ConvictionBar({ bucket }: { bucket: ConvictionBucket }) {
  const hasData = bucket.reviewed > 0 && bucket.hit_rate !== null;
  const pct = bucket.hit_rate ?? 0;
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-[86px] shrink-0 items-center gap-2">
        <Pips level={bucket.conviction} size="text-[11px]" />
        <span className="font-mono text-[10px] tabular-nums text-vela-muted">
          {bucket.conviction}
        </span>
      </span>
      <div className="h-5 flex-1 overflow-hidden rounded-sm border border-vela-border bg-vela-card">
        {hasData && (
          <div
            className="h-full border-r border-vela-teal bg-vela-teal/25 transition-all"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        )}
      </div>
      <span className="w-[104px] shrink-0 text-right font-mono text-[11px] tabular-nums">
        {hasData ? (
          <span className="text-zinc-100">{fmtRate(bucket.hit_rate)}</span>
        ) : (
          <span className="text-vela-muted">no reviews</span>
        )}
        {bucket.reviewed > 0 && (
          <span className="text-vela-muted">
            {" "}
            ({bucket.wins}/{bucket.reviewed})
          </span>
        )}
      </span>
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
  const medianPositive = (sells.median_realized_pct ?? 0) >= 0;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Journal" }, { label: "Calibration" }]}
        note={
          nothingLogged
            ? "nothing scored yet"
            : `${journal.total_reviewed} reviewed · ${sells.count} sold`
        }
      />

      <PageHero
        title="Calibration"
        meta="Your own track record, in hindsight"
        figure={journal.total_reviewed > 0 ? fmtRate(journal.overall_hit_rate) : undefined}
        figureSub={
          journal.total_reviewed > 0
            ? `hit rate on ${journal.total_reviewed} reviewed`
            : undefined
        }
      />

      <Prose className="mt-5 max-w-[560px]">
        How the conviction you logged lined up with how decisions actually turned out, and what
        your sell timing looks like after the fact. This is a mirror of your past, not a
        prediction or a recommendation.
      </Prose>

      {nothingLogged && (
        <div className="mt-8">
          <Panel className="px-6 py-12 text-center">
            <Prose className="mx-auto max-w-[420px]">
              Nothing to score yet. Log decisions in your Journal with a conviction level and mark
              how they turned out, or record some sells, and your calibration will build up here.
            </Prose>
          </Panel>
        </div>
      )}

      {/* Conviction calibration */}
      {journal.total_reviewed > 0 && (
        <>
          <StatStrip className="mt-6">
            <StatCell
              label="Decisions reviewed"
              value={String(journal.total_reviewed)}
              sub={`of ${journal.total_logged} logged`}
            />
            <StatCell
              label="Overall hit rate"
              value={fmtRate(journal.overall_hit_rate)}
              sub="marked wins ÷ reviewed"
            />
            {journal.higher_conviction_wins_more !== null && (
              <StatCell
                label="Conviction signal"
                value={journal.higher_conviction_wins_more ? "Tracks" : "Inverted"}
                sub={
                  journal.higher_conviction_wins_more
                    ? "high conviction won more often"
                    : "low conviction won more often"
                }
              />
            )}
          </StatStrip>

          <Section
            label="Hit rate by conviction"
            prose="When you were most sure (5 of 5), how often were you right? Well-calibrated investors tend to win more at higher conviction. The pattern is yours to read."
          >
            <div className="overflow-x-auto">
              <div className="min-w-[420px] max-w-[760px] space-y-2.5">
                {journal.by_conviction.map((b) => (
                  <ConvictionBar key={b.conviction} bucket={b} />
                ))}
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Sell discipline */}
      {sells.count > 0 && (
        <Section
          label="Sell discipline"
          prose="Where the names you exited went after you left. Hindsight only, and not a signal to act on."
        >
          <StatStrip>
            <StatCell label="Positions sold" value={String(sells.count)} sub="closed or trimmed" />
            <StatCell
              label="Median realized"
              value={fmtPct(sells.median_realized_pct)}
              valueClass={
                sells.median_realized_pct === null
                  ? "text-vela-muted"
                  : medianPositive
                    ? "text-gain"
                    : "text-loss"
              }
              sub="on closed trades"
            />
            <StatCell
              label="Ran without you"
              value={String(sells.sold_before_gains)}
              sub="up >5% since you sold"
            />
            <StatCell
              label="Dodged the drop"
              value={String(sells.dodged_drops)}
              sub="down >5% since you sold"
            />
          </StatStrip>

          {sells.avg_since_sold_pct !== null && (
            <Panel className="mt-6 px-5 py-4">
              <Prose className="max-w-[620px]">
                On average, the names you sold are{" "}
                <span
                  className={`font-mono tabular-nums ${
                    sells.avg_since_sold_pct > 0 ? "text-amber-400" : "text-gain"
                  }`}
                >
                  {fmtPct(sells.avg_since_sold_pct)}
                </span>{" "}
                {sells.avg_since_sold_pct > 0
                  ? "higher than where you exited. Worth reflecting on whether you tend to sell winners early."
                  : "lower than where you exited, so your sells tended to sidestep declines."}
              </Prose>
            </Panel>
          )}
        </Section>
      )}
    </PageTransition>
  );
}

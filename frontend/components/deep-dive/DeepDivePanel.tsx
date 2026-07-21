"use client";

/**
 * Deep Dive, scoped to one ticker, for the top of the Company page.
 *
 * Lives here rather than on its own route because the request only makes sense
 * in front of a company you are already looking at. Mirrors how Earnings AI
 * hangs its generate action off the row it belongs to.
 *
 * Renders facts-first with thesis_check LAST, matching the schema and the
 * prompt. That ordering is the product point: the sourced record is read
 * before the user's own reasoning is measured against it.
 */

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Telescope } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useDeepDives, useDeepDive, useDeepDiveEligibility, requestDeepDive,
  RELATION_LABEL, RELATION_CLASS, sourceHost,
} from "@/lib/deep-dive";
import type { DeepDiveBody, Exhibit, CitedPoint } from "@/lib/deep-dive";
import Disclaimer from "@/components/shared/Disclaimer";
import { Section, Panel, Eyebrow, Prose } from "@/components/instrument";

// Recharts defaults tooltip item text to #000 when a series carries no colour,
// which is invisible here. All three properties are required.
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#0B1322",
    border: "1px solid #1B2638",
    borderRadius: 4,
    fontSize: 12,
    color: "#EAEEF5",
  },
  labelStyle: { color: "#8A97AC" },
  itemStyle: { color: "#EAEEF5" },
};

function Cite({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 ml-1.5 font-mono text-[10px]
        text-vela-muted hover:text-vela-teal transition-colors align-baseline"
    >
      {sourceHost(url)}
      <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
    </a>
  );
}

function CitedList({ items }: { items: CitedPoint[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="text-vela-teal text-[10px] leading-[1.6] shrink-0">◆</span>
          <p className="text-[13.5px] leading-[1.55] text-vela-body">
            {it.point}
            <Cite url={it.source_url} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function ExhibitChart({ ex }: { ex: Exhibit }) {
  if (!ex.points?.length) return null;
  return (
    <div className="min-w-0">
      <Eyebrow className="mb-1">{ex.title}</Eyebrow>
      {ex.unit && <p className="font-mono text-[10px] text-vela-muted mb-2">{ex.unit}</p>}
      <div className="overflow-x-auto">
        <div className="h-44 min-w-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            {ex.kind === "line" ? (
              <LineChart data={ex.points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#8A97AC", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A97AC", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="value" stroke="#1AA8BB" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={ex.points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#8A97AC", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A97AC", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip {...TOOLTIP_STYLE} cursor={false} />
                <Bar dataKey="value" fill="#1AA8BB" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
      {ex.note && <p className="mt-2 font-mono text-[11px] text-vela-muted">{ex.note}<Cite url={ex.source_url} /></p>}
    </div>
  );
}

function ReportBody({ r }: { r: DeepDiveBody }) {
  return (
    <div className="space-y-8">
      {r.headline && <Prose className="max-w-[640px] text-[15px]">{r.headline}</Prose>}

      {r.key_takeaways?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">Key takeaways</Eyebrow>
          <CitedList items={r.key_takeaways} />
        </div>
      )}

      {r.business_snapshot && (
        <div>
          <Eyebrow className="mb-3">The business</Eyebrow>
          <Prose className="max-w-[640px]">{r.business_snapshot}</Prose>
        </div>
      )}

      {r.recent_developments?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">What has happened</Eyebrow>
          <div className="border-t border-vela-border">
            {r.recent_developments.map((d, i) => (
              <article key={i} className="py-4 border-b border-vela-border">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted">{d.date}</span>
                  <h4 className="font-display text-[16px] font-semibold text-zinc-100">{d.headline}</h4>
                </div>
                <Prose className="mt-2 max-w-[640px]">{d.detail}</Prose>
                {d.why_it_connects && (
                  <p className="mt-2 max-w-[640px] text-[13px] leading-[1.55] text-vela-muted">{d.why_it_connects}</p>
                )}
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-vela-muted hover:text-vela-teal transition-colors"
                >
                  {d.source_title || sourceHost(d.source_url)}
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </div>
      )}

      {r.results_vs_expectations?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">Results against expectations</Eyebrow>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-vela-border">
                  {["Period", "Metric", "Reported", "Expected", ""].map((h) => (
                    <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.results_vs_expectations.map((row, i) => (
                  <tr key={i} className="border-b border-vela-border">
                    <td className="py-2.5 font-mono text-[12px] text-vela-muted">{row.period}</td>
                    <td className="py-2.5 text-[13px] text-vela-body">{row.metric}</td>
                    <td className="py-2.5 font-mono text-[13px] tabular-nums text-zinc-100">{row.reported}</td>
                    <td className="py-2.5 font-mono text-[13px] tabular-nums text-vela-body">{row.expected || "—"}</td>
                    <td className="py-2.5"><Cite url={row.source_url} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.exhibits?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">Exhibits</Eyebrow>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            {r.exhibits.map((ex, i) => <ExhibitChart key={i} ex={ex} />)}
          </div>
        </div>
      )}

      {r.upcoming_events?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">On the calendar</Eyebrow>
          <div className="border-t border-vela-border">
            {r.upcoming_events.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 border-b border-vela-border">
                <span className="font-mono text-[12px] tabular-nums text-vela-teal w-24 shrink-0">{e.date}</span>
                <span className="text-[13.5px] text-zinc-100">{e.event}</span>
                <span className="text-[13px] text-vela-muted">{e.detail}</span>
                <span className="ml-auto"><Cite url={e.source_url} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.risks_flagged_by_sources?.length > 0 && (
        <div>
          <Eyebrow className="mb-1">Risks the sources raise</Eyebrow>
          <p className="mb-3 font-mono text-[11px] text-vela-muted">
            Attributed to the publications that raised them, not an assessment of your holding.
          </p>
          <CitedList items={r.risks_flagged_by_sources} />
        </div>
      )}

      {/* ── Last on purpose ─────────────────────────────────────────────── */}
      <div className="pt-6 border-t border-vela-border">
        <Eyebrow className="mb-1">Against what you wrote</Eyebrow>
        <p className="mb-4 font-mono text-[11px] text-vela-muted">
          Your own recorded reasoning beside the sourced record. This compares your words to the
          facts; it is not a view on the security.
        </p>
        {!r.thesis_check?.has_thesis ? (
          <Prose>
            You have not written a thesis on {r.ticker}, so there is nothing to compare against yet.{" "}
            <Link href="/thesis" className="text-vela-teal hover:underline">Start one</Link>.
          </Prose>
        ) : (
          <>
            {r.thesis_check.summary && <Prose className="max-w-[640px] mb-5">{r.thesis_check.summary}</Prose>}
            <div className="border-t border-vela-border">
              {r.thesis_check.observations.map((o, i) => (
                <div key={i} className="py-4 border-b border-vela-border">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${RELATION_CLASS[o.relation]}`}>
                      {RELATION_LABEL[o.relation]}
                    </span>
                    <span className="font-mono text-[11px] text-vela-muted">{o.written_on}</span>
                  </div>
                  <blockquote className="border-l-2 border-vela-border pl-3 text-[13.5px] leading-[1.55] text-vela-body italic">
                    {o.you_wrote}
                  </blockquote>
                  <p className="mt-2.5 text-[13.5px] leading-[1.55] text-zinc-100">
                    {o.what_the_record_shows}
                    <Cite url={o.source_url} />
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {r.limitations?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">What this does not cover</Eyebrow>
          <ul className="space-y-2">
            {r.limitations.map((l, i) => (
              <li key={i} className="text-[13px] leading-[1.55] text-vela-muted">{l}</li>
            ))}
          </ul>
        </div>
      )}

      {r.sources?.length > 0 && (
        <div>
          <Eyebrow className="mb-3">Sources</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {r.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline gap-2 py-1 text-[13px] text-vela-body hover:text-vela-teal transition-colors"
              >
                <span className="font-mono text-[10px] text-vela-muted shrink-0">{s.publisher || sourceHost(s.url)}</span>
                <span className="truncate">{s.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <Disclaimer variant="inline" />
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function DeepDivePanel({ ticker }: { ticker: string }) {
  const { eligibility, mutate: mutateElig } = useDeepDiveEligibility();
  const { reports, mutate: mutateList } = useDeepDives();
  const [submitting, setSubmitting] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // The most recent dive on THIS ticker, if any.
  const forTicker = reports.filter((r) => r.ticker === ticker.toUpperCase());
  const latestId = forTicker[0]?.id ?? null;
  const { report: latest } = useDeepDive(latestId);

  const canRun = eligibility?.available && !eligibility?.in_progress;
  const nextAt = eligibility?.next_available_at
    ? new Date(eligibility.next_available_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  async function handleRun() {
    setSubmitting(true);
    setReqError(null);
    try {
      await requestDeepDive(ticker);
      await Promise.all([mutateList(), mutateElig()]);
    } catch (e) {
      setReqError(e instanceof Error ? e.message : "Could not start the deep dive.");
    } finally {
      setSubmitting(false);
    }
  }

  const running = latest && (latest.status === "queued" || latest.status === "running");

  return (
    <Section
      label="Deep Dive"
      prose="A sourced briefing on this company from live research, then your own thesis set beside it."
      controls={
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button
            onClick={handleRun}
            disabled={!canRun || submitting || !!running}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded
              bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
              font-mono text-[10px] uppercase tracking-wider
              hover:bg-vela-teal/15 hover:border-vela-teal/40
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting || running
              ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              : <Telescope className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            {latest?.status === "complete" ? "Run again" : `Deep dive ${ticker}`}
          </button>
          <span className="font-mono text-[10px] text-vela-muted">
            {running
              ? "researching, takes a few minutes"
              : canRun
                ? `one per ${eligibility?.cooldown_days ?? 5} days`
                : nextAt
                  ? `next available ${nextAt}`
                  : ""}
          </span>
        </div>
      }
    >
      {reqError && <p className="mb-4 text-[13px] text-loss">{reqError}</p>}

      {running ? (
        <Panel className="p-5">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-vela-teal" aria-hidden="true" />
            <Eyebrow>Researching {latest.ticker}</Eyebrow>
          </div>
          <Prose className="mt-3">
            Reading live sources and setting them against your thesis. You can leave the page; the
            report is stored when it finishes.
          </Prose>
        </Panel>
      ) : latest?.status === "failed" ? (
        <Panel className="p-5">
          <Eyebrow className="mb-2">Could not complete</Eyebrow>
          <Prose>{latest.error || "The run failed."}</Prose>
          <p className="mt-3 font-mono text-[11px] text-vela-muted">
            A failed run does not use up your allowance.
          </p>
        </Panel>
      ) : latest?.status === "complete" && latest.report ? (
        <>
          <p className="mb-6 font-mono text-[11px] text-vela-muted">
            Researched {latest.report.as_of || "recently"}
            {latest.completed_at ? ` · ${new Date(latest.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </p>
          <ReportBody r={latest.report} />
        </>
      ) : (
        <Panel className="p-6">
          <Prose className="max-w-[560px]">
            No dive on {ticker} yet. A deep dive researches live sources for what has actually
            happened, then sets the record beside what you have written about this name.
          </Prose>
        </Panel>
      )}
    </Section>
  );
}

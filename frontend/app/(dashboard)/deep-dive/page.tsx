"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useDeepDives, useDeepDive, useDeepDiveEligibility, requestDeepDive,
  RELATION_LABEL, RELATION_CLASS, sourceHost,
} from "@/lib/deep-dive";
import type { DeepDiveBody, Exhibit, CitedPoint } from "@/lib/deep-dive";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import Disclaimer from "@/components/shared/Disclaimer";
import {
  TopBar, PageHero, StatStrip, StatCell, Section,
  Panel, Eyebrow, Prose,
} from "@/components/instrument";

// Chart chrome, matching the app's dark surface. Recharts defaults its tooltip
// text to near-black, which is invisible here, so colour is set explicitly.
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

// ── Citation ─────────────────────────────────────────────────────────────────

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

// ── Exhibit ──────────────────────────────────────────────────────────────────

function ExhibitChart({ ex }: { ex: Exhibit }) {
  if (!ex.points?.length) return null;
  return (
    <div className="min-w-0">
      <Eyebrow className="mb-1">{ex.title}</Eyebrow>
      {ex.unit && <p className="font-mono text-[10px] text-vela-muted mb-2">{ex.unit}</p>}
      <div className="overflow-x-auto">
        <div className="h-48 min-w-[300px]">
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

// ── The report ───────────────────────────────────────────────────────────────
// Rendered facts-first. thesis_check comes last on purpose: the user reads the
// sourced record before they read their own reasoning measured against it.

function Report({ r }: { r: DeepDiveBody }) {
  return (
    <>
      <PageHero
        title={r.ticker}
        name={r.company_name && r.company_name !== r.ticker ? r.company_name : undefined}
        meta={r.as_of ? `researched ${r.as_of}` : undefined}
      />
      {r.headline && <Prose className="mt-4 max-w-[640px] text-[15px]">{r.headline}</Prose>}

      {r.key_takeaways?.length > 0 && (
        <Section label="Key takeaways">
          <CitedList items={r.key_takeaways} />
        </Section>
      )}

      {r.business_snapshot && (
        <Section label="The business">
          <Prose className="max-w-[640px]">{r.business_snapshot}</Prose>
        </Section>
      )}

      {r.recent_developments?.length > 0 && (
        <Section label="What has happened">
          <div className="border-t border-vela-border">
            {r.recent_developments.map((d, i) => (
              <article key={i} className="py-4 border-b border-vela-border">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted">{d.date}</span>
                  <h3 className="font-display text-[16px] font-semibold text-zinc-100">{d.headline}</h3>
                </div>
                <Prose className="mt-2 max-w-[640px]">{d.detail}</Prose>
                {d.why_it_connects && (
                  <p className="mt-2 max-w-[640px] text-[13px] leading-[1.55] text-vela-muted">
                    {d.why_it_connects}
                  </p>
                )}
                <p className="mt-1.5">
                  <a
                    href={d.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-vela-muted hover:text-vela-teal transition-colors"
                  >
                    {d.source_title || sourceHost(d.source_url)}
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </p>
              </article>
            ))}
          </div>
        </Section>
      )}

      {r.results_vs_expectations?.length > 0 && (
        <Section label="Results against expectations">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="border-b border-vela-border">
                  {["Period", "Metric", "Reported", "Expected", ""].map((h) => (
                    <th key={h} className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted font-medium">
                      {h}
                    </th>
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
        </Section>
      )}

      {r.exhibits?.length > 0 && (
        <Section label="Exhibits">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            {r.exhibits.map((ex, i) => <ExhibitChart key={i} ex={ex} />)}
          </div>
        </Section>
      )}

      {r.upcoming_events?.length > 0 && (
        <Section label="On the calendar">
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
        </Section>
      )}

      {r.risks_flagged_by_sources?.length > 0 && (
        <Section
          label="Risks the sources raise"
          prose="Attributed to the publications that raised them, not an assessment of your holding."
        >
          <CitedList items={r.risks_flagged_by_sources} />
        </Section>
      )}

      {/* ── Last on purpose ─────────────────────────────────────────────── */}
      <Section
        label="Against what you wrote"
        prose="Your own recorded reasoning set beside the sourced record. This compares your words to the facts; it is not a view on the security."
      >
        {!r.thesis_check?.has_thesis ? (
          <Panel className="p-5">
            <Prose>
              You have not written a thesis on {r.ticker}, so there is nothing to compare the record
              against yet.{" "}
              <Link href="/thesis" className="text-vela-teal hover:underline">Start one</Link>.
            </Prose>
          </Panel>
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
      </Section>

      {r.limitations?.length > 0 && (
        <Section label="What this does not cover">
          <ul className="space-y-2">
            {r.limitations.map((l, i) => (
              <li key={i} className="text-[13px] leading-[1.55] text-vela-muted">{l}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.sources?.length > 0 && (
        <Section label="Sources">
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
        </Section>
      )}

      <div className="mt-8">
        <Disclaimer variant="inline" />
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeepDivePage() {
  const { eligibility, isLoading: eligLoading, mutate: mutateElig } = useDeepDiveEligibility();
  const { reports, isLoading: listLoading, mutate: mutateList } = useDeepDives();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // Default to the newest report once the list arrives.
  const activeId = selectedId ?? reports[0]?.id ?? null;
  const { report: active } = useDeepDive(activeId);

  async function handleRequest() {
    const tk = ticker.toUpperCase().trim();
    if (!tk) return;
    setSubmitting(true);
    setReqError(null);
    try {
      const created = await requestDeepDive(tk);
      setTicker("");
      setSelectedId(created.id);
      await Promise.all([mutateList(), mutateElig()]);
    } catch (e) {
      setReqError(e instanceof Error ? e.message : "Could not start the deep dive.");
    } finally {
      setSubmitting(false);
    }
  }

  if (eligLoading || listLoading) return <DashboardSkeleton />;

  const nextAt = eligibility?.next_available_at
    ? new Date(eligibility.next_available_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const canRun = eligibility?.available && !eligibility?.in_progress;

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "Deep Dive" }]}
        note={
          eligibility?.in_progress
            ? "a dive is running"
            : canRun
              ? "one available"
              : nextAt
                ? `next available ${nextAt}`
                : undefined
        }
      />

      <PageHero
        title="Deep Dive"
        meta="a sourced briefing on one name, then your own thesis beside it"
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Available now"
          value={canRun ? "Yes" : "No"}
          valueClass={canRun ? "text-gain" : "text-vela-muted"}
          sub={canRun ? "ready to run" : nextAt ? `next ${nextAt}` : "in progress"}
        />
        <StatCell label="Cadence" value={`${eligibility?.cooldown_days ?? 5}d`} sub="one dive per window" />
        <StatCell label="Dives run" value={String(reports.length)} sub="stored and re-readable" />
        <StatCell
          label="Last subject"
          value={eligibility?.last_ticker || "—"}
          sub={eligibility?.last_ticker ? "most recent" : "none yet"}
        />
      </StatStrip>

      <Section
        label="Run a dive"
        prose="Pick one company. It researches live sources, then sets what it finds against what you have written. It takes a few minutes and you can leave the page."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vela-muted" aria-hidden="true" />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && canRun) handleRequest(); }}
              placeholder="Ticker, e.g. AAPL"
              aria-label="Ticker to research"
              disabled={!canRun || submitting}
              className="w-full bg-vela-card border border-vela-border rounded pl-9 pr-3 py-2
                font-mono text-sm text-zinc-100 placeholder:text-vela-muted
                focus:border-vela-teal outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleRequest}
            disabled={!canRun || submitting || !ticker.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded
              bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
              font-mono text-[10px] uppercase tracking-wider
              hover:bg-vela-teal/15 hover:border-vela-teal/40
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            Run deep dive
          </button>
        </div>

        {reqError && <p className="mt-3 text-[13px] text-loss">{reqError}</p>}
        {!canRun && !reqError && (
          <p className="mt-3 font-mono text-[11px] text-vela-muted">
            {eligibility?.in_progress
              ? `A dive on ${eligibility.last_ticker} is still running.`
              : nextAt
                ? `Your next dive unlocks ${nextAt}.`
                : null}
          </p>
        )}
      </Section>

      {reports.length > 1 && (
        <Section label="Past dives">
          <div className="flex flex-wrap gap-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`px-2.5 py-1 rounded border font-mono text-[11px] transition-colors ${
                  r.id === activeId
                    ? "border-vela-teal/40 bg-vela-teal/10 text-vela-teal"
                    : "border-vela-border text-vela-muted hover:text-zinc-100"
                }`}
              >
                {r.ticker}
                <span className="ml-1.5 text-[10px] opacity-70">
                  {r.requested_at ? new Date(r.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {active && (
        <div className="mt-10 pt-8 border-t border-vela-border">
          {active.status === "complete" && active.report ? (
            <Report r={active.report} />
          ) : active.status === "failed" ? (
            <Panel className="p-5">
              <Eyebrow className="mb-2">{active.ticker} · could not complete</Eyebrow>
              <Prose>{active.error || "The run failed."}</Prose>
              <p className="mt-3 font-mono text-[11px] text-vela-muted">
                A failed run does not use up your allowance.
              </p>
            </Panel>
          ) : (
            <Panel className="p-5">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-vela-teal" aria-hidden="true" />
                <Eyebrow>Researching {active.ticker}</Eyebrow>
              </div>
              <Prose className="mt-3">
                Reading live sources and setting them against your thesis. This takes a few minutes.
                You can leave the page; the report is stored when it finishes.
              </Prose>
            </Panel>
          )}
        </div>
      )}

      {reports.length === 0 && (
        <Panel className="mt-10 p-8 text-center">
          <Prose className="mx-auto max-w-md">
            No dives yet. Pick a company above and it will research the record, then set it beside
            what you have written about that name.
          </Prose>
        </Panel>
      )}
    </PageTransition>
  );
}

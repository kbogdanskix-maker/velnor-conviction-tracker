"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import useSWR from "swr";
import { api, apiStreamPost } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import DeepDivePanel from "@/components/deep-dive/DeepDivePanel";
import Disclaimer from "@/components/shared/Disclaimer";
import { stripAiMarkdown } from "@/lib/formatters";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  PillGroup,
  Panel,
  Eyebrow,
  Prose,
} from "@/components/instrument";
import { Search, RefreshCw, Scale } from "lucide-react";

/* ── helpers ────────────────────────────────────────────────── */

/** Compact statement-value formatter. Mixed units (currency, shares, EPS),
 *  so no $ prefix — large values get T/B/M/K, small values 2 decimals. */
const fmtStmt = (v: number | null): string => {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${a.toFixed(2)}`;
};

const fmtPay = (v: number | null): string => {
  if (v == null) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPct = (v: number | null): string => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

/* ── types ──────────────────────────────────────────────────── */

interface StmtBlock { periods: string[]; rows: { label: string; values: (number | null)[] }[] }
interface Financials { ticker: string; income: StmtBlock | null; balance: StmtBlock | null; cashflow: StmtBlock | null; error?: string }
interface Officer { name: string; title: string | null; age: number | null; year_born: number | null; total_pay: number | null; fiscal_year: number | null }
interface Management {
  ticker: string; name: string | null; sector: string | null; industry: string | null;
  website: string | null; full_time_employees: number | null;
  officers: Officer[] | null;
  governance: Record<string, number> | null;
  governance_as_of?: string | null;
  held_percent_insiders: number | null; held_percent_institutions: number | null;
  error?: string;
}
interface InsiderTxn { insider: string | null; position: string | null; shares: number | null; value: number | null; text: string | null; type: string; date: string | null }
interface Insiders { ticker: string; summary: Record<string, { shares: number | null; trans: number | null }> | null; transactions: InsiderTxn[]; error?: string }

const GOV_LABELS: Record<string, string> = {
  audit: "Audit", board: "Board", compensation: "Compensation",
  shareholder_rights: "Shareholder Rights", overall: "Overall",
};

/* Factual descriptions of what each ISS QualityScore pillar measures. Generic
 * (identical for every company) — these explain the methodology, not any
 * company-specific rationale, which the source does not provide. */
const GOV_PILLAR_DESC: Record<string, string> = {
  audit: "Audit & accounting risk: financial-reporting quality, restatements, auditor independence and tenure.",
  board: "Board structure & accountability: independence, classified/staggered boards, a combined chair/CEO, attendance and over-boarding. Concentrated or founder control raises this score.",
  compensation: "Pay-for-performance alignment: whether executive pay tracks results, not the dollar size of pay. Stock-heavy pay against weak or negative earnings scores higher.",
  shareholder_rights: "Shareholder rights & takeover defenses: dual-class shares, poison pills, supermajority requirements, and the ability to call meetings or act by written consent.",
  overall: "Composite percentile across the four pillars, ranked against index peers.",
};

/* Form 4 transaction types. Direction uses the semantic gain/loss tokens the
 * rest of the app uses for buy/sell rows; everything else stays neutral. */
const TXN_STYLE: Record<string, { cls: string; label: string }> = {
  buy: { cls: "bg-gain/15 text-gain", label: "Buy" },
  sell: { cls: "bg-loss/15 text-loss", label: "Sell" },
  gift: { cls: "bg-vela-border/60 text-vela-body", label: "Gift" },
  option: { cls: "bg-vela-border/60 text-vela-body", label: "Option" },
  grant: { cls: "bg-vela-teal/15 text-vela-teal", label: "Grant" },
  other: { cls: "bg-vela-border/60 text-vela-body", label: "Other" },
};

/* A 503 from the API means the upstream source (Yahoo) was throttled/empty —
 * the data exists, it just didn't come through. Distinct from a 200 where a
 * section is simply not reported by the source. */
const isRetryable = (err: unknown): boolean =>
  !!err && (err as { status?: number }).status === 503;

// ── AI valuation streaming ────────────────────────────────────────────────────

async function streamValuation(
  ticker: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const res = await apiStreamPost(`/ai/valuation/${ticker}`, {});
    if (res.status === 429) {
      onError("Daily AI limit reached. Resets at midnight.");
      return;
    }
    if (!res.ok || !res.body) {
      onError("Failed to connect.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const msg = JSON.parse(raw);
          if (msg.text) onChunk(msg.text);
          if (msg.done) onDone();
          if (msg.error) onError(msg.error);
        } catch { /* ignore malformed */ }
      }
    }
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
  }
}

// ── Inline bold renderer ──────────────────────────────────────────────────────

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-zinc-100 font-semibold">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Valuation panel ───────────────────────────────────────────────────────────

interface ValuationState {
  text: string;
  loading: boolean;
  error?: string;
}

function ValuationPanel({ ticker }: { ticker: string }) {
  const [state, setState] = useState<ValuationState>({
    text: "",
    loading: false,
  });

  // Reset when ticker changes so stale answers don't linger
  useEffect(() => {
    setState({ text: "", loading: false, error: undefined });
  }, [ticker]);

  const handleValuation = useCallback(() => {
    setState({ text: "", loading: true, error: undefined });

    streamValuation(
      ticker,
      (chunk) => {
        setState((prev) => ({ ...prev, text: prev.text + chunk }));
      },
      () => {
        setState((prev) => ({ ...prev, loading: false }));
      },
      (err) => {
        setState((prev) => ({ ...prev, loading: false, error: err }));
      },
    );
  }, [ticker]);

  const trigger = (
    <button
      onClick={handleValuation}
      disabled={state.loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded
        bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
        font-mono text-[10px] uppercase tracking-wider
        hover:bg-vela-teal/15 hover:border-vela-teal/40
        disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Scale className="w-3.5 h-3.5 shrink-0" />
      {state.loading ? "Working..." : "Which framework fits this business?"}
    </button>
  );

  return (
    <Section
      label="Valuation method"
      prose="Which valuation framework suits a business of this type, and why it is the one practitioners reach for. Method only, not a view on the security."
      controls={trigger}
    >
      {/* Loading state — no text yet */}
      {state.loading && state.text === "" && (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted">
          Working through the framework...
        </p>
      )}

      {/* Error state */}
      {state.error && <p className="text-[13px] text-loss">{state.error}</p>}

      {/* Streamed answer */}
      {state.text && (
        <Panel className="p-5">
          <p className="text-[13.5px] leading-[1.6] text-vela-body whitespace-pre-wrap">
            <InlineBold text={stripAiMarkdown(state.text)} />
          </p>
          <Disclaimer variant="inline" />
        </Panel>
      )}
    </Section>
  );
}

function RetryNotice({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="border border-vela-border px-5 py-6">
      <Eyebrow>Source unavailable</Eyebrow>
      <Prose className="mt-2 max-w-[560px]">
        Couldn&apos;t load {label}. The market-data source may be rate limiting.
        This is temporary: the data exists, it just didn&apos;t come through this time.
      </Prose>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-vela-border
          font-mono text-[10px] uppercase tracking-wider text-vela-muted
          hover:text-zinc-100 hover:border-vela-teal/40 transition-colors"
      >
        <RefreshCw className="w-3 h-3 shrink-0" /> Retry
      </button>
    </div>
  );
}

/* ── component ──────────────────────────────────────────────── */

const STMT_TABS = [
  { key: "income", label: "Income" },
  { key: "balance", label: "Balance" },
  { key: "cashflow", label: "Cash flow" },
] as const;

type StmtTab = (typeof STMT_TABS)[number]["key"];

function CompanyDeepDive() {
  const { summary } = useDefaultPortfolio();
  const firstHolding = summary?.holdings?.[0]?.ticker ?? "AAPL";

  const [ticker, setTicker] = useState<string>(firstHolding);
  const [input, setInput] = useState("");
  const [stmtTab, setStmtTab] = useState<StmtTab>("income");

  const { data: fin, error: finError, isLoading: finLoading, mutate: finMutate } = useSWR<Financials>(
    ticker ? `/markets/financials/${ticker}` : null, api.get, { revalidateOnFocus: false },
  );
  const { data: mgmt, error: mgmtError, isLoading: mgmtLoading, mutate: mgmtMutate } = useSWR<Management>(
    ticker ? `/markets/management/${ticker}` : null, api.get, { revalidateOnFocus: false },
  );
  const { data: ins, error: insError, isLoading: insLoading, mutate: insMutate } = useSWR<Insiders>(
    ticker ? `/markets/insiders/${ticker}` : null, api.get, { revalidateOnFocus: false },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.toUpperCase().trim();
    if (t) { setTicker(t); setInput(""); }
  };

  const activeStmt: StmtBlock | null = useMemo(() => {
    if (!fin) return null;
    return stmtTab === "income" ? fin.income : stmtTab === "balance" ? fin.balance : fin.cashflow;
  }, [fin, stmtTab]);

  const profile = mgmt && !mgmt.error ? mgmt : null;
  const govOverall = profile?.governance?.overall ?? null;
  const netInsiderShares = ins?.summary?.["Net Shares Purchased (Sold)"]?.shares ?? null;

  const sectorLine = [profile?.sector, profile?.industry].filter(Boolean).join(" · ");
  const heroMeta = mgmtLoading
    ? "loading profile"
    : sectorLine || "sector not reported";

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Research" }, { label: "Company" }]}
        note="filing data only · statements, officers, form 4"
      />

      {/* ── Ticker lookup ──────────────────────────────────────── */}
      <form onSubmit={submit} className="flex items-center gap-2 sm:justify-end mb-6">
        <label htmlFor="company-ticker" className="sr-only">Ticker</label>
        <div className="relative flex-1 sm:flex-none sm:w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vela-muted pointer-events-none" />
          <input
            id="company-ticker"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder={ticker}
            className="w-full rounded bg-vela-card border border-vela-border pl-9 pr-3 py-2
              font-mono text-sm tracking-wide text-zinc-100 placeholder-vela-muted
              outline-none transition-colors focus:border-vela-teal/60"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center px-3 py-2 rounded
            bg-vela-teal/10 border border-vela-teal/25 text-vela-teal
            font-mono text-[10px] uppercase tracking-wider
            hover:bg-vela-teal/15 hover:border-vela-teal/40 transition-colors"
        >
          Load
        </button>
      </form>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <PageHero
        title={ticker}
        name={profile?.name && profile.name !== ticker ? profile.name : undefined}
        meta={
          <>
            {heroMeta}
            {profile?.website && (
              <>
                {" · "}
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vela-teal hover:underline"
                >
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </>
            )}
          </>
        }
        figure={
          profile?.full_time_employees != null
            ? profile.full_time_employees.toLocaleString("en-US")
            : undefined
        }
        figureSub={profile?.full_time_employees != null ? "full-time employees" : undefined}
        figureSubClass="text-vela-muted"
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Insider ownership"
          value={fmtPct(profile?.held_percent_insiders ?? null)}
          sub="of shares outstanding"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Institutional own."
          value={fmtPct(profile?.held_percent_institutions ?? null)}
          sub="of shares outstanding"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Governance decile"
          value={govOverall != null ? `${govOverall}/10` : "—"}
          sub="ISS rank vs index peers"
          subClass="text-vela-muted"
        />
        <StatCell
          label="Insider net, 6mo"
          value={netInsiderShares != null ? fmtStmt(netInsiderShares) : "—"}
          sub="shares, form 4"
          subClass="text-vela-muted"
        />
      </StatStrip>

      {/* ── AI deep dive ───────────────────────────────────────── */}
      <DeepDivePanel ticker={ticker} />

      {/* ── AI valuation coaching ──────────────────────────────── */}
      <ValuationPanel ticker={ticker} />

      {/* ── Financial statements ───────────────────────────────── */}
      <Section
        label="Financial statements"
        prose="As filed, most recent periods first. Values in USD (T/B/M/K); EPS and share counts as reported."
        controls={
          <PillGroup
            options={STMT_TABS.map((t) => ({ key: t.key, label: t.label }))}
            value={stmtTab}
            onChange={setStmtTab}
            ariaLabel="Statement"
          />
        }
      >
        {finLoading ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted py-6">
            Loading statements…
          </p>
        ) : isRetryable(finError) ? (
          <RetryNotice label="financial statements" onRetry={() => finMutate()} />
        ) : activeStmt ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-vela-border">
                    <th className="text-left px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-vela-muted">
                      Line item
                    </th>
                    {activeStmt.periods.map((p) => (
                      <th
                        key={p}
                        className="text-right px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] tabular-nums text-vela-muted"
                      >
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeStmt.rows.map((row) => {
                    const allEmpty = row.values.every((v) => v == null);
                    return (
                      <tr key={row.label} className="border-b border-vela-border last:border-0">
                        <td
                          className={`px-3 py-2.5 ${allEmpty ? "text-vela-muted" : "text-vela-body"}`}
                          title={allEmpty ? "Not reported in this company's filing" : undefined}
                        >
                          {row.label}
                        </td>
                        {row.values.map((v, i) => (
                          <td
                            key={i}
                            className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                              v == null ? "text-vela-muted" : "text-zinc-100"
                            }`}
                          >
                            {fmtStmt(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
              Negative = cash outflow · a dash means the line is not in the filing
            </p>
          </>
        ) : (
          <Prose className="py-6 max-w-[560px]">
            Financial statements are not reported by the source for {ticker}. That is typical
            for ETFs, indices, and some ADRs.
          </Prose>
        )}
      </Section>

      {/* ── Management & governance ────────────────────────────── */}
      <Section
        label="Management & governance"
        prose="Named officers and the ISS QualityScore deciles, as published by the source."
      >
        {mgmtLoading ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted py-6">
            Loading…
          </p>
        ) : isRetryable(mgmtError) ? (
          <RetryNotice label="management data" onRetry={() => mgmtMutate()} />
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-8">
            {/* Officers */}
            <div className="lg:col-span-2 min-w-0">
              <Eyebrow className="mb-3">Key officers</Eyebrow>
              {profile.officers && profile.officers.length > 0 ? (
                <div>
                  {profile.officers.map((o) => (
                    <div
                      key={o.name}
                      className="flex items-center justify-between gap-4 py-2.5 border-b border-vela-border last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] text-zinc-100 truncate">{o.name}</p>
                        <p className="text-[12.5px] text-vela-body truncate">{o.title ?? "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[14px] tabular-nums text-zinc-100">
                          {fmtPay(o.total_pay)}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
                          {o.age ? `age ${o.age}` : ""}
                          {o.fiscal_year ? `${o.age ? " · " : ""}FY${o.fiscal_year}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Prose>Officer data not reported by source.</Prose>
              )}
            </div>

            {/* Governance risk */}
            <div className="min-w-0 lg:border-l lg:border-vela-border lg:pl-10">
              <Eyebrow className="mb-3">Governance risk</Eyebrow>
              {profile.governance ? (
                <div className="space-y-3">
                  {Object.entries(profile.governance).map(([k, score]) => (
                    <div key={k}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span
                          className="text-[12.5px] text-vela-body underline decoration-dotted decoration-vela-border underline-offset-2 cursor-help"
                          title={GOV_PILLAR_DESC[k] ?? ""}
                        >
                          {GOV_LABELS[k] ?? k}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-zinc-100 shrink-0">
                          {score}/10
                        </span>
                      </div>
                      <div className="h-[3px] bg-vela-border overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${(score / 10) * 100}%`,
                            background: score <= 3 ? "#34d399" : score <= 6 ? "#fbbf24" : "#f43f5e",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-vela-border pt-3 space-y-2">
                    <p className="text-[12px] leading-[1.55] text-vela-body">
                      <span className="text-zinc-100">ISS Governance QualityScore</span> is a decile
                      rank against index peers, not an absolute grade. 1 = lowest-risk decile,
                      10 = highest-risk decile, so a high score means higher risk relative to peers.
                    </p>
                    <p className="text-[12px] leading-[1.55] text-vela-body">
                      ISS raises scores for dual-class shares, founder or insider control, classified
                      boards and takeover defenses, and scores pay on performance alignment rather
                      than dollar size. Recently-public, founder-led companies often rank higher.
                    </p>
                    {profile.governance_as_of && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
                        As of {profile.governance_as_of} · hover a pillar for what it measures
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Prose>
                  Governance scores not reported by source. They are published mainly for larger
                  US companies.
                </Prose>
              )}
            </div>
          </div>
        ) : (
          <Prose className="py-6">Management data not reported by source for {ticker}.</Prose>
        )}
      </Section>

      {/* ── Insider activity ───────────────────────────────────── */}
      <Section
        label="Insider activity"
        labelAside="SEC form 4 · last 6 months"
        prose="Transactions reported by officers, directors, and 10% holders."
      >
        {insLoading ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted py-6">
            Loading…
          </p>
        ) : isRetryable(insError) ? (
          <RetryNotice label="insider activity" onRetry={() => insMutate()} />
        ) : ins && !ins.error ? (
          <>
            {ins.summary && (
              <StatStrip className="mb-7">
                {(["Purchases", "Sales", "Net Shares Purchased (Sold)"] as const).map((k) => {
                  const row = ins.summary?.[k];
                  const isNet = k.startsWith("Net");
                  return (
                    <StatCell
                      key={k}
                      label={isNet ? "Net shares" : k}
                      value={row?.shares != null ? fmtStmt(row.shares) : "—"}
                      sub={row?.trans != null ? `${row.trans} transactions` : "not reported"}
                      subClass="text-vela-muted"
                    />
                  );
                })}
              </StatStrip>
            )}

            {ins.transactions.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {ins.transactions.map((tx, i) => {
                  const st = TXN_STYLE[tx.type] ?? TXN_STYLE.other;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 py-2.5 border-b border-vela-border last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${st.cls}`}
                        >
                          {st.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] text-zinc-100 truncate">{tx.insider ?? "—"}</p>
                          {tx.position && (
                            <p className="text-[12.5px] text-vela-body truncate">{tx.position}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[14px] tabular-nums text-zinc-100">
                          {tx.shares != null ? `${tx.shares.toLocaleString("en-US")} sh` : "—"}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-vela-muted">
                          {tx.value != null ? fmtStmt(tx.value) : ""}
                          {tx.date ? `${tx.value != null ? " · " : ""}${tx.date}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Prose className="py-4">No insider transactions reported in the window.</Prose>
            )}
          </>
        ) : (
          <Prose className="py-6">Insider data not reported by source for {ticker}.</Prose>
        )}
      </Section>
    </PageTransition>
  );
}

export default function CompanyPage() {
  return (
    <TierGate requiredTier="navigator">
      <CompanyDeepDive />
    </TierGate>
  );
}

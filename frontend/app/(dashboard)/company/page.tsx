"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import useSWR from "swr";
import { api, apiStreamPost } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import TierGate from "@/components/shared/TierGate";
import Disclaimer from "@/components/shared/Disclaimer";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import {
  Building2, Search, Users, ShieldCheck, ArrowDownRight, ArrowUpRight,
  Gift, FileText, BarChart3, Wallet, RefreshCw, Scale,
} from "lucide-react";

/* ── helpers ────────────────────────────────────────────────── */

/** Compact statement-value formatter. Mixed units (currency, shares, EPS),
 *  so no $ prefix — large values get T/B/M/K, small values 2 decimals. */
const fmtStmt = (v: number | null): string => {
  if (v == null) return " -";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${a.toFixed(2)}`;
};

const fmtPay = (v: number | null): string => {
  if (v == null) return " -";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPct = (v: number | null): string => (v == null ? " -" : `${(v * 100).toFixed(1)}%`);

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

const TXN_STYLE: Record<string, { color: string; bg: string; label: string; Icon: typeof ArrowUpRight }> = {
  buy: { color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Buy", Icon: ArrowUpRight },
  sell: { color: "text-rose-400", bg: "bg-rose-400/10", label: "Sell", Icon: ArrowDownRight },
  gift: { color: "text-zinc-400", bg: "bg-zinc-700/40", label: "Gift", Icon: Gift },
  option: { color: "text-amber-400", bg: "bg-amber-400/10", label: "Option", Icon: FileText },
  grant: { color: "text-vela-teal", bg: "bg-vela-teal/10", label: "Grant", Icon: FileText },
  other: { color: "text-zinc-400", bg: "bg-zinc-700/40", label: "Other", Icon: FileText },
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

  return (
    <div className="vela-card space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Valuation Coaching
        </p>
        <button
          onClick={handleValuation}
          disabled={state.loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium
            bg-vela-teal/10 text-vela-teal border border-vela-teal/25
            hover:bg-vela-teal/15 hover:border-vela-teal/40
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          <Scale className="w-4 h-4 shrink-0" />
          {state.loading ? "Thinking..." : "How should I value this?"}
        </button>
      </div>

      {/* Loading state — no text yet */}
      {state.loading && state.text === "" && (
        <p className="text-[12px] text-zinc-500 italic">Thinking about valuation...</p>
      )}

      {/* Error state */}
      {state.error && (
        <p className="text-[12px] text-rose-400">{state.error}</p>
      )}

      {/* Streamed answer */}
      {state.text && (
        <div className="space-y-2">
          <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            <InlineBold text={state.text} />
          </p>
          <Disclaimer variant="inline" />
        </div>
      )}
    </div>
  );
}

function RetryNotice({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-amber-400/90">Couldn&apos;t load {label}.</p>
      <p className="text-xs text-zinc-500 max-w-sm">
        The market-data source may be rate-limiting. This is temporary: the data
        exists, it just didn&apos;t come through this time.
      </p>
      <button
        onClick={onRetry}
        className="mt-1 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}

/* ── component ──────────────────────────────────────────────── */

function CompanyDeepDive() {
  const { summary } = useDefaultPortfolio();
  const firstHolding = summary?.holdings?.[0]?.ticker ?? "AAPL";

  const [ticker, setTicker] = useState<string>(firstHolding);
  const [input, setInput] = useState("");
  const [stmtTab, setStmtTab] = useState<"income" | "balance" | "cashflow">("income");

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

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-vela-teal" /> Company Deep-Dive
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Financial statements, management, and insider activity. Filing data only.
            </p>
          </div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder={ticker}
                className="pl-9 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-vela-teal placeholder:text-zinc-500"
              />
            </div>
            <button type="submit" className="btn-primary text-sm px-4 py-2">Load</button>
          </form>
        </div>

        {/* ── Company header ─────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5">
            {mgmtLoading ? (
              <p className="text-zinc-500 text-sm">Loading {ticker}…</p>
            ) : isRetryable(mgmtError) ? (
              <RetryNotice label={`${ticker} profile`} onRetry={() => mgmtMutate()} />
            ) : mgmt && !mgmt.error ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-display font-semibold text-zinc-100">{mgmt.name ?? ticker}</p>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {[mgmt.sector, mgmt.industry].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {mgmt.website && (
                    <a href={mgmt.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-vela-teal hover:underline mt-1 inline-block">
                      {mgmt.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
                <div className="flex gap-6 text-right">
                  {mgmt.full_time_employees != null && (
                    <div>
                      <p className="text-xs text-zinc-500">Employees</p>
                      <p className="text-sm font-semibold text-zinc-100 tabular-nums">{mgmt.full_time_employees.toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500">Insider Own.</p>
                    <p className="text-sm font-semibold text-zinc-100 tabular-nums">{fmtPct(mgmt.held_percent_insiders)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Inst. Own.</p>
                    <p className="text-sm font-semibold text-zinc-100 tabular-nums">{fmtPct(mgmt.held_percent_institutions)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Company profile not reported by source for {ticker}.</p>
            )}
          </div>
        </FloatingCard>

        {/* ── AI valuation coaching ──────────────────────────── */}
        <RevealOnScroll>
          <ValuationPanel ticker={ticker} />
        </RevealOnScroll>

        {/* ── Financial statements ───────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.1}>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display font-semibold text-zinc-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-vela-teal" /> Financial Statements
                </h2>
                <div className="flex gap-1 rounded-lg bg-zinc-800/60 p-1">
                  {([["income", "Income"], ["balance", "Balance Sheet"], ["cashflow", "Cash Flow"]] as const).map(([k, lbl]) => (
                    <button key={k} onClick={() => setStmtTab(k)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        stmtTab === k ? "bg-vela-teal/20 text-vela-teal" : "text-zinc-400 hover:text-zinc-200"
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {finLoading ? (
                <p className="text-zinc-500 text-sm py-8 text-center">Loading statements…</p>
              ) : isRetryable(finError) ? (
                <RetryNotice label="financial statements" onRetry={() => finMutate()} />
              ) : activeStmt ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-xs">
                        <th className="text-left pb-3 font-medium">Line Item</th>
                        {activeStmt.periods.map((p) => (
                          <th key={p} className="text-right pb-3 font-medium tabular-nums">{p}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {activeStmt.rows.map((row) => {
                        const allEmpty = row.values.every((v) => v == null);
                        return (
                          <tr key={row.label} className={allEmpty ? "opacity-40" : ""}>
                            <td
                              className="py-2.5 text-zinc-400"
                              title={allEmpty ? "Not reported in this company's filing" : undefined}
                            >
                              {row.label}
                            </td>
                            {row.values.map((v, i) => (
                              <td key={i} className="py-2.5 text-right tabular-nums text-zinc-100">{fmtStmt(v)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-zinc-600 mt-3">
                    Values in USD (T/B/M/K). EPS and share counts shown as reported. Negative = cash outflow.
                  </p>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm py-8 text-center">
                  Financial statements are not reported by the source for {ticker} (typical for ETFs, indices, and some ADRs).
                </p>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Management & governance ────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.15}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-vela-teal" /> Management & Governance
              </h2>
              {mgmtLoading ? (
                <p className="text-zinc-500 text-sm py-6 text-center">Loading…</p>
              ) : isRetryable(mgmtError) ? (
                <RetryNotice label="management data" onRetry={() => mgmtMutate()} />
              ) : mgmt && !mgmt.error ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Officers */}
                  <div className="lg:col-span-2">
                    <p className="text-xs text-zinc-500 mb-2">Key Officers</p>
                    {mgmt.officers && mgmt.officers.length > 0 ? (
                      <div className="space-y-1.5">
                        {mgmt.officers.map((o) => (
                          <div key={o.name} className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-800/60 last:border-0">
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-100 truncate">{o.name}</p>
                              <p className="text-xs text-zinc-500 truncate">{o.title ?? "—"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm text-zinc-100 tabular-nums">{fmtPay(o.total_pay)}</p>
                              <p className="text-[10px] text-zinc-600">{o.age ? `age ${o.age}` : ""}{o.fiscal_year ? ` · FY${o.fiscal_year}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-600 text-sm">Officer data not reported by source.</p>
                    )}
                  </div>

                  {/* Governance risk */}
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Governance Risk
                    </p>
                    {mgmt.governance ? (
                      <div className="space-y-2">
                        {Object.entries(mgmt.governance).map(([k, score]) => (
                          <div key={k}>
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span
                                className="text-zinc-400 underline decoration-dotted decoration-zinc-700 underline-offset-2 cursor-help"
                                title={GOV_PILLAR_DESC[k] ?? ""}
                              >
                                {GOV_LABELS[k] ?? k}
                              </span>
                              <span className="text-zinc-300 tabular-nums">{score}/10 decile</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${(score / 10) * 100}%`,
                                  background: score <= 3 ? "#34d399" : score <= 6 ? "#fbbf24" : "#fb7185",
                                }} />
                            </div>
                          </div>
                        ))}
                        <div className="mt-3 space-y-1.5 border-t border-zinc-800/60 pt-2.5">
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            <span className="text-zinc-400">ISS Governance QualityScore</span>: a decile <em className="not-italic text-zinc-300">rank vs. index peers</em>, not an absolute grade. 1 = lowest-risk decile, 10 = highest-risk decile. A high score means higher risk relative to peers.
                          </p>
                          <p className="text-[10px] text-zinc-600 leading-relaxed">
                            ISS raises scores for dual-class shares, founder/insider control, classified boards and takeover defenses, and scores pay on performance alignment rather than dollar size. Recently-public, founder-led companies often rank higher.
                          </p>
                          {mgmt.governance_as_of && (
                            <p className="text-[10px] text-zinc-600">As of {mgmt.governance_as_of}. Hover a pillar for what it measures.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-zinc-600 text-sm">Governance scores not reported by source (published mainly for larger US companies).</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm py-6 text-center">Management data not reported by source for {ticker}.</p>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Insider activity ───────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.2}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-vela-teal" /> Insider Activity
                <span className="text-[10px] text-zinc-600 font-normal">SEC Form 4 · last 6 months</span>
              </h2>
              {insLoading ? (
                <p className="text-zinc-500 text-sm py-6 text-center">Loading…</p>
              ) : isRetryable(insError) ? (
                <RetryNotice label="insider activity" onRetry={() => insMutate()} />
              ) : ins && !ins.error ? (
                <>
                  {ins.summary && (
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {(["Purchases", "Sales", "Net Shares Purchased (Sold)"] as const).map((k) => {
                        const row = ins.summary?.[k];
                        const isNet = k.startsWith("Net");
                        return (
                          <div key={k} className="rounded-lg bg-zinc-800/40 p-3">
                            <p className="text-[11px] text-zinc-500">{isNet ? "Net Shares" : k}</p>
                            <p className="text-base font-semibold tabular-nums text-zinc-100">
                              {row?.shares != null ? fmtStmt(row.shares) : " -"}
                            </p>
                            {row?.trans != null && <p className="text-[10px] text-zinc-600">{row.trans} transactions</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {ins.transactions.length > 0 ? (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {ins.transactions.map((tx, i) => {
                        const st = TXN_STYLE[tx.type] ?? TXN_STYLE.other;
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${st.bg} ${st.color}`}>
                                <st.Icon className="w-3 h-3" /> {st.label}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm text-zinc-100 truncate">{tx.insider ?? "—"}</p>
                                <p className="text-[11px] text-zinc-500 truncate">{tx.position ?? ""}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm text-zinc-100 tabular-nums">
                                {tx.shares != null ? tx.shares.toLocaleString() : "—"} sh
                              </p>
                              <p className="text-[11px] text-zinc-500 tabular-nums">
                                {tx.value != null ? fmtStmt(tx.value) : ""}{tx.date ? ` · ${tx.date}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-sm py-4 text-center">No recent insider transactions.</p>
                  )}
                </>
              ) : (
                <p className="text-zinc-500 text-sm py-6 text-center">Insider data not reported by source for {ticker}.</p>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>
      </div>
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

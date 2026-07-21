"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Send, AlertTriangle, X, Check } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { useProfile } from "@/hooks/useProfile";
import { useGoals } from "@/hooks/useGoals";
import { useCloudStore } from "@/hooks/useCloudStore";
import { useReflectionNotes } from "@/hooks/useReflectionNotes";
import { useReflectionChat, type ChatMessage } from "@/hooks/useReflectionChat";
import { apiStreamPost } from "@/lib/api";
import { formatCurrency, stripAiMarkdown } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import TierGate from "@/components/shared/TierGate";
import Disclaimer from "@/components/shared/Disclaimer";
import { TopBar, PageHero, Eyebrow } from "@/components/instrument";

// ── Shared class tokens ───────────────────────────────────────────────────────

const BTN_TEAL =
  "inline-flex items-center justify-center gap-1.5 rounded border border-vela-teal/25 bg-vela-teal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:border-vela-teal/40 hover:bg-vela-teal/15 disabled:cursor-not-allowed disabled:opacity-40";
const BTN_QUIET =
  "inline-flex items-center justify-center gap-1.5 rounded border border-vela-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-vela-muted transition-colors hover:border-vela-teal/40 hover:text-zinc-100";

// ── Streaming helper ──────────────────────────────────────────────────────────

async function streamReflect(
  payload: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const res = await apiStreamPost("/ai/reflect", payload);
    if (res.status === 403) { onError("Reflect is a Navigator feature. Upgrade to chat with your portfolio."); return; }
    if (res.status === 429) { onError("Daily AI insight limit reached. Resets at midnight."); return; }
    if (!res.ok || !res.body) { onError("Failed to connect."); return; }

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

// ── Context panel ─────────────────────────────────────────────────────────────

/** Small mono figure pair used inside the context rail. */
function MicroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-vela-muted">{label}</p>
      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-vela-body">{value}</p>
    </div>
  );
}

function ContextPanel() {
  const { summary, portfolio, loading } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);
  const { profile } = useProfile();
  const { goals } = useGoals();
  const { notes, recentEphemeral, addEphemeral } = useReflectionNotes();

  const [quickInput, setQuickInput] = useState("");
  const [saved, setSaved] = useState(false);

  function handleAddNote() {
    if (!quickInput.trim()) return;
    addEphemeral(quickInput);
    setQuickInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const primaryGoal = goals?.[0];
  const fundedPct = primaryGoal
    ? Math.min(100, (Number(primaryGoal.current_amount) / Number(primaryGoal.target_amount)) * 100)
    : 0;

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-vela-border lg:flex">
      <div className="flex flex-1 flex-col gap-5 px-4 py-4">
        <Eyebrow>Your context</Eyebrow>

        {/* Portfolio */}
        <div>
          <Eyebrow>Portfolio</Eyebrow>
          {loading ? (
            <div className="skeleton mt-2 h-6 w-28" />
          ) : (
            <>
              <p className="mt-1.5 font-mono text-[19px] font-semibold leading-none tabular-nums text-zinc-100">
                {summary ? formatCurrency(summary.total_value ?? 0) : "—"}
              </p>
              {summary?.unrealized_pnl_pct != null && (
                <p
                  className={`mt-1.5 font-mono text-[11px] tabular-nums ${
                    summary.unrealized_pnl_pct >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {summary.unrealized_pnl_pct >= 0 ? "+" : ""}
                  {summary.unrealized_pnl_pct.toFixed(2)}% total return
                </p>
              )}
              <div className="mt-3 flex gap-4 border-t border-vela-border pt-2.5">
                {risk?.sharpe_ratio != null && (
                  <MicroStat label="Sharpe" value={risk.sharpe_ratio.toFixed(2)} />
                )}
                {risk?.annualized_volatility != null && (
                  <MicroStat label="Vol" value={`${risk.annualized_volatility.toFixed(1)}%`} />
                )}
                {summary?.holdings && (
                  <MicroStat label="Positions" value={summary.holdings.length} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Holdings */}
        {summary?.holdings && summary.holdings.length > 0 && (
          <div className="border-t border-vela-border pt-4">
            <Eyebrow className="mb-2">Holdings</Eyebrow>
            {(() => {
              const total = summary.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
              return summary.holdings
                .slice()
                .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
                .slice(0, 6)
                .map((h) => {
                  const wt = total > 0 ? ((h.market_value ?? 0) / total) * 100 : 0;
                  const pnl = h.unrealized_pnl_pct ?? null;
                  return (
                    <div key={h.ticker} className="flex items-baseline justify-between gap-2 py-1">
                      <span className="font-mono text-[12px] tracking-[0.04em] text-zinc-100">
                        {h.ticker}
                      </span>
                      <span className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
                        <span className="text-vela-muted">{wt.toFixed(0)}%</span>
                        {pnl != null && (
                          <span className={pnl >= 0 ? "text-gain" : "text-loss"}>
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                  );
                });
            })()}
            {summary.holdings.length > 6 && (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-vela-muted">
                +{summary.holdings.length - 6} more
              </p>
            )}
          </div>
        )}

        {/* Thesis */}
        <div className="border-t border-vela-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-[6px] w-[6px] rotate-45 bg-vela-teal" />
              <Eyebrow>Thesis notes</Eyebrow>
            </div>
            <Link
              href="/thesis"
              className="font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:text-zinc-100"
            >
              View
            </Link>
          </div>
          <p className="mt-2 text-[12px] leading-[1.5] text-vela-body">
            More thesis notes = more accurate reflection of your actual reasoning
          </p>
        </div>

        {/* Goals */}
        {primaryGoal && (
          <div className="border-t border-vela-border pt-4">
            <Eyebrow>Primary goal</Eyebrow>
            <p className="mt-1.5 text-[12.5px] leading-snug text-vela-body">{primaryGoal.name}</p>
            <div className="mt-2 h-[3px] w-full overflow-hidden bg-vela-border">
              <div className="h-full bg-vela-teal" style={{ width: `${fundedPct}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
              {fundedPct.toFixed(0)}% funded
            </p>
          </div>
        )}

        {/* Profile pills */}
        <div className="border-t border-vela-border pt-4">
          <Eyebrow className="mb-2">Profile</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded border border-vela-teal/30 bg-vela-teal/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-vela-teal">
              {profile.riskTolerance}
            </span>
            <span className="rounded border border-vela-teal/30 bg-vela-teal/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-vela-teal">
              {profile.sophistication}
            </span>
            <span className="rounded border border-vela-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider tabular-nums text-vela-body">
              Age {profile.age}
            </span>
            <span className="rounded border border-vela-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider tabular-nums text-vela-body">
              {profile.marginalTaxRate}% tax
            </span>
          </div>
        </div>

        {/* Quick notes capture */}
        <div className="border-t border-vela-border pt-4">
          <Eyebrow className="mb-2">Quick notes</Eyebrow>
          <div className="relative">
            <textarea
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); } }}
              placeholder="Jot a market observation or conviction…"
              rows={3}
              className="w-full resize-none rounded border border-vela-border bg-vela-card px-2.5 py-2 text-[12px] leading-relaxed text-vela-body outline-none transition-colors placeholder:text-vela-muted focus:border-vela-teal/50"
            />
            <button
              onClick={handleAddNote}
              disabled={!quickInput.trim()}
              className="absolute bottom-2 right-2 font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:text-zinc-100 disabled:text-vela-muted"
            >
              {saved ? <><Check className="-mt-0.5 inline h-3 w-3" /> Saved</> : "Save"}
            </button>
          </div>
          {(notes.flagged.length > 0 || recentEphemeral.length > 0) && (
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
              {notes.flagged.length} pinned · {notes.ephemeral.length} working
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Chat message bubble ───────────────────────────────────────────────────────

function AssistantMark({ size = "h-[22px] w-[22px]" }: { size?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${size} mt-0.5 flex shrink-0 items-center justify-center rounded border border-vela-teal/30 bg-vela-teal/10 font-mono text-[10px] font-medium text-vela-teal`}
    >
      V
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  // Don't render empty assistant placeholder — TypingIndicator handles that state
  if (msg.role === "assistant" && msg.content === "") return null;
  const isAssistant = msg.role === "assistant";
  return (
    <div className={`flex max-w-[88%] gap-2.5 ${isAssistant ? "" : "ml-auto flex-row-reverse"}`}>
      {isAssistant && <AssistantMark />}
      <div
        className={`whitespace-pre-line rounded border px-3.5 py-2.5 text-[13px] leading-[1.6] text-vela-body ${
          isAssistant
            ? "border-vela-border bg-vela-card"
            : "border-vela-teal/20 bg-vela-teal/[0.06]"
        }`}
      >
        {isAssistant ? stripAiMarkdown(msg.content) : msg.content}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex max-w-[88%] gap-2.5">
      <AssistantMark />
      <div className="rounded border border-vela-border bg-vela-card px-3.5 py-3">
        <div className="flex h-[14px] items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[5px] w-[5px] rotate-45 bg-vela-teal"
              style={{ animation: `blink 1.2s ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReflectPage() {
  const { portfolio, summary, loading } = useDefaultPortfolio();
  const { profile } = useProfile();
  const { notes, recentEphemeral } = useReflectionNotes();
  const { messages, appendMessage, appendChunkToLast, finaliseLastMessage, clearChat } = useReflectionChat();
  const { data: thesesData } = useCloudStore<unknown[]>("theses");

  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build the payload sent to /ai/reflect
  const buildPayload = useCallback((userMessages: ChatMessage[], isOpening: boolean) => {
    const theses = Array.isArray(thesesData) ? thesesData.map((t: any) => ({
      ticker: t.ticker ?? "",
      stance: t.stance ?? "neutral",
      title: t.title ?? "",
      body: t.body ?? "",
    })) : [];

    return {
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
      profile: {
        age: profile.age,
        riskTolerance: profile.riskTolerance,
        sophistication: profile.sophistication,
        marginalTaxRate: profile.marginalTaxRate,
        primaryObjective: profile.primaryObjective,
        timeHorizon: profile.timeHorizon,
        deEmphasize: profile.deEmphasize,
        philosophy: profile.philosophy,
      },
      flagged_notes: notes.flagged.map((n) => ({ id: n.id, content: n.content, created_at: n.created_at })),
      ephemeral_notes: recentEphemeral.map((n) => ({ id: n.id, content: n.content, created_at: n.created_at })),
      thesis_notes: theses,
      is_opening: isOpening,
    };
  }, [profile, notes, recentEphemeral, thesesData]);

  // Note: Reflect intentionally does NOT auto-start a conversation. An AI call on
  // every page load is abrupt and costs credits each visit. Instead the empty
  // state shows a static greeting + suggested starters; the first /ai/reflect call
  // only fires once the user picks a starter or sends a message.

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function handleSend(starter?: string) {
    // `starter` is only a string when called from a starter button. Guard against
    // call sites that pass a click event (e.g. onClick={handleSend}).
    const text = (typeof starter === "string" ? starter : input).trim();
    if (!text || streaming) return;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text, timestamp: new Date().toISOString() };
    const withUser = appendMessage(userMsg);
    setInput("");
    setStreaming(true);

    const placeholder: ChatMessage = { role: "assistant", content: "", timestamp: new Date().toISOString() };
    const withPlaceholder = [...withUser, placeholder].slice(-50);
    finaliseLastMessage(withPlaceholder);

    let accumulated = "";
    streamReflect(
      buildPayload(withUser, false),
      (chunk) => {
        accumulated += chunk;
        appendChunkToLast(chunk);
      },
      () => {
        setStreaming(false);
        finaliseLastMessage(withPlaceholder.map((m, i) =>
          i === withPlaceholder.length - 1 ? { ...m, content: accumulated } : m
        ));
      },
      (err) => {
        setStreaming(false);
        setError(err);
        // Don't leave or persist an empty assistant bubble on failure. Keep any
        // partial text that did stream; otherwise drop the placeholder entirely.
        if (accumulated.trim()) {
          finaliseLastMessage(
            withPlaceholder.map((m, i) =>
              i === withPlaceholder.length - 1 ? { ...m, content: accumulated } : m,
            ),
          );
        } else {
          finaliseLastMessage(withUser);
        }
      },
    );
  }

  function handleClear() {
    clearChat();
  }

  // Suggested conversation starters for the empty state. Built from simple local
  // data (no API call) — context-aware where it's cheap to be.
  const topTicker = summary?.holdings
    ?.slice()
    .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))[0]?.ticker;
  const hasNotes = notes.flagged.length > 0 || recentEphemeral.length > 0;
  const starters = [
    "What does my buy and sell history say about my patience?",
    topTicker ? `Walk me through what I wrote about ${topTicker} versus what actually happened` : "Which of my past convictions have aged best?",
    hasNotes ? "React to my latest notes" : "What have I been overlooking lately?",
    "Where have I stuck to my own strategy, and where have I drifted from it?",
  ];

  if (loading && messages.length === 0) return <DashboardSkeleton />;

  return (
    <TierGate requiredTier="navigator">
    <PageTransition className="flex h-[calc(100vh-4rem)] flex-col">
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; transform: rotate(45deg) translateY(0); }
          50% { opacity: 1; transform: rotate(45deg) translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes blink {
            0%, 100% { opacity: 0.5; transform: rotate(45deg); }
          }
        }
      `}</style>

      <div className="shrink-0">
        <TopBar
          trail={[{ label: "Journal" }, { label: "Reflect" }]}
          note="retrospective only · decisions you already made"
        />
        <PageHero
          title="Reflect"
          meta="Looking backwards at your own record, not forwards at the market"
        />
      </div>

      {/* Shell */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden border border-vela-border">

        {/* Top rail */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-vela-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-[7px] w-[7px] rotate-45 bg-vela-teal" />
            <Eyebrow>Conversation</Eyebrow>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-vela-muted sm:inline">
              claude-sonnet
            </span>
            {messages.length > 0 && (
              <button
                onClick={() => handleSend("Wrap up this thread. Give me your takeaway and one concrete next step. No more questions.")}
                disabled={streaming}
                title="Get a conclusion and next step"
                className={BTN_TEAL}
              >
                Land it
              </button>
            )}
            <button onClick={handleClear} className={BTN_QUIET}>
              Clear chat
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          <ContextPanel />

          {/* Chat area */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* Messages */}
            <div className="relative z-10 flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2 pt-5">
              {messages.length === 0 && !streaming && (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded border border-vela-teal/30 bg-vela-teal/10 font-mono text-[14px] font-medium text-vela-teal"
                  >
                    V
                  </span>
                  <div className="max-w-md space-y-2">
                    <p className="font-display text-[19px] font-semibold text-zinc-100">Let&apos;s think through your portfolio</p>
                    <p className="text-[13.5px] leading-[1.55] text-vela-body">
                      Not to grade it. Just to ask good questions and notice what you might have missed.
                      Pick a thread to start, or tell me what&apos;s on your mind.
                    </p>
                  </div>
                  <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="rounded border border-vela-border px-3 py-2.5 text-left text-[12.5px] leading-snug text-vela-body transition-colors hover:border-vela-teal/40 hover:text-zinc-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/calibration"
                    className="font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:text-zinc-100"
                  >
                    Or see how your conviction has actually scored
                  </Link>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {streaming && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compliance disclaimer — shown once when AI has responded */}
            {messages.some((m) => m.role === "assistant" && m.content !== "") && (
              <div className="px-4 pb-1">
                <Disclaimer variant="inline" />
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mx-4 mb-1 flex items-start gap-2 rounded border border-loss/30 bg-loss/10 px-3 py-2 text-[12.5px] text-loss">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="shrink-0 text-loss transition-colors hover:text-zinc-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="relative z-10 flex shrink-0 items-end gap-2 border-t border-vela-border px-4 pb-4 pt-2.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={streaming}
                placeholder="Your thoughts… (⌘↵ to send)"
                rows={1}
                style={{ maxHeight: "96px" }}
                className="flex-1 resize-none rounded border border-vela-border bg-vela-card px-3 py-2.5 text-[13px] leading-relaxed text-vela-body outline-none transition-colors placeholder:text-vela-muted focus:border-vela-teal/50 disabled:opacity-40"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || streaming}
                aria-label="Send message"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded border border-vela-teal/25 bg-vela-teal/10 text-vela-teal transition-colors hover:border-vela-teal/40 hover:bg-vela-teal/15 disabled:cursor-not-allowed disabled:border-vela-border disabled:bg-transparent disabled:text-vela-muted"
              >
                <Send className="h-[15px] w-[15px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}

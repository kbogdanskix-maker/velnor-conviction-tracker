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
import { formatCurrency } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";
import TierGate from "@/components/shared/TierGate";

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
    <div className="w-60 min-w-60 border-r border-zinc-900 bg-[#080808] flex flex-col overflow-y-auto">
      <div className="p-3.5 flex flex-col gap-3 flex-1">
        <p className="text-[9.5px] font-semibold text-zinc-600 uppercase tracking-widest">Your context</p>

        {/* Portfolio */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <p className="text-[9.5px] text-zinc-500 mb-1 font-medium">Portfolio</p>
          {loading ? (
            <div className="h-8 bg-zinc-800/30 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-[15px] font-semibold text-zinc-100 tabular-nums tracking-tight">
                {summary ? formatCurrency(summary.total_value ?? 0) : "—"}
              </p>
              {summary?.unrealized_pnl_pct != null && (
                <p className={`text-[11px] tabular-nums mt-0.5 ${summary.unrealized_pnl_pct >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                  {summary.unrealized_pnl_pct >= 0 ? "+" : ""}{summary.unrealized_pnl_pct.toFixed(2)}% total return
                </p>
              )}
              <div className="flex gap-2.5 mt-2 pt-2 border-t border-[#161616]">
                {risk?.sharpe_ratio != null && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Sharpe</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{risk.sharpe_ratio.toFixed(2)}</p>
                  </div>
                )}
                {risk?.annualized_volatility != null && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Volatility</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{risk.annualized_volatility.toFixed(1)}%</p>
                  </div>
                )}
                {summary?.holdings && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Positions</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{summary.holdings.length}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Holdings */}
        {summary?.holdings && summary.holdings.length > 0 && (
          <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
            <p className="text-[9.5px] text-zinc-500 mb-1.5 font-medium">Holdings</p>
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
                    <div key={h.ticker} className="flex justify-between items-center py-[3px]">
                      <span className="text-[11.5px] font-medium text-zinc-300 font-mono">{h.ticker}</span>
                      <div className="flex flex-col items-end gap-px">
                        <span className="text-[10px] text-zinc-500 tabular-nums">{wt.toFixed(0)}%</span>
                        {pnl != null && (
                          <span className={`text-[11px] tabular-nums font-medium ${pnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
            })()}
            {summary.holdings.length > 6 && (
              <p className="text-[9.5px] text-zinc-600 mt-1">+{summary.holdings.length - 6} more</p>
            )}
          </div>
        )}

        {/* Thesis */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[5px] h-[5px] rounded-full bg-teal-500" />
              <span className="text-[12px] text-zinc-300">Thesis notes</span>
            </div>
            <Link href="/thesis" className="text-[10px] text-teal-500 hover:text-teal-400 transition-colors">
              View →
            </Link>
          </div>
          <p className="text-[9.5px] text-zinc-600 mt-1.5 leading-relaxed border-t border-[#161616] pt-1.5">
            More thesis notes = more accurate reflection of your actual reasoning
          </p>
        </div>

        {/* Goals */}
        {primaryGoal && (
          <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
            <p className="text-[9.5px] text-zinc-500 mb-1 font-medium">Primary goal</p>
            <p className="text-[12px] text-zinc-300 mb-1.5">{primaryGoal.name}</p>
            <div className="h-[3px] bg-[#161616] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-600 to-teal-500 rounded-full" style={{ width: `${fundedPct}%` }} />
            </div>
            <p className="text-[9.5px] text-zinc-500 mt-1">{fundedPct.toFixed(0)}% funded</p>
          </div>
        )}

        {/* Profile pills */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <p className="text-[9.5px] text-zinc-500 mb-1.5 font-medium">Profile</p>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-teal-500/30 text-teal-500 bg-teal-500/5 font-medium capitalize">{profile.riskTolerance}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-teal-500/30 text-teal-500 bg-teal-500/5 font-medium capitalize">{profile.sophistication}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700 text-zinc-400">Age {profile.age}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700 text-zinc-400">{profile.marginalTaxRate}% tax</span>
          </div>
        </div>

        {/* Quick notes capture */}
        <div>
          <p className="text-[9.5px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Quick notes</p>
          <div className="relative">
            <textarea
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); } }}
              placeholder="Jot a market observation or conviction…"
              rows={3}
              className="w-full bg-[#0c0c0c] border border-[#161616] focus:border-teal-500/40 rounded-[8px] px-2.5 py-2 text-[11.5px] text-zinc-300 placeholder-zinc-700 resize-none outline-none transition-colors leading-relaxed"
            />
            <button
              onClick={handleAddNote}
              disabled={!quickInput.trim()}
              className="absolute bottom-2 right-2 text-[10px] text-teal-500 disabled:text-zinc-700 hover:text-teal-400 transition-colors"
            >
              {saved ? <><Check className="w-3 h-3 inline -mt-0.5" /> Saved</> : "Save"}
            </button>
          </div>
          {(notes.flagged.length > 0 || recentEphemeral.length > 0) && (
            <p className="text-[9.5px] text-zinc-600 mt-1">
              {notes.flagged.length} pinned · {notes.ephemeral.length} working
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat message bubble ───────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  // Don't render empty assistant placeholder — TypingIndicator handles that state
  if (msg.role === "assistant" && msg.content === "") return null;
  return (
    <div className={`flex gap-2.5 max-w-[88%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
      <div className={`w-[25px] h-[25px] min-w-[25px] rounded-full flex items-center justify-center text-[10px] font-semibold mt-0.5 shrink-0 ${
        msg.role === "assistant"
          ? "bg-teal-700 text-white"
          : "bg-zinc-900 text-zinc-500 border border-zinc-800"
      }`}>
        {msg.role === "assistant" ? "V" : ""}
      </div>
      <div className={`px-3.5 py-2.5 rounded-[13px] text-[12.5px] leading-[1.65] ${
        msg.role === "assistant"
          ? "bg-[#0f0f0f] border border-[#181818] rounded-tl-[4px] text-zinc-300 shadow-[0_2px_10px_#00000035]"
          : "bg-[#0c1a1a] border border-teal-500/[0.15] rounded-tr-[4px] text-zinc-300"
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 max-w-[88%]">
      <div className="w-[25px] h-[25px] min-w-[25px] rounded-full flex items-center justify-center bg-teal-700 text-white text-[10px] font-semibold shrink-0">V</div>
      <div className="px-3.5 py-3 rounded-[13px] rounded-tl-[4px] bg-[#0f0f0f] border border-[#181818]">
        <div className="flex gap-1 items-center h-[14px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-[5px] h-[5px] rounded-full bg-teal-500"
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
    "Where am I most concentrated, and should that worry me?",
    topTicker ? `Talk me through my ${topTicker} position` : "Is my allocation aligned with my goals?",
    hasNotes ? "React to my latest notes" : "What am I not paying attention to?",
    "Is my risk level actually right for me?",
  ];

  if (loading && messages.length === 0) return <DashboardSkeleton />;

  return (
    <TierGate requiredTier="navigator">
    <PageTransition className="h-[calc(100vh-4rem)] flex flex-col">
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>

      {/* Shell */}
      <div className="flex-1 flex flex-col border border-zinc-900 rounded-xl overflow-hidden shadow-[0_0_0_1px_#ffffff06,0_32px_64px_-16px_#000000cc] min-h-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-gradient-to-b from-zinc-950 to-transparent shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-[7px] h-[7px] rounded-full bg-teal-500" />
            <span className="text-[14px] font-semibold text-zinc-100 tracking-tight">Reflect</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-700 font-mono">claude-sonnet</span>
            {messages.length > 0 && (
              <button
                onClick={() => handleSend("Wrap up this thread. Give me your takeaway and one concrete next step. No more questions.")}
                disabled={streaming}
                title="Get a conclusion and next step"
                className="text-[11px] text-teal-500 hover:text-teal-400 border border-teal-500/30 hover:border-teal-500/50 px-2 py-0.5 rounded transition-all disabled:opacity-40"
              >
                Land it
              </button>
            )}
            <button
              onClick={handleClear}
              className="text-[11px] text-zinc-700 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 rounded transition-all"
            >
              Clear chat
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          <ContextPanel />

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,#1AA8BB09_0%,transparent_70%)] pointer-events-none" />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2 flex flex-col gap-4 relative z-10">
              {messages.length === 0 && !streaming && (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-5">
                  <div className="w-11 h-11 rounded-full bg-teal-700 flex items-center justify-center text-white text-[15px] font-semibold">
                    V
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <p className="text-[15px] font-semibold text-zinc-100">Let&apos;s think through your portfolio</p>
                    <p className="text-[12.5px] text-zinc-500 leading-relaxed">
                      Not to grade it. Just to ask good questions and notice what you might have missed.
                      Pick a thread to start, or tell me what&apos;s on your mind.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="text-left text-[12px] text-zinc-300 bg-[#0f0f0f] border border-[#181818] hover:border-teal-500/30 hover:bg-[#0c1414] rounded-[10px] px-3 py-2.5 transition-colors leading-snug"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
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

            {/* Error banner */}
            {error && (
              <div className="mx-3.5 mb-1 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-rose-400/70 hover:text-rose-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Input */}
            <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-900 flex gap-2 items-end relative z-10 shrink-0">
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
                className="flex-1 bg-[#0f0f0f] border border-[#181818] focus:border-teal-500/30 rounded-[9px] px-3 py-2.5 text-[12.5px] text-zinc-300 placeholder-zinc-700 resize-none outline-none transition-colors leading-relaxed disabled:opacity-40"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || streaming}
                className="w-[34px] h-[34px] bg-teal-500 hover:bg-teal-400 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-[8px] flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-[14px] h-[14px] text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
    </TierGate>
  );
}

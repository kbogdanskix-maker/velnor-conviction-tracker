"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen, Zap, ArrowRight, X, ChevronRight,
  Clock, ExternalLink, Lightbulb, CheckCircle2,
  Sparkles, Search, Loader2, ShieldAlert, Calculator, ChevronDown,
} from "lucide-react";
import {
  LEARN_CONTENT, CATEGORY_LABELS, CATEGORY_COLORS,
  type LearnItem, type Playbook, type DeepDive, type LearnCategory, type MiniToolDef,
} from "@/lib/learn-content";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { apiStreamPost } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "all" | "playbook" | "deepdive";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = Object.keys(CATEGORY_LABELS) as LearnCategory[];

// ── Helpers ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: "playbook" | "deepdive" }) {
  if (type === "playbook") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/25">
        <Zap className="w-2.5 h-2.5" /> Playbook
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-400 border border-zinc-700">
      <BookOpen className="w-2.5 h-2.5" /> Deep Dive
    </span>
  );
}

function CatBadge({ cat }: { cat: LearnCategory }) {
  const c = CATEGORY_COLORS[cat];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {CATEGORY_LABELS[cat]}
    </span>
  );
}

function AdvancedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30">
      <ShieldAlert className="w-2.5 h-2.5" /> High Risk · Expert
    </span>
  );
}

// ── Prose renderer  - handles paragraphs and "- item" bullet lists ─────────────

function Prose({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => l.startsWith("- ") || l.trim() === "");
        if (isList) {
          return (
            <ul key={i} className="space-y-1.5 pl-0">
              {lines.filter((l) => l.startsWith("- ")).map((l, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-1 h-1 rounded-full bg-zinc-500 mt-2" />
                  <span>{l.slice(2)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

// ── Grid Card ─────────────────────────────────────────────────────────────────

function PlaybookCard({ item, onClick }: { item: Playbook; onClick: () => void }) {
  const c = CATEGORY_COLORS[item.category];
  return (
    <button
      onClick={onClick}
      className="group text-left w-full vela-card p-0 overflow-hidden hover:border-zinc-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r from-teal-500/80 to-teal-500/0`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type="playbook" />
            <CatBadge cat={item.category} />
            {item.category === "advanced" && <AdvancedBadge />}
          </div>
          <span className="flex items-center gap-1 text-[10px] text-zinc-600 whitespace-nowrap shrink-0">
            <Clock className="w-3 h-3" /> {item.readMin}m
          </span>
        </div>

        {/* Title */}
        <h3 className={`text-sm font-semibold text-zinc-100 mb-1.5 leading-snug transition-colors ${item.category === "advanced" ? "group-hover:text-orange-300" : "group-hover:text-teal-300"}`}>
          {item.title}
        </h3>
        <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{item.tagline}</p>

        {/* Step preview */}
        <div className="space-y-1.5 mb-4">
          {item.steps.slice(0, 3).map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-500 flex items-center justify-center mt-px">
                {i + 1}
              </span>
              <span className="text-[11px] text-zinc-500 leading-relaxed line-clamp-1">{step.title}</span>
            </div>
          ))}
          {item.steps.length > 3 && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-[11px] text-zinc-600">+{item.steps.length - 3} more steps</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className={`flex items-center gap-1 text-xs font-medium text-teal-400 group-hover:gap-2 transition-all`}>
          Open playbook <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}

function DeepDiveCard({ item, onClick }: { item: DeepDive; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full vela-card p-0 overflow-hidden hover:border-zinc-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Subtle gradient mesh bg */}
      <div className="relative p-5">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, #1AA8BB, transparent 70%)" }} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type="deepdive" />
            <CatBadge cat={item.category} />
            {item.category === "advanced" && <AdvancedBadge />}
          </div>
          <span className="flex items-center gap-1 text-[10px] text-zinc-600 whitespace-nowrap shrink-0">
            <Clock className="w-3 h-3" /> {item.readMin}m
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-zinc-100 mb-1.5 leading-snug group-hover:text-zinc-200 transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2 italic">{item.tagline}</p>

        {/* Opening excerpt */}
        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 mb-4 border-l-2 border-zinc-700 pl-3">
          {item.opening}
        </p>

        {/* Takeaway count */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <CheckCircle2 className="w-3 h-3 text-zinc-600" />
            {item.takeaways.length} key takeaways
          </div>
          <span className="text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-600">{item.sections.length} sections</span>
        </div>
      </div>
    </button>
  );
}

// ── Detail Panel  - Playbook ───────────────────────────────────────────────────

function PlaybookDetail({ item }: { item: Playbook }) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <div>
        <p className="text-zinc-400 text-sm leading-relaxed">{item.tagline}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.readMin} min read</span>
          <span>·</span>
          <span>{item.steps.length} steps</span>
          <span>·</span>
          <CatBadge cat={item.category} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {item.steps.map((step, i) => (
          <div key={i} className="relative flex gap-5 pb-8 last:pb-0">
            {/* Connector line */}
            {i < item.steps.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-px bg-zinc-800" />
            )}
            {/* Step number */}
            <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center z-10">
              <span className="text-sm font-bold tabular text-teal-400">{i + 1}</span>
            </div>
            {/* Content */}
            <div className="flex-1 pt-1.5 min-w-0">
              <h4 className="text-sm font-semibold text-zinc-100 mb-2">{step.title}</h4>
              <Prose text={step.body} className="text-sm text-zinc-400 leading-relaxed mb-3" />

              {step.tip && (
                <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-3">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80 leading-relaxed">{step.tip}</p>
                </div>
              )}

              {step.tool && (
                <Link
                  href={step.tool.href}
                  className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors group/tool"
                >
                  <ExternalLink className="w-3 h-3" />
                  {step.tool.label}
                  <ChevronRight className="w-3 h-3 group-hover/tool:translate-x-0.5 transition-transform" />
                </Link>
              )}

              {step.miniTool && <MiniToolRenderer tool={step.miniTool} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail Panel  - Deep Dive ──────────────────────────────────────────────────

function DeepDiveDetail({ item }: { item: DeepDive }) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <div>
        <p className="text-zinc-400 text-sm leading-relaxed italic mb-3">{item.tagline}</p>
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.readMin} min read</span>
          <span>·</span>
          <span>{item.sections.length} sections</span>
          <span>·</span>
          <CatBadge cat={item.category} />
        </div>
      </div>

      {/* Opening */}
      <p className="text-base text-zinc-300 leading-relaxed font-light border-l-2 border-teal-500/40 pl-4">
        {item.opening}
      </p>

      {/* Sections */}
      <div className="space-y-8">
        {item.sections.map((section, i) => (
          <div key={i} className="space-y-3">
            {section.heading && (
              <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <span className="w-1 h-4 bg-teal-500/60 rounded-full inline-block" />
                {section.heading}
              </h4>
            )}
            <Prose text={section.body} className="text-sm text-zinc-400 leading-relaxed" />

            {section.callout && (
              <div className="relative bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3.5 my-4">
                <div className="absolute -left-px top-4 bottom-4 w-0.5 bg-teal-500/50 rounded-full" />
                <p className="text-sm text-zinc-300 leading-relaxed pl-2">{section.callout}</p>
              </div>
            )}

            {section.tool && (
              <Link
                href={section.tool.href}
                className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors group/tool"
              >
                <ExternalLink className="w-3 h-3" />
                {section.tool.label}
                <ChevronRight className="w-3 h-3 group-hover/tool:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Key Takeaways */}
      <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Key Takeaways
        </h4>
        <ul className="space-y-3">
          {item.takeaways.map((t, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-teal-500/60 mt-1.5" />
              <span className="text-sm text-zinc-300 leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Mini Tools ────────────────────────────────────────────────────────────────

/** Shared wrapper: collapsible container with a "Try it" toggle */
function MiniToolShell({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
          open
            ? "bg-zinc-800 border-zinc-600 text-zinc-200"
            : "bg-zinc-900/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
        }`}
      >
        <Calculator className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        {label}
        <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 bg-zinc-900/70 border border-zinc-700/60 rounded-xl p-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** Shared number input */
function ToolInput({
  label, value, onChange, prefix = "", suffix = "", placeholder = "0",
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-zinc-500">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 tabular-nums outline-none focus:border-teal-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-xs text-zinc-500 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

/** Result row */
function ToolResult({ label, value, highlight = false, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
      <div>
        <p className="text-xs text-zinc-400">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      <p className={`text-sm font-bold tabular shrink-0 ${highlight ? "text-teal-300" : "text-zinc-200"}`}>{value}</p>
    </div>
  );
}

// ── Tool 1: Position from Loss ────────────────────────────────────────────────

function PositionFromLossTool() {
  const [portfolio, setPortfolio] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
  const [drawdown, setDrawdown] = useState("25");

  const pv = parseFloat(portfolio) || 0;
  const ml = parseFloat(maxLoss) || 0;
  const dd = parseFloat(drawdown) || 0;

  const posSize = dd > 0 ? (ml / (dd / 100)) : 0;
  const posPct = pv > 0 ? (posSize / pv) * 100 : 0;

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return (
    <MiniToolShell label="Calculate your position size">
      <div className="grid grid-cols-2 gap-3">
        <ToolInput label="Portfolio value" value={portfolio} onChange={setPortfolio} prefix="$" placeholder="100000" />
        <ToolInput label="Max dollar loss" value={maxLoss} onChange={setMaxLoss} prefix="$" placeholder="2000" />
      </div>
      <ToolInput label="Exit drawdown %" value={drawdown} onChange={setDrawdown} suffix="%" placeholder="25" />
      {posSize > 0 && (
        <div className="pt-1 border-t border-zinc-800">
          <ToolResult label="Max position size" value={fmt(posSize)} highlight sub="= max loss ÷ exit drawdown %" />
          {pv > 0 && <ToolResult label="As % of portfolio" value={`${posPct.toFixed(1)}%`} />}
          {posPct > 20 && (
            <p className="text-[11px] text-orange-400/80 mt-2">
              Above 20%  - consider whether the thesis justifies this concentration.
            </p>
          )}
        </div>
      )}
    </MiniToolShell>
  );
}

// ── Tool 2: Tax Harvest Savings ───────────────────────────────────────────────

const TAX_RATES = [
  { label: "15% (long-term)", value: 15 },
  { label: "20% (high income)", value: 20 },
  { label: "37% (short-term / ordinary)", value: 37 },
];

function TaxHarvestTool() {
  const [loss, setLoss] = useState("");
  const [rate, setRate] = useState(20);
  const [years, setYears] = useState("5");

  const lv = parseFloat(loss) || 0;
  const yv = parseFloat(years) || 5;
  const saving = lv * (rate / 100);
  const deferralGrowth = saving * Math.pow(1.08, yv) - saving;
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <MiniToolShell label="Calculate your tax saving">
      <ToolInput label="Unrealized loss" value={loss} onChange={setLoss} prefix="$" placeholder="10000" />
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Tax rate</label>
        <div className="flex flex-wrap gap-1.5">
          {TAX_RATES.map((t) => (
            <button
              key={t.value}
              onClick={() => setRate(t.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                rate === t.value
                  ? "bg-teal-500/15 text-teal-300 border-teal-500/40"
                  : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ToolInput label="Reinvestment horizon (years)" value={years} onChange={setYears} suffix="yrs" placeholder="5" />
      {lv > 0 && (
        <div className="pt-1 border-t border-zinc-800">
          <ToolResult label="Immediate tax saving" value={fmt(saving)} highlight sub={`${rate}% of ${fmt(lv)} loss`} />
          <ToolResult label="Deferral value at 8% growth" value={`+${fmt(deferralGrowth)}`} sub={`over ${yv} years before the deferred tax is due`} />
          <p className="text-[11px] text-zinc-600 mt-2">
            The tax is deferred, not eliminated. When you sell the replacement security, the lower cost basis triggers this gain.
          </p>
        </div>
      )}
    </MiniToolShell>
  );
}

// ── Tool 3: Expected Value ────────────────────────────────────────────────────

function ExpectedValueTool() {
  const [current, setCurrent] = useState("");
  const [bullTarget, setBullTarget] = useState("");
  const [bullProb, setBullProb] = useState("30");
  const [bearTarget, setBearTarget] = useState("");
  const [bearProb, setBearProb] = useState("30");
  const [baseTarget, setBaseTarget] = useState("");

  const cp = parseFloat(current) || 0;
  const bt = parseFloat(bullTarget) || 0;
  const bp = parseFloat(bullProb) / 100 || 0;
  const brt = parseFloat(bearTarget) || 0;
  const brp = parseFloat(bearProb) / 100 || 0;
  const basep = Math.max(0, 1 - bp - brp);
  const baset = parseFloat(baseTarget) || 0;

  const totalProb = bp + brp;
  const probWarning = totalProb > 1;

  const ev = cp > 0 ? (bt * bp + baset * basep + brt * brp) : 0;
  const evReturn = cp > 0 ? ((ev - cp) / cp) * 100 : 0;
  const isPositive = evReturn > 0;

  const fmt$ = (n: number) => `$${n.toFixed(2)}`;
  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  return (
    <MiniToolShell label="Run the expected value math">
      <ToolInput label="Current price" value={current} onChange={setCurrent} prefix="$" placeholder="50.00" />
      <div className="grid grid-cols-2 gap-3">
        <ToolInput label="Bull target ($)" value={bullTarget} onChange={setBullTarget} prefix="$" placeholder="150" />
        <ToolInput label="Bull probability (%)" value={bullProb} onChange={setBullProb} suffix="%" placeholder="30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ToolInput label="Base target ($)" value={baseTarget} onChange={setBaseTarget} prefix="$" placeholder="70" />
        <div className="flex items-end pb-1">
          <p className="text-xs text-zinc-500">
            Base prob: <span className="text-zinc-300 tabular">{(basep * 100).toFixed(0)}%</span>
            {probWarning && <span className="text-rose-400 ml-1">(probabilities exceed 100%)</span>}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ToolInput label="Bear target ($)" value={bearTarget} onChange={setBearTarget} prefix="$" placeholder="30" />
        <ToolInput label="Bear probability (%)" value={bearProb} onChange={setBearProb} suffix="%" placeholder="30" />
      </div>
      {ev > 0 && cp > 0 && !probWarning && (
        <div className="pt-1 border-t border-zinc-800">
          <ToolResult label="Expected value" value={fmt$(ev)} highlight />
          <ToolResult
            label="Expected return"
            value={fmtPct(evReturn)}
            highlight
            sub={isPositive ? "Positive expected value  - asymmetry exists" : "Negative expected value  - risk may not be compensated"}
          />
          <div className="mt-2 space-y-1">
            {[
              { label: "Bull", p: bp, t: bt },
              { label: "Base", p: basep, t: baset },
              { label: "Bear", p: brp, t: brt },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 w-8">{s.label}</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.label === "Bull" ? "bg-emerald-500/60" : s.label === "Bear" ? "bg-rose-500/60" : "bg-zinc-500/60"}`}
                    style={{ width: `${s.p * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 tabular w-8 text-right">{(s.p * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-zinc-400 tabular w-14 text-right">{fmt$(s.t)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </MiniToolShell>
  );
}

// ── Tool 4: Drawdown Recovery ─────────────────────────────────────────────────

function DrawdownRecoveryTool() {
  const [drawdown, setDrawdown] = useState("30");

  const dd = Math.min(99, Math.max(1, parseFloat(drawdown) || 30));
  const requiredGain = ((1 / (1 - dd / 100)) - 1) * 100;

  const yearsAt = (rate: number) =>
    requiredGain > 0 ? (Math.log(1 + requiredGain / 100) / Math.log(1 + rate / 100)).toFixed(1) : " -";

  const severity =
    dd < 20 ? { label: "Manageable", color: "text-emerald-400" }
    : dd < 35 ? { label: "Significant", color: "text-amber-400" }
    : dd < 50 ? { label: "Severe", color: "text-orange-400" }
    : { label: "Catastrophic", color: "text-rose-400" };

  return (
    <MiniToolShell label="See the recovery math">
      <ToolInput label="Drawdown %" value={drawdown} onChange={setDrawdown} suffix="%" placeholder="30" />
      {dd > 0 && (
        <div className="pt-1 border-t border-zinc-800">
          <ToolResult label="Required gain to recover" value={`${requiredGain.toFixed(1)}%`} highlight />
          <ToolResult label="Severity" value={severity.label} />
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-3 mb-2">Years to recover at annual return of:</p>
          <div className="grid grid-cols-4 gap-2">
            {[8, 12, 15, 20].map((r) => (
              <div key={r} className="bg-zinc-800/60 rounded-lg p-2 text-center">
                <p className="text-[10px] text-zinc-500 mb-1">{r}%/yr</p>
                <p className="text-sm font-bold tabular text-zinc-200">{yearsAt(r)}<span className="text-[10px] text-zinc-600 ml-0.5">yr</span></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </MiniToolShell>
  );
}

// ── Mini Tool Dispatcher ──────────────────────────────────────────────────────

function MiniToolRenderer({ tool }: { tool: MiniToolDef }) {
  switch (tool.id) {
    case "position-from-loss":   return <PositionFromLossTool />;
    case "tax-harvest-savings":  return <TaxHarvestTool />;
    case "expected-value":       return <ExpectedValueTool />;
    case "drawdown-recovery":    return <DrawdownRecoveryTool />;
  }
}


// ── Apply to Stock (AI panel) ─────────────────────────────────────────────────

function ApplyToStock({ item }: { item: LearnItem }) {
  const { summary } = useDefaultPortfolio();
  const holdings = summary?.holdings ?? [];

  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // Pre-select first holding if available
  useEffect(() => {
    if (holdings.length > 0 && !selectedTicker) {
      setSelectedTicker(holdings[0].ticker);
    }
  }, [holdings, selectedTicker]);

  const activeTicker = showCustom ? customInput.trim().toUpperCase() : selectedTicker;

  async function runAnalysis() {
    if (!activeTicker) return;
    setIsAnalyzing(true);
    setAnalysisText("");
    setError(null);

    try {
      const res = await apiStreamPost("/ai/learn", {
        concept_id: item.id,
        ticker: activeTicker,
      });

      if (res.status === 403) {
        setError("AI analysis is a Voyager feature. Upgrade to apply concepts to live stocks.");
        setIsAnalyzing(false);
        return;
      }
      if (res.status === 429) {
        setError("Daily AI insight limit reached. Resets at midnight, or upgrade to Navigator for unlimited.");
        setIsAnalyzing(false);
        return;
      }
      if (!res.ok) {
        setError("Analysis failed. Check that the backend is running.");
        setIsAnalyzing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.error) { setError(msg.error); break; }
            if (msg.text) setAnalysisText((prev) => prev + msg.text);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stream failed");
    } finally {
      setIsAnalyzing(false);
      // Scroll to result
      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }

  const angleText = item.aiAngle.replace("[TICKER]", activeTicker || "a stock");

  return (
    <div className="border-t border-zinc-800 pt-6 mt-2">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
        <h3 className="text-sm font-semibold text-zinc-200">Apply to a stock</h3>
        <span className="text-[10px] text-zinc-600 font-medium px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">
          Claude AI
        </span>
      </div>

      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{angleText}</p>

      {/* Portfolio holdings pills */}
      {holdings.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Your holdings</p>
          <div className="flex flex-wrap gap-1.5">
            {holdings.slice(0, 10).map((h) => (
              <button
                key={h.ticker}
                onClick={() => { setSelectedTicker(h.ticker); setShowCustom(false); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  !showCustom && selectedTicker === h.ticker
                    ? "bg-teal-500/15 text-teal-300 border-teal-500/40"
                    : "bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300"
                }`}
              >
                {h.ticker}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom ticker row */}
      <div className="flex items-center gap-2 mb-4">
        {!showCustom ? (
          <button
            onClick={() => { setShowCustom(true); setSelectedTicker(""); }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded-full px-2.5 py-1 transition-colors"
          >
            <Search className="w-3 h-3" />
            Any ticker
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-[120px]">
              <input
                autoFocus
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && customInput.trim()) runAnalysis(); }}
                placeholder="TICKER"
                maxLength={10}
                className="w-full bg-zinc-800 border border-teal-500/40 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-teal-500/70 tabular-nums font-mono uppercase"
              />
            </div>
            <button
              onClick={() => { setShowCustom(false); setCustomInput(""); if (holdings.length > 0) setSelectedTicker(holdings[0].ticker); }}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Analyze button */}
      <button
        onClick={runAnalysis}
        disabled={!activeTicker || isAnalyzing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium hover:bg-teal-500/15 hover:border-teal-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing {activeTicker}...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            {activeTicker ? `Analyze ${activeTicker}` : "Select a stock above"}
          </>
        )}
      </button>

      {/* Streaming result */}
      {(analysisText || error) && (
        <div ref={analysisRef} className="mt-5">
          <div className="relative bg-zinc-900/60 border border-zinc-700/60 rounded-xl p-4">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-teal-500/30 via-teal-500/10 to-transparent rounded-t-xl" />
            {error ? (
              <p className="text-xs text-rose-400">{error}</p>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {analysisText}
                {isAnalyzing && (
                  <span className="inline-block w-1.5 h-3.5 bg-teal-400/70 ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </p>
            )}
            <p className="text-[10px] text-zinc-700 mt-3">
              AI analysis by Claude. Not financial advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  item,
  onClose,
}: {
  item: LearnItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [item, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Panel header */}
        <div className={`flex items-start gap-4 p-6 border-b shrink-0 ${item.category === "advanced" ? "border-orange-500/20 bg-orange-500/[0.03]" : "border-zinc-800"}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <TypeBadge type={item.type} />
              {item.category === "advanced" && <AdvancedBadge />}
            </div>
            <h2 className="text-lg font-semibold text-zinc-100 leading-tight">{item.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {item.type === "playbook"
            ? <PlaybookDetail item={item} />
            : <DeepDiveDetail item={item} />
          }

          {/* AI apply panel */}
          <ApplyToStock item={item} />
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-3 border-t border-zinc-800 shrink-0">
          <p className="text-[10px] text-zinc-700 text-center">
            Educational content only  - not personalized financial, tax, or investment advice.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [catFilter, setCatFilter] = useState<LearnCategory | null>(null);
  const [selected, setSelected] = useState<LearnItem | null>(null);

  const filtered = useMemo(() => {
    let items = LEARN_CONTENT;
    if (tab !== "all") items = items.filter((i) => i.type === tab);
    if (catFilter) items = items.filter((i) => i.category === catFilter);
    return items;
  }, [tab, catFilter]);

  const playbookCount = LEARN_CONTENT.filter((i) => i.type === "playbook").length;
  const deepdiveCount = LEARN_CONTENT.filter((i) => i.type === "deepdive").length;

  return (
    <PageTransition className="space-y-8">
      {/* ── Header ── */}
      <div className="relative">
        {/* Ambient glow */}
        <div className="absolute -top-4 -left-4 w-64 h-32 opacity-[0.04] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #1AA8BB, transparent 70%)" }} />

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-teal-400" />
              Learn
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Frameworks and deep dives for investors who want to understand, not just follow.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-teal-500/60" />
              {playbookCount} playbooks
            </span>
            <span className="text-zinc-800">·</span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-zinc-600" />
              {deepdiveCount} deep dives
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg w-fit">
          {(["all", "playbook", "deepdive"] as Tab[]).map((t) => {
            const labels = { all: "All", playbook: "Playbooks", deepdive: "Deep Dives" };
            const counts = {
              all: LEARN_CONTENT.length,
              playbook: playbookCount,
              deepdive: deepdiveCount,
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {labels[t]}
                <span className={`ml-1.5 ${tab === t ? "text-zinc-400" : "text-zinc-700"}`}>
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCatFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              !catFilter
                ? "bg-zinc-200 text-zinc-900 border-zinc-200"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            All topics
          </button>
          {CATEGORIES.map((cat) => {
            const count = LEARN_CONTENT.filter((i) => i.category === cat).length;
            const c = CATEGORY_COLORS[cat];
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? `${c.bg} ${c.text} ${c.border}`
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content Grid ── */}
      {filtered.length === 0 ? (
        <div className="vela-card text-center py-16">
          <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No content matches this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) =>
            item.type === "playbook" ? (
              <PlaybookCard key={item.id} item={item} onClick={() => setSelected(item)} />
            ) : (
              <DeepDiveCard key={item.id} item={item} onClick={() => setSelected(item)} />
            )
          )}
        </div>
      )}

      {/* ── Detail Drawer ── */}
      <DetailDrawer item={selected} onClose={() => setSelected(null)} />
    </PageTransition>
  );
}

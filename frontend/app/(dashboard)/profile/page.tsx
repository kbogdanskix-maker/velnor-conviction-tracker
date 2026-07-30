"use client";

import { Check, Home, Shield } from "lucide-react";
import { useProfile, US_TAX_BRACKETS } from "@/hooks/useProfile";
import { useCashFlowSummary } from "@/hooks/useCashFlow";
import PageTransition from "@/components/celestial/PageTransition";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Eyebrow,
} from "@/components/instrument";

// ── Option config ────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  {
    value: "conservative" as const,
    label: "Conservative",
    desc: "Capital preservation over growth. Lower volatility, lower returns.",
  },
  {
    value: "moderate" as const,
    label: "Moderate",
    desc: "Balanced growth and stability. Accept some swings for better returns.",
  },
  {
    value: "aggressive" as const,
    label: "Aggressive",
    desc: "Maximum growth focus. High volatility is acceptable for high returns.",
  },
];

const SOPHISTICATION_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    desc: "New to investing. Explain concepts, avoid jargon.",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    desc: "Comfortable with fundamentals. Brief explanations when needed.",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    desc: "Institutional-level fluency. No hand-holding.",
  },
];

const OBJECTIVE_OPTIONS = [
  {
    value: "growth" as const,
    short: "Growth",
    label: "Maximize growth",
    desc: "Compounding and capital appreciation come first. Comfortable with concentration and volatility.",
  },
  {
    value: "income" as const,
    short: "Income",
    label: "Generate income",
    desc: "Dividends and cash flow matter most. Favor yield and durability.",
  },
  {
    value: "preservation" as const,
    short: "Preserve",
    label: "Preserve capital",
    desc: "Protecting what you have outweighs upside. Low drawdown tolerance.",
  },
  {
    value: "target" as const,
    short: "Target",
    label: "Reach a target",
    desc: "Working toward a goal or financial independence on a timeline.",
  },
  {
    value: "learning" as const,
    short: "Learn",
    label: "Learn & experiment",
    desc: "Building skill and conviction. Open to ideas, comfortable being wrong.",
  },
];

const HORIZON_OPTIONS = [
  { value: "short" as const, label: "Short", desc: "< 3 yrs" },
  { value: "medium" as const, label: "Medium", desc: "3-10 yrs" },
  { value: "long" as const, label: "Long", desc: "10+ yrs" },
];

const DEEMPHASIS_OPTIONS = [
  { value: "retirement" as const, label: "Retirement / FI framing" },
  { value: "income" as const, label: "Income & dividends" },
  { value: "tax" as const, label: "Tax optimization" },
  { value: "volatility" as const, label: "Short-term volatility" },
];

// ── Shared class tokens ──────────────────────────────────────────────────────

const FIELD_LABEL =
  "mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted";
const HINT = "mt-3 text-[12.5px] leading-[1.5] text-vela-body";

/** Hairline choice tile. Active = teal wash; inactive keeps readable body text. */
function choiceClass(active: boolean, extra = "") {
  return `rounded border p-3.5 text-left transition-colors ${
    active
      ? "border-vela-teal/45 bg-vela-teal/10 text-vela-teal"
      : "border-vela-border text-vela-body hover:border-vela-teal/40 hover:text-zinc-100"
  } ${extra}`;
}

const STEPPER =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded border border-vela-border font-mono text-[15px] leading-none text-vela-body transition-colors hover:border-vela-teal/40 hover:text-zinc-100";

// ── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded border transition-colors ${
        on ? "border-vela-teal/50 bg-vela-teal/20" : "border-vela-border bg-vela-card"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-[2px] transition-transform ${
          on ? "translate-x-[18px] bg-vela-teal" : "translate-x-0 bg-vela-muted"
        }`}
      />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, update, isLoading } = useProfile();
  const { summary: cashFlow } = useCashFlowSummary();

  const monthlyIncome = cashFlow?.total_income ?? 0;
  const annualIncome = monthlyIncome * 12;

  // Suggest tax bracket based on income if US citizen
  const suggestedBracket = annualIncome > 0
    ? US_TAX_BRACKETS.slice().reverse().find((b) => annualIncome >= b.rate * 1000)?.rate ?? 22
    : null;

  const objective = OBJECTIVE_OPTIONS.find((o) => o.value === profile.primaryObjective);
  const horizon = HORIZON_OPTIONS.find((h) => h.value === profile.timeHorizon);
  const riskLabel =
    profile.riskTolerance.charAt(0).toUpperCase() + profile.riskTolerance.slice(1);

  return (
    <PageTransition>
      <TopBar
        trail={[{ label: "Velnor" }, { label: "My Profile" }]}
        note={isLoading ? "loading your settings" : "changes save as you make them"}
      />

      <PageHero
        title="Profile"
        meta="Set this once. Every page and every AI answer reads from here."
        figure={profile.age}
        figureSub="years old"
      />

      <StatStrip className="mt-6">
        <StatCell
          label="Objective"
          value={objective?.short ?? "—"}
          sub={objective?.label ?? "not set"}
        />
        <StatCell label="Risk" value={riskLabel} sub="tolerance" />
        <StatCell label="Horizon" value={horizon?.label ?? "—"} sub={horizon?.desc ?? "not set"} />
        <StatCell
          label="Marginal rate"
          value={`${profile.marginalTaxRate}%`}
          sub={profile.isUsCitizen ? "US bracket" : "self-reported"}
        />
      </StatStrip>

      {/* ─── Personal ─────────────────────────────────────────────────────── */}

      <Section
        label="Personal"
        prose="Basic facts about your situation. They set the defaults other pages start from."
      >
        <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
          {/* Age */}
          <div>
            <label className={FIELD_LABEL}>Age</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ age: Math.max(18, profile.age - 1) })}
                aria-label="Decrease age"
                className={STEPPER}
              >
                −
              </button>
              <span className="w-10 text-center font-mono text-[26px] font-semibold tabular-nums leading-none text-zinc-100">
                {profile.age}
              </span>
              <button
                onClick={() => update({ age: Math.min(80, profile.age + 1) })}
                aria-label="Increase age"
                className={STEPPER}
              >
                +
              </button>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted">
                years old
              </span>
            </div>
          </div>

          {/* Dependents */}
          <div>
            <label className={FIELD_LABEL}>Dependents</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ dependents: Math.max(0, profile.dependents - 1) })}
                aria-label="Decrease dependents"
                className={STEPPER}
              >
                −
              </button>
              <span className="w-10 text-center font-mono text-[26px] font-semibold tabular-nums leading-none text-zinc-100">
                {profile.dependents}
              </span>
              <button
                onClick={() => update({ dependents: profile.dependents + 1 })}
                aria-label="Increase dependents"
                className={STEPPER}
              >
                +
              </button>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted">
                rely on you
              </span>
            </div>
          </div>

          {/* Homeowner */}
          <div className="flex items-center justify-between gap-4 border-t border-vela-border pt-5 sm:col-span-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <Home aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-vela-muted" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-zinc-100">I own my home</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-vela-body">
                  Affects insurance and net worth analysis
                </p>
              </div>
            </div>
            <Toggle
              label="I own my home"
              on={profile.isHomeowner}
              onToggle={() => update({ isHomeowner: !profile.isHomeowner })}
            />
          </div>
        </div>
      </Section>

      {/* ─── Tax ──────────────────────────────────────────────────────────── */}

      <Section
        label="Tax situation"
        prose="Used to estimate tax drag on investments and the size of any harvesting benefit. Nothing here is filed anywhere."
      >
        {/* US taxpayer */}
        <div className="flex items-center justify-between gap-4 border-y border-vela-border py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <Shield aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-vela-muted" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-zinc-100">US taxpayer</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-vela-body">
                Enables US-specific tax bracket and analysis
              </p>
            </div>
          </div>
          <Toggle
            label="US taxpayer"
            on={profile.isUsCitizen}
            onToggle={() => update({ isUsCitizen: !profile.isUsCitizen })}
          />
        </div>

        {/* Marginal rate */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <Eyebrow>
              {profile.isUsCitizen ? "Marginal tax bracket" : "Marginal tax rate"}
            </Eyebrow>
            {suggestedBracket && profile.isUsCitizen && suggestedBracket !== profile.marginalTaxRate && (
              <button
                onClick={() => update({ marginalTaxRate: suggestedBracket })}
                className="font-mono text-[10px] uppercase tracking-wider text-vela-teal transition-colors hover:text-zinc-100"
              >
                Use suggested ({suggestedBracket}% based on income) →
              </button>
            )}
          </div>

          {profile.isUsCitizen ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {US_TAX_BRACKETS.map((b) => {
                const active = profile.marginalTaxRate === b.rate;
                return (
                  <button
                    key={b.rate}
                    onClick={() => update({ marginalTaxRate: b.rate })}
                    aria-pressed={active}
                    className={choiceClass(active, "p-2.5")}
                  >
                    <p className="font-mono text-[15px] font-semibold tabular-nums leading-none">
                      {b.rate}%
                    </p>
                    <p
                      className={`mt-1 font-mono text-[10px] tabular-nums leading-tight ${
                        active ? "text-vela-teal/80" : "text-vela-muted"
                      }`}
                    >
                      {b.label.split("—")[1]?.trim()}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={60}
                value={profile.marginalTaxRate}
                onChange={(e) =>
                  update({ marginalTaxRate: Math.min(60, Math.max(0, Number(e.target.value))) })
                }
                aria-label="Marginal tax rate"
                className="w-24 rounded border border-vela-border bg-vela-card px-3 py-2 font-mono text-sm tabular-nums text-zinc-100 outline-none transition-colors focus:border-vela-teal/60"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-vela-muted">
                % marginal rate
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* ─── Investment style ─────────────────────────────────────────────── */}

      <Section
        label="Investment style"
        prose="How much movement you are willing to sit through. This sets the default scenario in projections and informs how the AI frames things."
      >
        <Eyebrow>Risk tolerance</Eyebrow>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {RISK_OPTIONS.map((opt) => {
            const active = profile.riskTolerance === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ riskTolerance: opt.value })}
                aria-pressed={active}
                className={choiceClass(active)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">{opt.label}</p>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </div>
                <p
                  className={`text-[12px] leading-[1.45] ${
                    active ? "text-vela-teal/80" : "text-vela-muted"
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        <Eyebrow className="mt-7">Sophistication</Eyebrow>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {SOPHISTICATION_OPTIONS.map((opt) => {
            const active = profile.sophistication === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ sophistication: opt.value })}
                aria-pressed={active}
                className={choiceClass(active)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">{opt.label}</p>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </div>
                <p
                  className={`text-[12px] leading-[1.45] ${
                    active ? "text-vela-teal/80" : "text-vela-muted"
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
        <p className={HINT}>Shapes how much the AI explains before it gets to the point.</p>
      </Section>

      {/* ─── Investor profile ─────────────────────────────────────────────── */}

      <Section
        label="Investor profile"
        prose="Tells the AI how to think about your money. Your objective and philosophy shape its framing and what it emphasizes."
      >
        {/* Primary objective */}
        <Eyebrow>Primary objective</Eyebrow>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {OBJECTIVE_OPTIONS.map((opt) => {
            const active = profile.primaryObjective === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ primaryObjective: opt.value })}
                aria-pressed={active}
                className={choiceClass(active)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">{opt.label}</p>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </div>
                <p
                  className={`text-[12px] leading-[1.45] ${
                    active ? "text-vela-teal/80" : "text-vela-muted"
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Time horizon */}
        <Eyebrow className="mt-7">Time horizon</Eyebrow>
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {HORIZON_OPTIONS.map((opt) => {
            const active = profile.timeHorizon === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ timeHorizon: opt.value })}
                aria-pressed={active}
                className={choiceClass(active, "!p-3 text-center")}
              >
                <p className="text-[13.5px] font-semibold">{opt.label}</p>
                <p
                  className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                    active ? "text-vela-teal/80" : "text-vela-muted"
                  }`}
                >
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* De-emphasize */}
        <Eyebrow className="mt-7">Downplay (optional)</Eyebrow>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DEEMPHASIS_OPTIONS.map((opt) => {
            const on = profile.deEmphasize.includes(opt.value);
            return (
              <button
                key={opt.value}
                aria-pressed={on}
                onClick={() =>
                  update({
                    deEmphasize: on
                      ? profile.deEmphasize.filter((d) => d !== opt.value)
                      : [...profile.deEmphasize, opt.value],
                  })
                }
                className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  on
                    ? "border-vela-teal/45 bg-vela-teal/10 text-vela-teal"
                    : "border-vela-border text-vela-muted hover:border-vela-teal/40 hover:text-zinc-100"
                }`}
              >
                {on ? "Hiding · " : ""}
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Philosophy */}
        <Eyebrow className="mt-7">Your investing philosophy</Eyebrow>
        <textarea
          value={profile.philosophy}
          onChange={(e) => update({ philosophy: e.target.value.slice(0, 1200) })}
          placeholder="How do you think about investing? What are you trying to achieve, and how do you approach it? e.g. 'I look for mispriced growth (companies the market mis-classifies). I'll hold through volatility if the thesis holds. I don't care about dividends or matching an index.'"
          rows={5}
          aria-label="Your investing philosophy"
          className="mt-2.5 w-full resize-none rounded border border-vela-border bg-vela-card px-3 py-2.5 text-[13px] leading-[1.6] text-zinc-100 outline-none transition-colors placeholder:text-vela-muted focus:border-vela-teal/60"
        />
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-vela-muted">
          {profile.philosophy.length}/1200 · Reflect and My Plan read this so their framing matches
          yours. The AI never invents figures.
        </p>
      </Section>

      {/* ─── Summary ──────────────────────────────────────────────────────── */}

      <Section label="Summary" prose="What the rest of the app currently reads off this page.">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-vela-border py-5 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Age", value: `${profile.age} yrs` },
            { label: "Dependents", value: profile.dependents === 0 ? "None" : String(profile.dependents) },
            { label: "Homeowner", value: profile.isHomeowner ? "Yes" : "No" },
            { label: "Tax status", value: profile.isUsCitizen ? "US taxpayer" : "Non-US" },
            { label: "Marginal rate", value: `${profile.marginalTaxRate}%` },
            { label: "Risk tolerance", value: riskLabel },
            { label: "Objective", value: objective?.label ?? "—" },
            { label: "Horizon", value: horizon?.label ?? "—" },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <Eyebrow>{item.label}</Eyebrow>
              <p className="mt-1.5 truncate font-mono text-[14px] tabular-nums text-zinc-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        {annualIncome > 0 && (
          <p className="mt-4 font-mono text-[11px] tabular-nums text-vela-muted">
            Annual income from Cash Flow: ${annualIncome.toLocaleString()} · used to suggest the
            bracket above.
          </p>
        )}
      </Section>
    </PageTransition>
  );
}

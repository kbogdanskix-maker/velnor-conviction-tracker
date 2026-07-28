/**
 * No-advice guardrail — regression guard for the FRONTEND deterministic surfaces.
 *
 * The backend AI prompts carry `_NO_ADVICE_GUARDRAIL`, but the frontend also
 * assembles insight text from the user's own numbers, and that text is advice
 * the same way robo-advice is (MiFID II / KNF; ESMA 2023: a disclaimer does not
 * reclassify advice, the substance must be non-directive). See the memory
 * `project_no_advice_guardrail` and `docs/COMPLIANCE-AUDIT-2026-07-01.md`.
 *
 * These surfaces reached the user with directives until the 2026-07-22 sweep;
 * this test keeps them observational so an innocent copy edit cannot walk one
 * back in.
 *
 * SCOPE: the fields that describe the user's OWN position/data. Behaviour-level
 * Socratic coaching is the guardrail's *sanctioned* style, so bias `tip` fields
 * and reflective prompts ("Does the reason you own it still hold?") are allowed
 * and deliberately NOT asserted here.
 */

import { describe, it, expect } from "vitest";
import { calculateBenchmarks, DEFAULT_PROFILE, type BenchmarkInput, type RiskProfile } from "./benchmarks";
import { evaluateAlerts, type AlertInput } from "./smart-alerts";
import { analyzeBehavior, type BehaviorInput } from "./behavioral-analysis";
import { LEARNING_CARDS } from "./learning-cards";

/**
 * Instrument-level directives: a buy/sell/trim/rebalance/suitability call on the
 * user's holdings, or the specific advice phrasings removed in the sweep. Kept
 * tight on purpose so it never flags a Socratic prompt ("Review if the thesis
 * still holds") or an attributed statement ("experts recommend 15-20%").
 */
const DIRECTIVE_PATTERNS: RegExp[] = [
  /\bconsider (selling|buying|trimming|adding|reducing|increasing|rebalanc\w*|paying|moving|retiring|having|diversif\w*)\b/i,
  /\byou should (buy|sell|trim|add|reduce|increase|rebalance|consider|diversify)\b/i,
  /\bprioriti[sz]e\b/i,
  /\burgently\b/i,
  /\bbuying opportunity\b/i,
  /\btake profit\b/i,
  /\btime to (buy|sell)\b/i,
  /\bfits your risk tolerance\b/i,
  /\bmake sure you\b/i,
  /\blook for areas to cut\b/i,
  /\bshould be a priority\b/i,
];

/** Voice tells from the design system §8 that must never reach rendered copy. */
const EM_DASH = /[—–]/;
const DOUBLE_HYPHEN = / {2}- /;

function offendingPattern(text: string): string | null {
  for (const p of DIRECTIVE_PATTERNS) {
    if (p.test(text)) return p.source;
  }
  if (EM_DASH.test(text)) return "em/en dash";
  if (DOUBLE_HYPHEN.test(text)) return "double-space hyphen";
  return null;
}

function expectClean(text: string, where: string) {
  const hit = offendingPattern(text);
  expect(hit, `${where}: "${text}"`).toBeNull();
}

// ── Benchmarks ──────────────────────────────────────────────────────
// Insight strings are fully controlled, so they must be observational across
// every profile/branch (below, at, and above each threshold).

function benchmarkInput(over: boolean, profile: RiskProfile): BenchmarkInput {
  return over
    ? {
        age: 40, netWorth: 500_000, totalAssets: 520_000, totalLiabilities: 20_000,
        savingsRate: 0.35, portfolioValue: 300_000, numHoldings: 20, topHoldingWeight: 0.08,
        dividendYield: 0.02, totalIncome: 12_000, totalExpenses: 6_000, profile,
      }
    : {
        age: 24, netWorth: 2_000, totalAssets: 30_000, totalLiabilities: 28_000,
        savingsRate: 0.02, portfolioValue: 25_000, numHoldings: 2, topHoldingWeight: 0.7,
        dividendYield: 0, totalIncome: 3_000, totalExpenses: 2_950, profile,
      };
}

describe("benchmarks insights stay observational", () => {
  const profiles: RiskProfile[] = [
    DEFAULT_PROFILE,
    { ...DEFAULT_PROFILE, riskTolerance: "aggressive", careerStage: "early" },
    { ...DEFAULT_PROFILE, riskTolerance: "conservative", careerStage: "retired", hasStableIncome: false },
  ];
  for (const profile of profiles) {
    for (const over of [true, false]) {
      const { metrics } = calculateBenchmarks(benchmarkInput(over, profile));
      it(`no directive for ${profile.riskTolerance}/${profile.careerStage} (${over ? "above" : "below"})`, () => {
        for (const m of metrics) {
          expectClean(m.insight, `benchmark ${m.id}`);
          expectClean(m.benchmarkLabel, `benchmark label ${m.id}`);
        }
        // The word "recommend" was removed from benchmark output entirely.
        for (const m of metrics) {
          expect(m.insight.toLowerCase(), `benchmark ${m.id} insight`).not.toContain("recommend");
          expect(m.benchmarkLabel.toLowerCase(), `benchmark ${m.id} label`).not.toContain("recommend");
        }
      });
    }
  }
});

// ── Smart alerts ────────────────────────────────────────────────────

const alertInput: AlertInput = {
  holdings: [
    { ticker: "AAA", quantity: 10, avgCost: 100, currentPrice: 60, marketValue: 600, dayChangePct: -6, unrealizedPnlPct: -40, weight: 0.45 },
    { ticker: "BBB", quantity: 5, avgCost: 50, currentPrice: 120, marketValue: 600, dayChangePct: 9, unrealizedPnlPct: 140, weight: 0.3 },
    { ticker: "CCC", quantity: 8, avgCost: 40, currentPrice: 38, marketValue: 304, dayChangePct: -3.5, unrealizedPnlPct: -5, weight: 0.25 },
  ],
  portfolioValue: 1504,
  dayChangePct: -4,
  unrealizedPnlPct: -12,
  dividends: { holdings: [{ ticker: "AAA", yield: 0.14, exDividendDate: new Date(Date.now() + 2 * 864e5).toISOString() }] },
  tax: { holdings: [{ ticker: "AAA", daysHeld: 350, isLongTerm: false, daysUntilLongTerm: 15, unrealizedGain: -400 }], harvestableTotal: 400 },
  goals: [{ name: "Emergency Fund", currentAmount: 5000, targetAmount: 5000 }, { name: "Car", currentAmount: 7600, targetAmount: 8000 }],
  netWorth: { netWorth: -15000, totalLiabilities: 40000, totalAssets: 25000 },
};

describe("smart-alerts messages carry no instrument directive", () => {
  const alerts = evaluateAlerts(alertInput);
  it("produces alerts to check", () => {
    expect(alerts.length).toBeGreaterThan(0);
  });
  it("every message and title is clean", () => {
    for (const a of alerts) {
      expectClean(a.message, `alert ${a.id} message`);
      expectClean(a.title, `alert ${a.id} title`);
    }
  });
});

// ── Behavioural analysis (evidence only; tips are permitted coaching) ──

const behaviorInput: BehaviorInput = {
  holdings: [
    { ticker: "AAA", weight: 0.45, unrealizedPnlPct: -35, dayChangePct: -2, avgCost: 100, currentPrice: 65, marketValue: 650 },
    { ticker: "BBB", weight: 0.3, unrealizedPnlPct: -18, dayChangePct: 1, avgCost: 50, currentPrice: 41, marketValue: 410 },
  ],
  journalEntries: [
    { action: "buy", conviction: 5, outcome: "loss", priceAtDecision: 100, priceAtReview: 65, decidedAt: new Date(Date.now() - 2 * 864e5).toISOString(), ticker: "AAA", timeHorizon: "long" },
    { action: "buy", conviction: 4, outcome: "loss", priceAtDecision: 50, priceAtReview: 41, decidedAt: new Date(Date.now() - 3 * 864e5).toISOString(), ticker: "BBB", timeHorizon: "long" },
    { action: "sell", conviction: 3, outcome: "win", priceAtDecision: 20, priceAtReview: 22, decidedAt: new Date(Date.now() - 40 * 864e5).toISOString(), ticker: "CCC", timeHorizon: "short" },
  ],
  portfolioValue: 1060,
  dayChangePct: -1,
};

describe("behavioural evidence stays observational", () => {
  const { biases } = analyzeBehavior(behaviorInput);
  it("detects biases to check", () => {
    expect(biases.some((b) => b.detected)).toBe(true);
  });
  it("evidence and description carry no instrument directive", () => {
    for (const b of biases) {
      expectClean(b.evidence, `bias ${b.id} evidence`);
      expectClean(b.description, `bias ${b.id} description`);
    }
  });
});

// ── Learning cards ──────────────────────────────────────────────────
// Generic education (attributed "experts recommend ...") is permitted, so this
// only guards against a per-holding suitability/trade directive creeping back
// into a card body — the class of the "fits your risk tolerance" nudge removed
// from the concentration card.

describe("learning cards give no per-holding directive", () => {
  it("no card body or title prescribes an instrument action", () => {
    for (const card of LEARNING_CARDS) {
      expectClean(card.body, `card ${card.id} body`);
      expectClean(card.title, `card ${card.id} title`);
    }
  });
});

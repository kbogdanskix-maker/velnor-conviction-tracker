/**
 * Options chain statistics — and, above all, the difference between
 * "open interest is zero" and "open interest was not published".
 *
 * Why this file exists: a user reported "options are not loading". Options were
 * loading. What was absent was `openInterest`, which Yahoo serves as `0` on
 * *every* contract for part of the daily cycle (OI is settlement-derived and
 * republished after the OCC file lands; the same rows also come back with
 * `bid: 0`, `ask: 0`, `impliedVolatility: 1e-05`). Volume on those very same
 * rows is populated, so the Options tab drew a full volume figure next to
 * "Max Pain —" and "Put/Call —", and that reads as a broken app.
 *
 * Verified 2026-09-30 that our parsing is NOT at fault: the production API
 * returns OI matching the raw yfinance frame contract for contract (ASML
 * 168 non-zero of 185 in both). So the defect is presentation, and the rule
 * this module encodes is the one the 2026-09-30 audit applied everywhere else:
 * report absence AS absence, never as a measurement.
 */

import { describe, it, expect } from "vitest";
import { computeOptionsStats, type OptionRow } from "./options-stats";

/** A chain whose OI Yahoo has not published yet — the reported bug's shape. */
const OI_ABSENT: { calls: OptionRow[]; puts: OptionRow[] } = {
  calls: [
    { strike: 90, openInterest: 0, volume: 185, impliedVolatility: 0.00001, bid: 0, ask: 0 },
    { strike: 100, openInterest: 0, volume: 154, impliedVolatility: 0.00001, bid: 0, ask: 0 },
    { strike: 110, openInterest: 0, volume: 12, impliedVolatility: 0.00001, bid: 0, ask: 0 },
  ],
  puts: [
    { strike: 90, openInterest: 0, volume: 40, impliedVolatility: 0.00001, bid: 0, ask: 0 },
    { strike: 100, openInterest: 0, volume: 60, impliedVolatility: 0.00001, bid: 0, ask: 0 },
  ],
};

/** The same chain once OI has been published. */
const OI_PRESENT: { calls: OptionRow[]; puts: OptionRow[] } = {
  calls: [
    { strike: 90, openInterest: 500, volume: 185 },
    { strike: 100, openInterest: 1200, volume: 154 },
    { strike: 110, openInterest: 300, volume: 12 },
  ],
  puts: [
    { strike: 90, openInterest: 800, volume: 40 },
    { strike: 100, openInterest: 400, volume: 60 },
  ],
};

describe("computeOptionsStats — absence is not a reading", () => {
  it("reports OI as unpublished when every contract is 0, and withholds the OI-derived figures", () => {
    const s = computeOptionsStats(OI_ABSENT.calls, OI_ABSENT.puts, 100);

    expect(s).not.toBeNull();
    expect(s!.hasOpenInterest).toBe(false);
    // The two figures that are pure OI must be absent, not zero and not a guess.
    expect(s!.maxPainStrike).toBeNull();
    expect(s!.pcRatio).toBeNull();
  });

  it("treats null openInterest the same as an all-zero chain", () => {
    const calls: OptionRow[] = [{ strike: 100, openInterest: null, volume: 10 }];
    const puts: OptionRow[] = [{ strike: 100, openInterest: null, volume: 5 }];

    const s = computeOptionsStats(calls, puts, 100);

    expect(s!.hasOpenInterest).toBe(false);
    expect(s!.maxPainStrike).toBeNull();
    expect(s!.pcRatio).toBeNull();
  });

  it("still reports volume when OI is unpublished — volume is real on those rows", () => {
    const s = computeOptionsStats(OI_ABSENT.calls, OI_ABSENT.puts, 100);

    // This is the whole point: the user sees a true volume figure and is told
    // why the OI panels are missing, instead of seeing "-" next to it.
    expect(s!.totalVolume).toBe(185 + 154 + 12 + 40 + 60);
    expect(s!.hasVolume).toBe(true);
  });

  it("does not mistake a single populated contract for an absent chain", () => {
    const calls: OptionRow[] = [
      { strike: 90, openInterest: 0, volume: 1 },
      { strike: 100, openInterest: 7, volume: 1 },
    ];

    const s = computeOptionsStats(calls, [], 100);

    expect(s!.hasOpenInterest).toBe(true);
    expect(s!.maxPainStrike).not.toBeNull();
  });
});

describe("computeOptionsStats — the figures themselves", () => {
  it("computes the put/call OI ratio from totals", () => {
    const s = computeOptionsStats(OI_PRESENT.calls, OI_PRESENT.puts, 100);

    expect(s!.hasOpenInterest).toBe(true);
    expect(s!.totalCallOI).toBe(2000);
    expect(s!.totalPutOI).toBe(1200);
    expect(s!.pcRatio).toBeCloseTo(0.6, 5);
  });

  it("puts max pain at the strike minimising total intrinsic value owed", () => {
    // Writers lose least where in-the-money value across both sides is smallest.
    const s = computeOptionsStats(OI_PRESENT.calls, OI_PRESENT.puts, 100);

    expect(s!.maxPainStrike).toBe(90);
  });

  it("returns null without a spot price — every figure here is relative to it", () => {
    expect(computeOptionsStats(OI_PRESENT.calls, OI_PRESENT.puts, 0)).toBeNull();
    expect(computeOptionsStats(OI_PRESENT.calls, OI_PRESENT.puts, null)).toBeNull();
  });

  it("survives an empty chain without inventing figures", () => {
    const s = computeOptionsStats([], [], 100);

    expect(s!.hasOpenInterest).toBe(false);
    expect(s!.hasVolume).toBe(false);
    expect(s!.maxPainStrike).toBeNull();
    expect(s!.pcRatio).toBeNull();
    expect(s!.totalVolume).toBe(0);
  });

  it("ignores contracts with no strike rather than bucketing them at 0", () => {
    const calls: OptionRow[] = [
      { strike: 0, openInterest: 999, volume: 1 },
      { strike: 100, openInterest: 10, volume: 1 },
    ];

    const s = computeOptionsStats(calls, [], 100);

    expect(s!.totalCallOI).toBe(10);
  });
});

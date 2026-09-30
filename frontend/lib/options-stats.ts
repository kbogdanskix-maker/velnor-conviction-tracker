/**
 * Options chain statistics, with one rule: a figure derived from open interest
 * is reported only when open interest was actually published.
 *
 * Yahoo serves `openInterest: 0` on every contract for part of the daily cycle —
 * OI is settlement-derived and lands after the OCC file, and the same rows come
 * back with `bid: 0`, `ask: 0` and `impliedVolatility: 1e-05` while `volume` is
 * populated. An all-zero chain is therefore "not published yet", not "no-one
 * holds these", and Max Pain / Put-Call must be withheld rather than drawn as
 * "-" beside a real volume figure. See `options-stats.test.ts` for the evidence.
 */

export interface OptionRow {
  strike: number;
  openInterest?: number | null;
  volume?: number | null;
  impliedVolatility?: number | null;
  bid?: number | null;
  ask?: number | null;
}

export interface OptionsStats {
  /** False when the chain carries no OI at all — withhold every OI-derived figure. */
  hasOpenInterest: boolean;
  hasVolume: boolean;
  /** Null when OI is unpublished: max pain is meaningless without it. */
  maxPainStrike: number | null;
  /** Null when OI is unpublished, or when no calls carry OI to divide by. */
  pcRatio: number | null;
  totalVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  totalOI: number;
  price: number;
}

/** A contract with no strike is malformed; it must not be bucketed at zero. */
const priced = (rows: OptionRow[]) => rows.filter((r) => !!r.strike);

const sum = (rows: OptionRow[], field: "openInterest" | "volume") =>
  rows.reduce((total, r) => total + (r[field] || 0), 0);

/**
 * @param price spot. Every figure here is relative to it, so without it there
 *              is nothing honest to report and the result is `null`.
 */
export function computeOptionsStats(
  calls: OptionRow[],
  puts: OptionRow[],
  price: number | null | undefined,
): OptionsStats | null {
  if (!price || price <= 0) return null;

  const c = priced(calls);
  const p = priced(puts);

  const totalCallOI = sum(c, "openInterest");
  const totalPutOI = sum(p, "openInterest");
  const totalOI = totalCallOI + totalPutOI;
  const totalVolume = sum(c, "volume") + sum(p, "volume");

  const hasOpenInterest = totalOI > 0;

  return {
    hasOpenInterest,
    hasVolume: totalVolume > 0,
    maxPainStrike: hasOpenInterest ? maxPain(c, p) : null,
    pcRatio: hasOpenInterest && totalCallOI > 0 ? totalPutOI / totalCallOI : null,
    totalVolume,
    totalCallOI,
    totalPutOI,
    totalOI,
    price,
  };
}

/**
 * The strike at which writers owe least in intrinsic value across both sides —
 * i.e. where the most open interest expires worthless.
 */
function maxPain(calls: OptionRow[], puts: OptionRow[]): number | null {
  const strikes = Array.from(
    new Set(calls.map((r) => r.strike).concat(puts.map((r) => r.strike))),
  ).sort((a, b) => a - b);

  if (strikes.length === 0) return null;

  let best = strikes[0];
  let least = Infinity;

  for (const settle of strikes) {
    let pain = 0;
    for (const call of calls) {
      if (settle > call.strike) pain += (settle - call.strike) * (call.openInterest || 0);
    }
    for (const put of puts) {
      if (settle < put.strike) pain += (put.strike - settle) * (put.openInterest || 0);
    }
    if (pain < least) {
      least = pain;
      best = settle;
    }
  }

  return best;
}

"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";
import {
  TopBar,
  PageHero,
  StatStrip,
  StatCell,
  Section,
  Panel,
  PillGroup,
  Eyebrow,
  Prose,
} from "@/components/instrument";

// ── Shared class strings ────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded bg-vela-card border border-vela-border px-2.5 py-1.5 " +
  "font-mono text-[13px] tabular-nums text-zinc-100 placeholder-vela-muted " +
  "outline-none transition-colors focus:border-vela-teal/60";

const RISK_PRESETS = [
  { key: "0.5", label: "0.5%" },
  { key: "1", label: "1%" },
  { key: "2", label: "2%" },
  { key: "3", label: "3%" },
  { key: "5", label: "5%" },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function PositionSizePage() {
  const { summary } = useDefaultPortfolio();
  const portfolioValue = summary?.total_value ?? 0;

  const [accountSize, setAccountSize] = useState(portfolioValue > 0 ? Math.round(portfolioValue) : 50000);
  const [riskPct, setRiskPct] = useState(2); // % of portfolio risked per trade
  const [entryPrice, setEntryPrice] = useState(150);
  const [stopLoss, setStopLoss] = useState(140);
  const [targetPrice, setTargetPrice] = useState(180);

  const analysis = useMemo(() => {
    const riskPerTrade = accountSize * (riskPct / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const shares = riskPerShare > 0 ? Math.floor(riskPerTrade / riskPerShare) : 0;
    const positionValue = shares * entryPrice;
    const positionPct = accountSize > 0 ? (positionValue / accountSize) * 100 : 0;

    const maxLoss = shares * riskPerShare;
    const potentialGain = shares * (targetPrice - entryPrice);
    const riskReward = riskPerShare > 0 ? (targetPrice - entryPrice) / riskPerShare : 0;

    const stopLossPct = entryPrice > 0 ? ((entryPrice - stopLoss) / entryPrice) * 100 : 0;
    const targetPct = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0;

    // Kelly Criterion (simplified): assumes 50% win rate
    const winRate = 0.5;
    const kellyPct = riskReward > 0 ? ((winRate * riskReward - (1 - winRate)) / riskReward) * 100 : 0;
    const kellyShares = kellyPct > 0 && riskPerShare > 0
      ? Math.floor((accountSize * kellyPct / 100) / entryPrice)
      : 0;

    return {
      riskPerTrade, riskPerShare, shares, positionValue, positionPct,
      maxLoss, potentialGain, riskReward, stopLossPct, targetPct,
      kellyPct: Math.max(0, kellyPct), kellyShares,
    };
  }, [accountSize, riskPct, entryPrice, stopLoss, targetPrice]);

  // Where the resulting position sits as a share of the account
  const riskLevel = analysis.positionPct > 25 ? "high" : analysis.positionPct > 10 ? "moderate" : "conservative";

  const bandLabel =
    riskLevel === "conservative"
      ? "Under 10% of account"
      : riskLevel === "moderate"
        ? "10 to 25% of account"
        : "Above 25% of account";

  const bandClass =
    riskLevel === "conservative"
      ? "text-gain"
      : riskLevel === "moderate"
        ? "text-amber-400"
        : "text-loss";

  const bandNote =
    riskLevel === "conservative"
      ? "At the numbers entered, the position works out below a tenth of the account."
      : riskLevel === "moderate"
        ? "At the numbers entered, the position works out between a tenth and a quarter of the account."
        : "At the numbers entered, the position works out above a quarter of the account, so that share of the account tracks one name.";

  // Same arithmetic run at other risk percentages
  const scenarios = [1, 2, 3, 5].map((pct) => {
    const risk = accountSize * (pct / 100);
    const rps = Math.abs(entryPrice - stopLoss);
    const shares = rps > 0 ? Math.floor(risk / rps) : 0;
    return { pct, risk, shares, value: shares * entryPrice, portfolioPct: accountSize > 0 ? (shares * entryPrice / accountSize) * 100 : 0 };
  });

  return (
    <TierGate requiredTier="voyager">
      <PageTransition>
        <TopBar
          trail={[{ label: "Lab" }, { label: "Position Size" }]}
          note="arithmetic only · nothing is placed from here"
        />

        <PageHero
          title="Position Size"
          meta="Share count implied by the numbers you enter"
          figure={String(analysis.shares)}
          figureSub={`${formatCurrency(analysis.positionValue)} · ${analysis.positionPct.toFixed(1)}% of account`}
        />

        <Prose className="mt-5 max-w-[580px]">
          At the risk tolerance you entered, this many shares corresponds to that loss if price
          reaches your stop. Every figure on the page is arithmetic on your own inputs. It carries no
          view on the instrument, the entry, or whether to trade at all.
        </Prose>

        <StatStrip className="mt-6">
          <StatCell
            label="Risk budget"
            value={formatCurrency(analysis.riskPerTrade)}
            sub={`${riskPct}% of ${formatCurrency(accountSize)}`}
          />
          <StatCell
            label="Loss at stop"
            value={`−${formatCurrency(analysis.maxLoss)}`}
            valueClass="text-loss"
            sub={`${analysis.riskPerShare.toFixed(2)} per share`}
          />
          <StatCell
            label="Gain at target"
            value={`+${formatCurrency(analysis.potentialGain)}`}
            valueClass="text-gain"
            sub={`${analysis.targetPct.toFixed(1)}% above entry`}
          />
          <StatCell
            label="Risk / reward"
            value={`1:${analysis.riskReward.toFixed(1)}`}
            valueClass={
              analysis.riskReward >= 2
                ? "text-gain"
                : analysis.riskReward >= 1
                  ? "text-amber-400"
                  : "text-loss"
            }
            sub="target distance ÷ stop distance"
          />
        </StatStrip>

        {/* Inputs */}
        <Section
          label="Inputs"
          prose="Change any field and every figure on the page recalculates. Nothing here is stored or sent anywhere."
          controls={
            <div className="flex items-center gap-2.5">
              <Eyebrow>Risk per trade</Eyebrow>
              <PillGroup
                options={RISK_PRESETS}
                value={String(riskPct)}
                onChange={(v) => setRiskPct(parseFloat(v))}
                ariaLabel="Risk per trade preset"
              />
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-5 max-w-[860px]">
            <label className="block min-w-0">
              <Eyebrow className="mb-1.5">Account size ($)</Eyebrow>
              <input
                type="number"
                value={accountSize || ""}
                onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                className={fieldClass}
              />
            </label>

            <label className="block min-w-0">
              <Eyebrow className="mb-1.5">Risk per trade (%)</Eyebrow>
              <input
                type="number"
                value={riskPct || ""}
                onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
                step="0.5"
                className={fieldClass}
              />
              <p className="mt-1 font-mono text-[10px] tabular-nums text-vela-muted">
                {formatCurrency(analysis.riskPerTrade)} of the account
              </p>
            </label>

            <label className="block min-w-0">
              <Eyebrow className="mb-1.5">Entry price ($)</Eyebrow>
              <input
                type="number"
                value={entryPrice || ""}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
                className={fieldClass}
              />
            </label>

            <label className="block min-w-0">
              <Eyebrow className="mb-1.5">Stop level ($)</Eyebrow>
              <input
                type="number"
                value={stopLoss || ""}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                step="0.01"
                className={fieldClass}
              />
              <p className="mt-1 font-mono text-[10px] tabular-nums text-vela-muted">
                {analysis.stopLossPct.toFixed(1)}% below entry
              </p>
            </label>

            <label className="block min-w-0">
              <Eyebrow className="mb-1.5">Target price ($)</Eyebrow>
              <input
                type="number"
                value={targetPrice || ""}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
                className={fieldClass}
              />
              <p className="mt-1 font-mono text-[10px] tabular-nums text-vela-muted">
                {analysis.targetPct.toFixed(1)}% above entry
              </p>
            </label>
          </div>
        </Section>

        {/* Result */}
        <Section
          label="Result"
          prose="The share count that puts your entered risk budget exactly at the stop distance, rounded down to whole shares."
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
            <Panel className="px-5 py-4">
              <Eyebrow>Implied shares</Eyebrow>
              <p className="mt-2 font-mono text-[34px] font-medium tabular-nums leading-none text-vela-teal">
                {analysis.shares}
              </p>
              <div className="mt-4 border-t border-vela-border pt-3 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted">
                    Position value
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-zinc-100">
                    {formatCurrency(analysis.positionValue)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted">
                    Share of account
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-zinc-100">
                    {analysis.positionPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vela-muted">
                    Risk per share
                  </span>
                  <span className="font-mono text-[13px] tabular-nums text-zinc-100">
                    {formatCurrency(analysis.riskPerShare)}
                  </span>
                </div>
              </div>
            </Panel>

            <div>
              <Eyebrow>Where that lands</Eyebrow>
              <p className={`mt-2 font-mono text-[15px] uppercase tracking-[0.12em] ${bandClass}`}>
                {bandLabel}
              </p>
              <Prose className="mt-2.5 max-w-[420px]">{bandNote}</Prose>
              <p className="mt-4 border-t border-vela-border pt-3 text-[12.5px] leading-[1.5] text-vela-body max-w-[420px]">
                The band is a description of the output, not a threshold set for you. Whether a share
                of that size fits your own plan is a judgement this page does not make.
              </p>
            </div>
          </div>
        </Section>

        {/* Scenarios */}
        <Section
          label="At other risk levels"
          prose="The same arithmetic run at four risk percentages, holding your entry and stop fixed."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[320px] grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-6 border-y border-vela-border py-4">
              {scenarios.map((s) => {
                const active = s.pct === riskPct;
                return (
                  <div
                    key={s.pct}
                    className={`min-w-0 sm:px-4 sm:first:pl-0 sm:last:pr-0 ${
                      active ? "sm:border-l-2 sm:border-vela-teal sm:pl-3.5 sm:first:pl-3.5" : ""
                    }`}
                  >
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                        active ? "text-vela-teal" : "text-vela-muted"
                      }`}
                    >
                      {s.pct}% risk
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums leading-none text-zinc-100">
                      {s.shares}
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-vela-muted">
                        shares
                      </span>
                    </p>
                    <p className="mt-1.5 font-mono text-[12px] tabular-nums text-vela-body">
                      {formatCurrency(s.value)}
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] tabular-nums text-vela-muted">
                      {s.portfolioPct.toFixed(1)}% of account
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] tabular-nums text-loss">
                      −{formatCurrency(s.risk)} at stop
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Definitions */}
        <Section
          label="What the terms mean"
          prose="Definitions for the figures above, so the arithmetic is legible. None of it is a rule set for you."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 max-w-[820px]">
            <div>
              <Eyebrow>Risk budget</Eyebrow>
              <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                The percentage of account size you entered, converted to currency. It is the loss the
                share count is solved against, assuming the stop fills at the level you typed.
              </p>
            </div>
            <div>
              <Eyebrow>Risk per share</Eyebrow>
              <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                The distance between entry and stop. Share count is the risk budget divided by this
                distance, rounded down. A tighter stop produces a larger share count for the same
                budget.
              </p>
            </div>
            <div>
              <Eyebrow>Risk to reward</Eyebrow>
              <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                Target distance divided by stop distance. At 1:3, a strike rate above 25% turns a
                positive expected value on these numbers alone, before costs and before slippage.
              </p>
            </div>
            <div>
              <Eyebrow>Share of account</Eyebrow>
              <p className="mt-2 text-[13px] leading-[1.55] text-vela-body">
                Position value over account size. Positions whose returns move together share risk,
                so several of them at once concentrate more than each figure suggests on its own.
              </p>
            </div>
          </div>
        </Section>

        <p className="mt-8 border-t border-vela-border pt-4 text-[11px] leading-relaxed text-vela-muted max-w-3xl">
          Arithmetic on the inputs you supplied. It excludes commissions, spread, slippage, gaps
          through the stop level, and taxes. It is not a recommendation to enter, size, or exit any
          position, and not investment advice.
        </p>
      </PageTransition>
    </TierGate>
  );
}

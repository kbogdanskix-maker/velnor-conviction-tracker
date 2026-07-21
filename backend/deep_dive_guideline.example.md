# Deep Dive — operator guideline (TEMPLATE)

This file is **not loaded**. Copy it to `deep_dive_guideline.md` (same directory)
and edit; the service picks that up automatically on the next run, no redeploy.

Change the path with `DEEP_DIVE_GUIDELINE_PATH` in `backend/.env`.

## What this file is for

House style, emphasis and depth. It is appended to the prompt **after** the
no-advice guardrail and the research rules, and the prompt tells the model
explicitly that this file **cannot relax any hard limit**. If something here
appears to conflict with the guardrail, the guardrail wins.

So: do not try to re-enable ratings, price targets, valuation calls or
buy/sell language here. It will not work, and it should not.

## What is worth putting here

- **Depth per section.** e.g. "3-5 recent developments, not 10." "One exhibit
  is better than four thin ones."
- **What you care about most.** e.g. "Lead with anything that changes the
  revenue mix." "Conference commentary matters as much as the print."
- **Source preferences.** e.g. "Prefer the 10-Q and the call transcript over
  press aggregators. Name the filing."
- **How hard to lean on the thesis comparison.** The one real dial: flag every
  divergence, or only material ones? Be explicit.
- **Voice.** e.g. "Plain sentences. No hedging stacks. Assume the reader owns
  the stock and has read the last dive."
- **Sector-specific asks.** e.g. "For banks, always surface NIM and credit
  quality. For SaaS, net revenue retention if disclosed."

## Example fragment

> Lead with what changed since the last quarter, not with a company overview;
> the reader owns this and knows what it does. Keep `business_snapshot` to two
> sentences. Prefer primary sources and name them inline. On the thesis check,
> flag only divergences that bear on the reason they said they were holding,
> not every incidental mismatch. If the record is thin, say so in `limitations`
> rather than padding the report.

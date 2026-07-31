"""
AI service — Claude-powered features.
  - get_earnings_summary()    → cached AI briefing for a stock's earnings
  - get_earnings_raw_data()   → yfinance earnings data for AI context
"""
import asyncio
import json
import logging
import re
from typing import AsyncGenerator

import yfinance as yf
import pandas as pd

from anthropic import AsyncAnthropic

from app.config import settings
from app.services.market_data import get_ticker_news, cache_get, cache_set

logger = logging.getLogger(__name__)

# Shared into every AI system prompt. Keeps the assistant outside the MiFID II /
# KNF "doradztwo inwestycyjne" perimeter: no personal recommendations and no
# IMPLICIT recommendations (verdicts, suitability calls) on a user's specific
# instrument. A disclaimer alone does not reclassify advice (ESMA 2023), so the
# substance must stay educational/non-directive.
_NO_ADVICE_GUARDRAIL = (
    "REGULATORY GUARDRAIL, HIGHEST PRIORITY, overrides every other instruction here:\n"
    "You are an educational tool, not an investment adviser, and you never give investment advice on a specific instrument.\n"
    "- Never tell the user to buy, sell, hold, add, trim, exit, or rotate any specific security, and never imply it.\n"
    "- Never state or imply that one of their specific holdings is over- or under-valued, that they should worry about a position, "
    "that a thesis is 'broken', that they are over-concentrated, or that another instrument would better meet their goals. "
    "Those are implicit recommendations and are forbidden.\n"
    "- Never judge whether a specific instrument is suitable or unsuitable for this user.\n"
    "- Never attach an evaluative adjective to a valuation multiple or price level. Not 'rich', 'stretched', "
    "'cheap', 'expensive', 'elevated', 'full', 'undemanding', 'compelling', 'looks high', 'looks low'. "
    "Saying a P/E 'looks stretched' is an over-valued verdict in disguise. State the figure, say what it is "
    "relative to a named comparison if you have one sourced, and stop there.\n"
    "- Never present a 'next step', action item, to-do, or 'what to do now' on a specific instrument, even a soft, optional, or "
    "hypothetical one. Naming an action, however gentle, implies a recommendation. Guide only by reflecting the user's own actions "
    "and words back to them and drawing clear contrasts (what they said vs what happened, the conviction they logged vs the outcome); "
    "state the contrast and let it stand. The contrast is the value; the action is theirs to infer and never yours to name.\n"
    "- Instead: explain general frameworks and trade-offs, surface and reflect the user's OWN stated reasoning back to them, "
    "give neutral balanced considerations grounded only in real data, and ask questions that help them reach their own conclusion.\n"
    "- If the user asks for a recommendation ('should I buy/sell X?', 'is X cheap?', 'should I trim?'), decline plainly: you cannot "
    "give personal investment advice, the decision is theirs, and for a personal recommendation they should speak to a licensed "
    "investment adviser. Then offer to help them reason it through.\n"
    "- The conclusion is always the user's to draw, never yours."
)

# Shared output-style contract injected into EVERY AI prompt in this module, so the
# app's voice is identical across all AI surfaces. Plain human language, no markdown,
# structure carried by line breaks rather than symbols.
_OUTPUT_STYLE = (
    "OUTPUT STYLE, applies to everything you write, no exceptions:\n"
    "- Write in plain, human language, the way a sharp person actually talks, not a report. Use contractions and vary sentence length.\n"
    "- Use NO markdown and no formatting symbols of any kind. Never use asterisks or bold (never write **like this**), never use "
    "headings, hashes, bullet points, numbered lists, tables, or a colon as a section label (never write things like 'Material effect:').\n"
    "- No emojis. No em-dashes; use commas, periods, or separate sentences instead.\n"
    "- When you have two or three distinct points, separate them with a line break: a blank line between short plain paragraphs, "
    "the way a person sends a couple of short messages. Let the line breaks carry the structure, never symbols or labels."
)

def _scrub_dashes(text: str) -> str:
    """Normalise em/en dashes out of a COMPLETE model output.

    _OUTPUT_STYLE forbids them, but a smaller model still slips occasionally.
    The frontend's stripAiMarkdown normalises the live stream; this covers the
    server-side cache, which stores the text for 12h and would otherwise serve
    the dashes back on every subsequent read.

    Whole strings only, never a streamed chunk: a dash sitting at a chunk
    boundary would collapse the wrong whitespace.
    """
    return re.sub(r"[ \t]*[—–][ \t]*", ", ", text)


_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


# ── Earnings raw data ────────────────────────────────────────────────────────

async def get_earnings_raw_data(ticker: str) -> dict:
    """Fetch earnings-relevant data from yfinance. Cached 6 hours."""
    cache_key = f"earnings_raw:{ticker}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    def _sync_fetch() -> dict:
        data: dict = {}
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            # Yahoo soft rate-limit returns {} — treat as a failed fetch so we
            # never cache a degenerate all-None payload for 6h (poisons the
            # earnings AI). Mirror get_ticker_info's guard in market_data.py.
            if not info:
                return {}
            data["name"] = info.get("longName") or info.get("shortName") or ticker
            data["sector"] = info.get("sector")
            data["industry"] = info.get("industry")
            data["trailing_eps"] = info.get("trailingEps")
            data["forward_eps"] = info.get("forwardEps")
            data["pe_trailing"] = info.get("trailingPE")
            data["pe_forward"] = info.get("forwardPE")
            data["revenue_growth"] = round(info["revenueGrowth"] * 100, 1) if info.get("revenueGrowth") else None
            data["earnings_growth"] = round(info["earningsGrowth"] * 100, 1) if info.get("earningsGrowth") else None
            data["quarterly_earnings_growth"] = round(info["earningsQuarterlyGrowth"] * 100, 1) if info.get("earningsQuarterlyGrowth") else None
            data["profit_margin"] = round(info["profitMargins"] * 100, 1) if info.get("profitMargins") else None
            data["operating_margin"] = round(info["operatingMargins"] * 100, 1) if info.get("operatingMargins") else None
            data["current_price"] = info.get("currentPrice") or info.get("regularMarketPrice")
            data["52w_high"] = info.get("fiftyTwoWeekHigh")
            data["52w_low"] = info.get("fiftyTwoWeekLow")
            data["analyst_target"] = info.get("targetMeanPrice")
            data["recommendation"] = info.get("recommendationKey")

            # EPS surprise history
            try:
                dates_df = t.earnings_dates
                if dates_df is not None and not dates_df.empty:
                    surprises = []
                    for idx, row in dates_df.head(6).iterrows():
                        entry: dict = {}
                        entry["date"] = str(idx.date()) if hasattr(idx, "date") else str(idx)
                        if "EPS Estimate" in row and pd.notna(row["EPS Estimate"]):
                            entry["eps_estimate"] = round(float(row["EPS Estimate"]), 2)
                        if "Reported EPS" in row and pd.notna(row["Reported EPS"]):
                            entry["eps_actual"] = round(float(row["Reported EPS"]), 2)
                        if "Surprise(%)" in row and pd.notna(row["Surprise(%)"]):
                            entry["surprise_pct"] = round(float(row["Surprise(%)"]), 1)
                        surprises.append(entry)
                    data["eps_history"] = surprises
            except Exception:
                pass

            # Quarterly revenue + income
            try:
                inc = t.quarterly_income_stmt
                if inc is not None and not inc.empty:
                    quarters = []
                    for col in list(inc.columns)[:4]:
                        label = str(col.date()) if hasattr(col, "date") else str(col)
                        q: dict = {"period": label}
                        for field, key in [
                            ("Total Revenue", "revenue"),
                            ("Net Income", "net_income"),
                            ("Gross Profit", "gross_profit"),
                        ]:
                            if field in inc.index:
                                val = inc.loc[field, col]
                                if pd.notna(val):
                                    q[key] = round(float(val) / 1e6, 0)
                        quarters.append(q)
                    data["quarterly_financials"] = quarters
            except Exception:
                pass

        except Exception as e:
            logger.warning("Earnings raw data fetch failed for %s: %s", ticker, e)

        return data

    result = await asyncio.to_thread(_sync_fetch)
    if result:
        await cache_set(cache_key, result, ttl=3600 * 6)
    return result


# ── Earnings summary ─────────────────────────────────────────────────────────

def _build_earnings_prompt(ticker: str, data: dict, news: list[dict]) -> str:
    company = data.get("name", ticker)

    eps_lines = []
    for q in (data.get("eps_history") or [])[:4]:
        if q.get("eps_actual") is None:
            continue
        beat = ""
        if q.get("surprise_pct") is not None:
            pct = q["surprise_pct"]
            beat = f", beat by {pct:.1f}%" if pct > 0 else f", missed by {abs(pct):.1f}%"
        est = f", est ${q['eps_estimate']}" if q.get("eps_estimate") else ""
        eps_lines.append(f"  • {q['date']}: EPS ${q['eps_actual']}{est}{beat}")
    eps_block = "\n".join(eps_lines) or "  No recent EPS data available."

    qf_lines = []
    for q in (data.get("quarterly_financials") or [])[:3]:
        parts = [f"  • {q['period']}:"]
        if q.get("revenue"):
            parts.append(f"Rev ${q['revenue']:.0f}M")
        if q.get("net_income"):
            parts.append(f"Net ${q['net_income']:.0f}M")
        qf_lines.append(" ".join(parts))
    qf_block = "\n".join(qf_lines) or "  No quarterly financials available."

    news_block = "\n".join(
        f"  • {a.get('title', '')} ({(a.get('published_at') or '')[:10]})"
        for a in news[:6]
    ) or "  No recent news."

    metrics: list[str] = []
    if data.get("revenue_growth") is not None:
        metrics.append(f"Revenue growth: {data['revenue_growth']}%")
    if data.get("earnings_growth") is not None:
        metrics.append(f"Earnings growth: {data['earnings_growth']}%")
    if data.get("quarterly_earnings_growth") is not None:
        metrics.append(f"QoQ earnings growth: {data['quarterly_earnings_growth']}%")
    if data.get("pe_trailing") is not None:
        metrics.append(f"Trailing P/E: {data['pe_trailing']:.1f}")
    if data.get("pe_forward") is not None:
        metrics.append(f"Forward P/E: {data['pe_forward']:.1f}")
    if data.get("profit_margin") is not None:
        metrics.append(f"Profit margin: {data['profit_margin']}%")
    if data.get("analyst_target") is not None:
        metrics.append(f"Wall Street analyst price target (third-party, via Yahoo): ${data['analyst_target']}")
    if data.get("recommendation"):
        metrics.append(f"Wall Street analyst consensus (third-party, via Yahoo): {data['recommendation'].replace('_', ' ').title()}")
    metrics_block = "\n".join(f"  • {m}" for m in metrics) or "  No metrics available."

    return f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are a concise equity analyst writing a factual earnings briefing for {company} ({ticker}). This is neutral market intelligence, not advice: report and interpret the data, and never issue a buy/sell/hold view or an over/under-valued verdict of your own. Where you mention the analyst price target or consensus, attribute it explicitly as third-party Wall Street data (via Yahoo), not Velnor's view.

EPS History (actual vs estimate):
{eps_block}

Quarterly Financials ($M):
{qf_block}

Key Metrics:
{metrics_block}

Recent News:
{news_block}

Write 2 to 3 short paragraphs (under 220 words total):
1. Latest earnings result and headline takeaway
2. Business momentum and growth trends from the data
3. Key risks or what to watch next quarter

Be analytical, cite specific numbers, avoid generic statements. Write for an informed investor following this stock. Do not tell them what to do with it. Plain human language only: no markdown or formatting symbols, no asterisks or bold (never **like this**), no headers, no bullet points, no em-dashes. Separate the paragraphs with a line break."""


async def get_earnings_summary(ticker: str) -> AsyncGenerator[str, None]:
    """Stream an AI earnings briefing for a ticker. The result is also cached."""
    cache_key = f"earnings_ai:{ticker}"
    cached = await cache_get(cache_key)
    if cached:
        # Replay cached result as a single chunk
        yield f"data: {json.dumps({'text': cached, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True, 'cached': True})}\n\n"
        return

    data = await get_earnings_raw_data(ticker)
    news = await get_ticker_news(ticker)

    prompt = _build_earnings_prompt(ticker, data, news)
    client = _get_client()

    full_text = []
    try:
        async with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                full_text.append(text)
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        complete = _scrub_dashes("".join(full_text))
        await cache_set(cache_key, complete, ttl=3600 * 12)  # 12h cache
        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Earnings summary generation failed for %s: %s", ticker, e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


# ── Financial plan ────────────────────────────────────────────────────────────

def _plan_years_out(g: dict) -> float:
    """Years until a goal's target date (large number if unparseable)."""
    from datetime import date as _date
    try:
        td = str(g.get("target_date") or "").split("T")[0]
        parts = (td.split("-") + ["1", "1"])[:3]
        target = _date(int(parts[0]), int(parts[1]), int(parts[2]))
        return max(0.0, (target - _date.today()).days / 365.25)
    except Exception:
        return 999.0


async def stream_learn_analysis(
    concept_id: str,
    ticker: str,
    ticker_data: dict,
    holding_context: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Stream a concept-applied analysis for a given ticker."""
    prompt = _build_learn_prompt(concept_id, ticker, ticker_data, holding_context)
    client = _get_client()

    try:
        async with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Learn analysis failed for %s/%s: %s", concept_id, ticker, e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


def _build_learn_prompt(
    concept_id: str,
    ticker: str,
    data: dict,
    holding: dict | None,
) -> str:
    """Build a concept-specific analysis prompt for the learn feature."""
    company = data.get("name", ticker)

    # Compact financial snapshot to include in every prompt
    stats: list[str] = []
    if data.get("current_price"):
        stats.append(f"Current price: ${data['current_price']}")
    if data.get("pe_trailing"):
        stats.append(f"Trailing P/E: {data['pe_trailing']:.1f}")
    if data.get("pe_forward"):
        stats.append(f"Forward P/E: {data['pe_forward']:.1f}")
    if data.get("revenue_growth") is not None:
        stats.append(f"Revenue growth (YoY): {data['revenue_growth']}%")
    if data.get("earnings_growth") is not None:
        stats.append(f"Earnings growth (YoY): {data['earnings_growth']}%")
    if data.get("profit_margin") is not None:
        stats.append(f"Net margin: {data['profit_margin']}%")
    if data.get("analyst_target"):
        stats.append(f"Analyst price target: ${data['analyst_target']}")
    if data.get("52w_high"):
        stats.append(f"52-week range: ${data.get('52w_low')} to ${data['52w_high']}")

    stats_block = "\n".join(f"  • {s}" for s in stats) or "  (Limited data available)"

    # NOTE: the user's personal position is deliberately NOT injected into this
    # prompt. Learn is an educational feature: it explains a framework using a
    # real public company as a worked example. Feeding in the user's own holding
    # (size, cost, P&L) is the "based on personal circumstances" limb of the
    # MiFID advice test, so we keep the example impersonal. `holding` is accepted
    # for signature stability but intentionally unused.

    # Concept-specific instruction. Each TEACHES the framework on {ticker} as an
    # example; none issues a verdict, suitability call, or buy/sell/replace on the
    # specific instrument (see _NO_ADVICE_GUARDRAIL).
    instructions = {
        "stock-analysis-framework": f"""Walk through the 5-step stock analysis framework using {company} ({ticker}) as the worked example.
Show how each step is applied: (1) reading business model clarity and competitive advantage, (2) judging financial quality from the data above, (3) the valuation check using the P/E and growth data. Explain what a strength and what a risk look like on these numbers, and what an investor would research further. Teach the method; do not tell the reader what to do about the stock. Under 250 words.""",

        "earnings-reaction-playbook": f"""Explain the earnings reaction playbook using {company} ({ticker}) as the worked example.
From the financial data above, illustrate how to read the most recent earnings quality (beat/miss context), the guidance trajectory implied by growth rates, and which playbook scenario (beat with raised guidance, miss with maintained guidance, etc.) the current picture illustrates. Teach how to interpret it, not what action to take. Under 250 words.""",

        "when-to-sell": f"""Explain the "when to sell" decision framework using {company} ({ticker}) as the worked example.
For each of the five sell conditions, explain what the condition asks and what an investor would examine to evaluate it: (1) thesis validity given current financials, (2) valuation extremity using P/E vs growth, (3) whether a better opportunity exists, (4) concentration, (5) time horizon relevance. Lay out the considerations on each side. Do NOT issue a verdict on any condition or imply whether to sell; the reader draws their own conclusion. Under 250 words.""",

        "tax-loss-harvesting": f"""Explain the tax-loss harvesting framework using {company} ({ticker}) as the worked example.
Cover: how to read current price relative to the 52-week range when thinking about harvesting, what the wash sale window means for timing, and the general principle of maintaining similar sector/factor exposure through broad index or sector funds while avoiding a substantially-identical replacement. Describe the approach in general terms. Do NOT name specific securities to buy as replacements. Under 250 words.""",

        "building-a-dcf": f"""Explain the DCF building framework using {company} ({ticker}) as the worked example.
Show how one would reason about (1) an FCF growth assumption for years 1-5 and what would justify it, (2) a terminal growth rate, (3) a discount rate given the company's risk profile, and how to read what the current price implies about growth expectations. Teach the mechanics; do not conclude the stock is cheap or expensive. Under 250 words.""",

        "fcf-vs-earnings": f"""Explain the FCF vs earnings quality analysis using {company} ({ticker}) as the worked example.
Using the data above, particularly margins and growth rates, show how to judge earnings quality, how to tell higher- from lower-quality cash conversion, and which areas of the cash flow statement to check directly. Teach the method. Under 250 words.""",

        "pe-ratio-guide": f"""Explain the P/E ratio analysis framework using {company} ({ticker}) as the worked example.
Show how to contextualize the trailing P/E of {data.get('pe_trailing', 'N/A')} and forward P/E of {data.get('pe_forward', 'N/A')} against the revenue growth rate, earnings growth, and sector norms, and how to compute and read the implied PEG ratio. Explain what would make a multiple look justified or stretched, and let the reader judge. Under 250 words.""",

        "compounding-math": f"""Explain the compounding math framework using {company} ({ticker}) as the worked example.
Illustrate two scenarios for a $10,000 stake held 10 years: (1) the current growth trajectory, (2) a more conservative case. Use the current revenue/earnings growth rates as a starting point to show the math, and name the key risk to any long-term compounding case. This is an illustration of compounding, not a projection of returns or a reason to hold. Under 250 words.""",

        "reading-earnings": f"""Explain the earnings report reading framework using {company} ({ticker}) as the worked example.
Using the available financial data, show how to read gross and net margin trajectory, revenue growth trend, and EPS quality, and what to look for in the next quarterly report. Identify the one metric that would most change the picture. Teach how to read it. Under 250 words.""",

        "margin-of-safety": f"""Explain the margin of safety framework using {company} ({ticker}) as the worked example.
Show how one would build a rough intrinsic value range from the P/E, growth rate, and analyst target, and how the margin of safety concept compares that range to the current price of ${data.get('current_price', 'N/A')}. Explain how the size of the required buffer scales with business uncertainty. Teach the method; do not declare whether a margin of safety exists here or whether the stock is cheap. Under 250 words.""",

        "yield-curve": f"""Explain the yield curve / macro risk framework using {company} ({ticker}) as the worked example.
Show how the current macro environment maps onto a business like this: sector sensitivity to rate changes, debt profile implications, and what credit tightening would mean for earnings. Explain how to think about whether it faces a macro headwind or tailwind, and let the reader form the view. Under 250 words.""",

        "position-sizing": f"""Explain the position sizing framework using {company} ({ticker}) as the worked example.
Walk through the factors that drive sizing decisions in general: volatility profile, beta and its effect on portfolio risk, sector concentration, and how conviction level maps to a position band. You may cite typical percentage bands as general education. Do NOT prescribe a size for the reader's own portfolio. Under 250 words.""",

        "managing-a-drawdown": f"""Explain the drawdown management framework using {company} ({ticker}) as the worked example.
Given the current price (${ data.get('current_price', 'N/A')}), the 52-week range, and growth data, show how to tell a company-specific issue from a macro-driven one, what would confirm or break a typical bull thesis, and how investors think about a threshold for revisiting a position. Teach the reasoning; do not tell the reader what to do. Under 250 words.""",

        "correlation-diversification": f"""Explain the correlation and diversification framework using {company} ({ticker}) as the worked example.
Show how to characterize its factor exposure (growth, cyclical, defensive, etc.), what it likely correlates with in a market stress scenario, and how to reason about whether it adds genuine diversification to a typical US equity portfolio. Teach the analysis; do not recommend adding or avoiding it. Under 250 words.""",

        "portfolio-concentration": f"""Explain the concentration risk framework using {company} ({ticker}) as the worked example.
Show how conviction level and downside scenario feed a view on defensible position weight in general, and work the math of what a 40% drawdown would cost at various portfolio weights. Present the tradeoffs as education. Do NOT prescribe a maximum weight for the reader's own book. Under 250 words.""",
    }

    instruction = instructions.get(
        concept_id,
        f"Explain the relevant framework using {company} ({ticker}) as a worked example. Be specific, cite the numbers above, teach the method rather than issuing a verdict, and keep it under 250 words.",
    )

    return f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are a concise investment educator on the Velnor platform. A user is reading a specific framework in the Learn section and wants to see how it is applied to a real public company as a worked example. Your job is to TEACH the framework, not to advise on the stock.

Framework applied: {concept_id.replace("-", " ").title()}

{company} ({ticker}) Key Metrics:
{stats_block}

Task:
{instruction}

Write in plain prose with no markdown or formatting symbols at all: no asterisks or bold (never **like this**), no headers, no bullet points, no em-dashes. Separate distinct points with a line break. Reference specific numbers from the data above. Never invent figures you were not given. Be analytical and educational, and do not issue a buy/sell/hold view, a suitability judgement, or an over/under-valued verdict on {ticker}."""


# ── Portfolio Reflection ─────────────────────────────────────────────────────

def _build_reflection_system_prompt(
    profile: dict,
    holdings: list[dict],
    goals: list[dict],
    nw: dict,
    quick_notes_flagged: list[str],
    quick_notes_ephemeral: list[str],
    thesis_notes: list[dict],
    macro: dict,
    is_opening: bool,
    closed_positions: list[dict] | None = None,
    journal_entries: list[dict] | None = None,
    calibration: dict | None = None,
    thesis_trail: list[dict] | None = None,
) -> str:
    age = profile.get("age", 30)
    risk = profile.get("riskTolerance", "moderate")
    sophistication = profile.get("sophistication", "intermediate")
    tax = profile.get("marginalTaxRate", 22)
    objective = profile.get("primaryObjective", "target")
    horizon = profile.get("timeHorizon", "long")
    de_emphasize = profile.get("deEmphasize") or []
    philosophy = (profile.get("philosophy") or "").strip()

    # Objective shapes how you weigh everything (same facts, different lens).
    objective_framing = {
        "growth": "Their objective is maximizing growth. Weigh compounding and capital appreciation above income or drawdown comfort. Concentration and volatility are acceptable to them. It is fair to argue for higher-conviction, higher-growth positioning when the case genuinely supports it.",
        "income": "Their objective is generating income. Weigh yield, cash flow, and the durability of distributions above raw appreciation.",
        "preservation": "Their objective is preserving capital. Weigh drawdown risk and downside protection above upside, and be cautious about concentration.",
        "target": "Their objective is reaching a specific target on a timeline. Frame around whether they are on pace and what adjustments would close the gap.",
        "learning": "Their objective is learning and building conviction. Favor teaching the reasoning, surfacing tradeoffs, and inviting them to pressure-test their ideas.",
    }.get(objective, "")
    horizon_label = {"short": "short (under 3 years)", "medium": "medium (3-10 years)", "long": "long (10+ years)"}.get(horizon, str(horizon))

    de_emphasis_line = ""
    if de_emphasize:
        _labels = {"retirement": "retirement / financial-independence framing", "income": "income and dividends", "tax": "tax optimization", "volatility": "short-term volatility"}
        de_emphasis_line = "\nDownplay (do not steer toward these unless the user raises them first): " + ", ".join(_labels.get(d, d) for d in de_emphasize) + "."

    philosophy_block = (
        f'\n\nThe user describes their own investing philosophy as:\n"""\n{philosophy}\n"""\n'
        "Take this seriously. Align your framing, your examples, and the positions you are willing to argue with how they actually think."
        if philosophy else ""
    )

    # Build sophistication instruction
    if sophistication == "advanced":
        tone_instruction = (
            "Write at an institutional level. No hand-holding, no definitions. "
            "Reference NIM, duration risk, sector rotation, yield curve dynamics, "
            "carry trades, factor exposures freely. Assume full fluency."
        )
    elif sophistication == "beginner":
        tone_instruction = (
            "Keep language accessible. Briefly explain any technical term when first used. "
            "Avoid jargon unless you define it in the same sentence."
        )
    else:
        tone_instruction = (
            "Intermediate level, briefly explain concepts when first used, "
            "but don't over-explain things a reasonably informed investor would know."
        )

    # Build holdings block
    holdings_lines = []
    for h in sorted(holdings, key=lambda x: float(x.get("weight_pct", 0) or 0), reverse=True):
        ticker = h.get("ticker", "")
        weight = h.get("weight_pct", 0) or 0
        pnl = h.get("unrealized_pnl_pct")
        days = h.get("days_held")
        line = f"  • {ticker}: {float(weight):.1f}% weight"
        if pnl is not None:
            line += f", {float(pnl):+.1f}% unrealised P&L"
        if days is not None:
            line += f", held {days}d"
        holdings_lines.append(line)
    holdings_block = "\n".join(holdings_lines) if holdings_lines else "  No holdings data available."

    # Build goals block
    goals_lines = [
        f"  • {g['name']}: target ${float(g['target_amount']):,.0f} by {g['target_date']} "
        f"({float(g['current_amount']) / float(g['target_amount']) * 100:.0f}% funded)"
        for g in goals
    ] if goals else ["  No goals set."]
    goals_block = "\n".join(goals_lines)

    # Build macro block
    ten_year = next((s["value"] for s in macro.get("yields", []) if s.get("series_id") == "DGS10"), None)
    two_year = next((s["value"] for s in macro.get("yields", []) if s.get("series_id") == "DGS2"), None)
    spread = next((s["value"] for s in macro.get("yields", []) if s.get("series_id") == "T10Y2Y"), None)
    fed_funds = next((s["value"] for s in macro.get("fed", []) if s.get("series_id") == "DFEDTARU"), None)

    macro_lines = []
    if ten_year is not None:
        macro_lines.append(f"  • 10Y Treasury: {float(ten_year):.2f}%")
    if two_year is not None:
        macro_lines.append(f"  • 2Y Treasury: {float(two_year):.2f}%")
    if spread is not None:
        macro_lines.append(f"  • 10Y minus 2Y spread: {float(spread):.2f}% ({'inverted' if float(spread) < 0 else 'normal'})")
    if fed_funds is not None:
        macro_lines.append(f"  • Fed Funds Target: {float(fed_funds):.2f}%")
    macro_block = "\n".join(macro_lines) if macro_lines else "  Macro data unavailable."

    # Build notes blocks
    flagged_block = "\n".join(f"  [STANDING CONVICTION] {n}" for n in quick_notes_flagged) if quick_notes_flagged else "  None."
    ephemeral_block = "\n".join(f"  • {n}" for n in quick_notes_ephemeral) if quick_notes_ephemeral else "  None."

    # Build thesis summary block (one flat note per ticker from the KV store)
    thesis_lines = [
        f"  • {t['ticker']} ({t['stance']}): {t['title']}: {t['body'][:400]}"
        for t in thesis_notes
    ] if thesis_notes else ["  No thesis notes written."]
    thesis_block = "\n".join(thesis_lines)

    # Build the FULL dated thesis-entry trail (the real conviction history). This
    # is the primary source for reasoning about what the user wrote over time; the
    # summary above is just a headline.
    trail_lines: list[str] = []
    for t in (thesis_trail or []):
        trail_lines.append(f"  {t['ticker']}: {t.get('title', '')}")
        for e in t.get("entries", []):
            trail_lines.append(f"    - {e['date']} [{e['entry_type']}]: {e['body']}")
    thesis_trail_block = "\n".join(trail_lines) if trail_lines else "  No dated thesis entries."

    # Build closed-positions block (their actual sell record — retrospective core)
    closed_lines = []
    for c in (closed_positions or []):
        pct = c.get("realized_pnl_pct")
        pct_txt = f"{float(pct):+.1f}% realized" if pct is not None else "realized P&L n/a"
        state = "fully exited" if c.get("fully_closed") else "trimmed"
        when = (c.get("last_sell_date") or "")[:10]
        closed_lines.append(f"  • {c['ticker']}: {pct_txt}, {state}{f', last sold {when}' if when else ''}")
    closed_block = "\n".join(closed_lines) if closed_lines else "  No closed or trimmed positions yet."

    # Build conviction-calibration block (their accuracy vs. how sure they were)
    if calibration:
        cal_parts = [
            f"overall hit rate {calibration['overall_hit_rate']:.0f}% across {calibration['total_reviewed']} reviewed decisions"
        ]
        for b in calibration.get("by_conviction", []):
            if b.get("reviewed"):
                cal_parts.append(f"conviction {b['conviction']}/5: {b['hit_rate']:.0f}% ({b['reviewed']} reviewed)")
        calibration_block = "  " + "; ".join(cal_parts)
    else:
        calibration_block = "  Not enough reviewed decisions yet to calibrate."

    # Build decision-journal block (what they decided, how sure, how it turned out)
    journal_lines = []
    for j in (journal_entries or []):
        conv = j.get("conviction")
        conv_txt = f"conviction {conv}/5" if conv is not None else "conviction n/a"
        outcome = j.get("outcome")
        outcome_txt = f", outcome: {outcome}" if outcome and outcome != "pending" else ""
        when = (j.get("decided_at") or "")[:10]
        rationale = (j.get("rationale") or "").strip()
        rationale_txt = f': "{rationale}"' if rationale else ""
        journal_lines.append(
            f"  • {when} {str(j.get('action', '')).upper()} {j.get('ticker', '')} ({conv_txt}){outcome_txt}{rationale_txt}"
        )
    journal_block = "\n".join(journal_lines) if journal_lines else "  No decision-journal entries yet."

    prompt = f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are Vela's portfolio reflection assistant. Your role is to help the user think clearly about their portfolio, not to critique or grade them, but to observe, ask focused questions, and surface connections they may not have made.

Investor profile:
  • Age: {age}, Risk tolerance: {risk}, Tax bracket: {tax}%
  • Sophistication: {sophistication}
  • Primary objective: {objective}; Time horizon: {horizon_label}

Tone instruction: {tone_instruction}

Objective framing: {objective_framing}{de_emphasis_line}{philosophy_block}

Portfolio:
{holdings_block}

Net worth: assets ${float(nw.get('total_assets', 0)):,.0f} | liabilities ${float(nw.get('total_liabilities', 0)):,.0f} | net ${float(nw.get('net_worth', 0)):,.0f}

Goals:
{goals_block}

User's standing convictions (flagged notes, always relevant):
{flagged_block}

User's recent working notes (ephemeral, current observations):
{ephemeral_block}

User's thesis notes (headline summary per ticker):
{thesis_block}

User's full thesis entry history (the conviction trail they actually wrote, oldest to newest per ticker):
{thesis_trail_block}

User's closed / trimmed positions (their actual sell record, realized outcomes):
{closed_block}

User's decision journal (what they decided, how sure they were, how it turned out):
{journal_block}

User's conviction calibration (how their accuracy tracks with how sure they were):
{calibration_block}

Live macro context:
{macro_block}

Behavioural rules (follow these exactly):
  1. Ask one question at a time. Never ask two questions in one message.
  2. Keep responses under 120 words unless the user explicitly asks you to elaborate.
  3. Never scold or tell the user they made a mistake. Help them reason. When they want your view, give it honestly and without judgement.
  4. When the user asks you to make the call (buy/sell/hold, "should I"), do NOT make it. Decline plainly, hand the decision back to them and to a licensed adviser, then help them reason. Otherwise, do not pad every ordinary message with disclaimers.
  5. When the user's notes mention a market theme, actively connect it to their actual portfolio holdings.
  6. Reference specific tickers and real numbers from their portfolio. Never speak in generalities.
  7. Voice and format: write like a sharp person talking, not a financial report. Plain human language, contractions, varied sentence length. Cut filler and hedging. No emojis. No em-dashes; use commas, periods, or separate sentences. Use NO markdown and no formatting symbols at all: never use asterisks or bold (never write **like this**), no headers, no bullet points, no numbered lists, no colons used as section labels like "Material effect:". When you have two or three distinct points, separate them with a line break, a blank line between short plain paragraphs, the way a person sends a couple of short messages. Let the line breaks carry the structure, never symbols.
  8. Macro timing: bring in rates, the yield curve, or the macro backdrop only when the user's own point connects to it, and prefer to do that later in the conversation. Never steer an early or cold exchange toward macro.
  9. Be Socratic by default: open by drawing out their thinking. When they ask a direct question ("is X cheap?", "should I go heavier on tech?"), do NOT hand down a buy/sell/hold call and do NOT declare their specific holding cheap, expensive, or their thesis broken. Give them the relevant facts, the framework, and the trade-offs to weigh, surface their own stated reasoning, and let them reach the conclusion. You may discuss general, instrument-agnostic principles, never a personal recommendation on their specific position.
  10. Never invent figures. Valuation multiples (P/E, P/B), growth rates, price targets, peer comparisons, and current prices must come from data you were actually given. If you do not have a number, say so plainly or reason qualitatively. Never fabricate a specific figure or imply you know a live price you were not provided.
  11. Drive toward understanding, never toward an action. Reflection is not an endless interview. After two or three exchanges on a thread, synthesize: say what you have heard and give your honest read of THEIR reasoning. Land it on the clear contrast that matters, drawn from what they actually did and wrote: what they said versus what happened, the conviction they logged versus the outcome, one of their own past positions versus another. State the contrast plainly and let it stand on its own. Do NOT attach, label, or imply a next step, an action item, a "what to do now", or anything to act on, not even a soft or optional one; the contrast is the entire value and the decision is theirs alone, never named here. Do not end every message with a question, and never manufacture a question just to keep the conversation alive. When a thread has run its course, land it on the contrast and close cleanly.
  12. Lean retrospective. Your strongest material is what the user already did and wrote versus what actually happened: their thesis entries, their buys and sells, their logged conviction, positions that moved. Reason about that record and help them learn from it. Do NOT project forward on a specific holding (no statements about where their specific position is headed, or what it will do next). Past facts and their own words are your ground; the future of any specific instrument is not yours to call."""

    if is_opening:
        prompt += """

OPENING MESSAGE INSTRUCTIONS:
Generate a single opening message. Use this priority order for signal selection:
  1. FIRST: The user's own thinking. Open by engaging with a standing conviction, a recent working note, or a thesis they actually wrote.
  2. SECOND: A concrete, factual observation about their portfolio or their own record. A position that has moved and how that compares to what they wrote at the time, a large single-name weight stated as a plain number (say the weight, do not characterize it as too much), or a gap between something they said and something they did. Observe and ask; never deliver a verdict.
  3. ONLY IF a note or position directly ties to a current macro signal may you bring macro in. Never lead a cold open with macro, rates, or the yield curve. Macro is something you reach for once the conversation has a thread, not the opener.
Never open by simply listing the largest position. It is too static and will repeat every session.
Start with the observation. End with exactly one focused question. Max 80 words total."""

    return prompt


def _with_history_cache_breakpoint(convo: list[dict]) -> list[dict]:
    """Return a copy of the conversation with a prompt-cache breakpoint on the last
    message. Marking the final content block lets each new turn reuse the cached
    conversation prefix (history grows append-only, so the prefix stays stable),
    keeping long chats cheap. All earlier messages stay as plain strings, which the
    API accepts alongside block-form content."""
    if not convo:
        return convo
    out = [dict(m) for m in convo]
    last = out[-1]
    content = last.get("content")
    if isinstance(content, str):
        last["content"] = [
            {"type": "text", "text": content, "cache_control": {"type": "ephemeral"}}
        ]
    return out


async def stream_reflection(
    messages: list[dict],
    system_prompt: str,
    is_opening: bool,
) -> AsyncGenerator[str, None]:
    """Stream a portfolio reflection response from Claude Sonnet."""
    client = _get_client()

    # For opening message, inject a synthetic trigger since Claude requires ≥1 user message
    if is_opening or not messages:
        convo = [{"role": "user", "content": "Begin."}]
    else:
        convo = [{"role": m["role"], "content": m["content"]} for m in messages]

    # Prompt caching: the system prompt carries the full, session-stable portfolio
    # context (holdings, goals, notes, thesis, macro). Cache it so every turn after
    # the first reads it at ~0.1x input cost instead of re-billing the whole block.
    # (Sonnet 4.6 minimum cacheable prefix is ~2048 tokens; smaller contexts simply
    # won't cache — no error, no harm.)
    system_blocks = [
        {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}
    ]

    # Also cache the rolling conversation prefix: mark the last message's content so
    # each new turn reuses the cached history instead of re-billing every prior turn.
    cached_convo = _with_history_cache_breakpoint(convo)

    try:
        async with client.messages.stream(
            model="claude-sonnet-5",
            # Safety ceiling, not a target: the prompt tells the model to stay under
            # ~120 words, so normal replies land well below this. 300 was too tight —
            # it guillotined mid-sentence once the Sonnet 5 tokenizer (~30% heavier)
            # and the full thesis trail made syntheses run longer. 700 leaves room for
            # a fuller synthesis or an explicit "elaborate" without cutting off.
            max_tokens=700,
            # Thinking off: Reflect is a low-latency conversational surface; Sonnet 5
            # would otherwise run adaptive thinking (its default when omitted),
            # pausing before every reply and consuming the output budget.
            thinking={"type": "disabled"},
            system=system_blocks,
            messages=cached_convo,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Reflection stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


# ── Alert insight ─────────────────────────────────────────────────────────────

async def stream_alert_insight(
    alert: dict,
    user_context: dict,
) -> AsyncGenerator[str, None]:
    """Stream a 2-4 sentence personalised AI insight for a specific smart alert.
    Uses Haiku for speed and cost — alert insights are short, high-frequency."""
    client = _get_client()

    goals = user_context.get("goals", [])
    portfolio = user_context.get("portfolio", {})
    cf = user_context.get("cash_flow", {})
    nw = user_context.get("net_worth", {})
    profile = user_context.get("profile", {}) or {}
    holdings = user_context.get("holdings_detail", []) or []
    thesis_notes = user_context.get("thesis_notes", []) or []

    objective = profile.get("primaryObjective", "target")
    risk = profile.get("riskTolerance", "moderate")
    horizon = profile.get("timeHorizon", "long")
    philosophy = (profile.get("philosophy") or "").strip()

    # Same objective lens Reflect uses: same facts, weighted to their goal.
    objective_framing = {
        "growth": "Maximizing growth. Concentration and volatility are acceptable; do not reflexively push diversification or trimming. A large winner is the cost of conviction, weigh whether the thesis still holds.",
        "income": "Generating income. Weigh yield and the durability of distributions above raw appreciation.",
        "preservation": "Preserving capital. Weigh drawdown risk and downside protection above upside.",
        "target": "Reaching a specific target on a timeline. Frame around whether they are on pace and what would close the gap.",
        "learning": "Learning and building conviction. Teach the reasoning and invite them to pressure-test the idea.",
    }.get(objective, "")

    # Build a compact goal summary
    goal_lines = []
    for g in goals[:4]:
        target = float(g.get("target_amount", 0))
        current = float(g.get("current_amount", 0))
        pct = round(current / target * 100, 1) if target > 0 else 0
        goal_lines.append(f'  • {g["name"]}: {pct}% of ${target:,.0f} target, due {g.get("target_date", "?")}')
    goals_text = "\n".join(goal_lines) if goal_lines else "  No goals set."

    # Per-holding detail (weights, P&L, tenure) — the specifics that prevent generic advice.
    holdings_lines = []
    for h in sorted(holdings, key=lambda x: float(x.get("weight_pct", 0) or 0), reverse=True)[:12]:
        line = f"  • {h['ticker']}: {float(h.get('weight_pct', 0)):.1f}% weight"
        if h.get("unrealized_pnl_pct") is not None:
            line += f", {float(h['unrealized_pnl_pct']):+.1f}% P&L"
        if h.get("days_held") is not None:
            line += f", held {h['days_held']}d"
        holdings_lines.append(line)
    holdings_block = "\n".join(holdings_lines) if holdings_lines else "  No holdings on file."

    # The user's own thesis / conviction, so the insight engages it by name.
    thesis_block = "\n".join(
        f"  • {t['ticker']} ({t.get('stance', 'note')}): {t.get('title', '')}: {(t.get('body') or '')[:220]}"
        for t in thesis_notes[:8]
    ) if thesis_notes else "  No thesis written yet."

    philosophy_block = f'\n- Their own investing philosophy: "{philosophy}". Honor it; align your framing to how they actually think.' if philosophy else ""

    savings_rate = cf.get("savings_rate")
    net_worth = nw.get("net_worth", 0)

    system = f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are Velnor, a portfolio intelligence that helps a self-directed investor hold their winners and tie every decision to their stated objective. The user just triggered a Smart Alert. React to it through THEIR lens.

Investor lens:
- Primary objective: {objective}. {objective_framing}
- Risk tolerance: {risk}; Time horizon: {horizon}.{philosophy_block}

Their positions:
{holdings_block}

Their own thesis / conviction notes:
{thesis_block}

Goals:
{goals_text}

Net worth: ${net_worth:,.0f}{f" | Savings rate: {savings_rate:.0%}" if savings_rate else ""}

Write 2-4 sentences that:
1. Tie the alert to their specific position(s), weights, P&L and dollar amounts, and to their own thesis on the relevant ticker when one exists.
2. Frame it through their objective and philosophy, not a one-size-fits-all default.
3. End with a neutral question or a general principle that helps them think it through. Do NOT prescribe an action on the specific holding.

Hard rules:
- Do NOT give generic advice. Specifically: no reflexive "trim and diversify", "rotate into an index fund", or "rebalance to target" unless it genuinely fits THIS user's objective and philosophy. For a hold-your-winners / growth investor, treat a big winner as the cost of conviction: ask whether the thesis still holds rather than telling them to sell it.
- If a relevant thesis note exists, engage with it by name.
- Reference real tickers, weights, P&L and dollar amounts from the data above. Never invent numbers, prices, peers or multiples you were not given. If you lack a specific, say so plainly.
- Do not repeat the alert title back. No disclaimers or "consult an advisor" boilerplate (the app shows that separately).
- Conversational, plain language. No markdown or formatting symbols: no asterisks or bold (never **like this**), no headers, no bullet points, no em-dashes. Separate distinct points with a line break, not symbols."""

    try:
        async with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=260,
            system=system,
            messages=[{
                "role": "user",
                "content": f'Alert: "{alert["title"]}"\nContext: {alert["description"]}',
            }],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Alert insight stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


# ── Thesis review ─────────────────────────────────────────────────────────────

async def stream_thesis_review(
    ticker: str,
    thesis_entries: list[dict],
    holding: dict | None,
    profile: dict,
    news: list[dict],
    earnings: dict,
) -> AsyncGenerator[str, None]:
    """Stream an AI read on whether the user's own thesis still holds, grounded in
    their thesis trail + real data. Educational, never fabricates numbers."""
    client = _get_client()

    # The user's conviction trail (oldest -> newest)
    trail_lines = [
        f"  • {(e.get('created_at') or '')[:10]} [{e.get('entry_type', 'note')}]: {(e.get('body') or '')[:300]}"
        for e in thesis_entries
    ]
    trail_block = "\n".join(trail_lines) if trail_lines else "  (no thesis written)"

    if holding:
        pos = f"{float(holding.get('weight_pct', 0)):.1f}% of the book"
        if holding.get("unrealized_pnl_pct") is not None:
            pos += f", {float(holding['unrealized_pnl_pct']):+.1f}% unrealised"
        if holding.get("days_held") is not None:
            pos += f", held {holding['days_held']}d"
    else:
        pos = "no current position (closed or watchlist)"

    metrics: list[str] = []
    for label, key, suffix in [
        ("Rev growth", "revenue_growth", "%"), ("Earnings growth", "earnings_growth", "%"),
        ("QoQ earnings growth", "quarterly_earnings_growth", "%"), ("Profit margin", "profit_margin", "%"),
        ("Trailing P/E", "pe_trailing", ""), ("Forward P/E", "pe_forward", ""),
        ("Current price", "current_price", ""), ("Analyst target", "analyst_target", ""),
    ]:
        v = earnings.get(key)
        if v is not None:
            metrics.append(f"{label}: {v}{suffix}")
    metrics_block = "\n".join(f"  • {m}" for m in metrics) or "  (no live metrics available)"

    eps_lines = []
    for q in (earnings.get("eps_history") or [])[:4]:
        if q.get("eps_actual") is None:
            continue
        beat = ""
        if q.get("surprise_pct") is not None:
            beat = f" ({'beat' if q['surprise_pct'] > 0 else 'miss'} {abs(q['surprise_pct']):.1f}%)"
        eps_lines.append(f"  • {q.get('date')}: EPS {q['eps_actual']}{beat}")
    eps_block = "\n".join(eps_lines) or "  (no recent EPS data)"

    news_block = "\n".join(f"  • {a.get('title', '')}" for a in (news or [])[:6]) or "  (no recent news)"

    philosophy = (profile.get("philosophy") or "").strip()
    philosophy_line = f'\nThe user\'s investing philosophy: "{philosophy}". Honor it.' if philosophy else ""

    system = f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are Velnor's thesis-review assistant. The user wants to see THEIR OWN thesis for {ticker} laid against what has actually happened, so THEY can judge whether it still holds. You help them reason; you never issue a verdict or a buy/sell call.{philosophy_line}

The user's thesis trail for {ticker} (their own words, oldest to newest):
{trail_block}

Their position: {pos}

Live metrics (only what we actually have):
{metrics_block}

Recent EPS:
{eps_block}

Recent news headlines:
{news_block}

Write a focused review (under 180 words):
1. Restate the core of their thesis in one line (from their own words above).
2. Lay out neutrally where the available data lines up with, and where it cuts against, the thesis THEY wrote, citing specific data points. Do NOT pronounce a verdict (never declare the thesis intact, drifting, or broken) and do NOT imply they should act. That judgement is theirs.
3. Name the most important things to watch next that they themselves could use to confirm or question it.

Rules:
- Ground everything in their thesis trail + the data above. NEVER invent figures, prices, multiples, or peer comparisons you were not given; if you lack a number, say so.
- Be direct and honest; you may disagree with them. Do not scold.
- Educational and non-directive: no "buy/sell/hold" directives, no disclaimers or boilerplate (the app shows that separately).
- Plain language. No markdown or formatting symbols: no asterisks or bold (never **like this**), no headers, no bullet-point lists, no em-dashes. Separate distinct points with a line break, not symbols."""

    try:
        async with client.messages.stream(
            model="claude-sonnet-5",
            max_tokens=520,
            thinking={"type": "disabled"},  # preserve Sonnet 4.6 thinking-off behavior
            system=system,
            messages=[{"role": "user", "content": f"Is my {ticker} thesis still intact?"}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        logger.error("Thesis review stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


# ── Valuation coaching ────────────────────────────────────────────────────────

async def stream_valuation_coaching(ticker: str, data: dict) -> AsyncGenerator[str, None]:
    """Stream coaching on HOW to value this business: the right framework for its
    type/stage and the assumptions that matter. A scaffold, not a price target.
    Grounds in the metrics provided; never invents multiples it wasn't given."""
    client = _get_client()
    company = data.get("name", ticker)

    # Business characteristics only. Current price, valuation multiples and analyst
    # targets are deliberately NOT fed in: they are what invite an implicit
    # cheap/expensive verdict on a specific instrument, which is the line the
    # no-advice guardrail draws. Framework choice does not need them.
    facts: list[str] = [f"Sector: {data.get('sector') or 'unknown'}", f"Industry: {data.get('industry') or 'unknown'}"]
    for label, key, suffix in [
        ("Revenue growth", "revenue_growth", "%"), ("Earnings growth", "earnings_growth", "%"),
        ("Profit margin", "profit_margin", "%"), ("Operating margin", "operating_margin", "%"),
    ]:
        v = data.get(key)
        if v is not None:
            facts.append(f"{label}: {v}{suffix}")
    facts_block = "\n".join(f"  • {f}" for f in facts)

    system = f"""{_NO_ADVICE_GUARDRAIL}

{_OUTPUT_STYLE}

You are Velnor's valuation coach. You teach valuation METHOD. The user is looking at {company} ({ticker}), so you explain which framework suits a business of this type and stage and which assumptions drive it. You are teaching them to do the work themselves. You never value the company for them.

Business characteristics (use only this; do not invent other figures):
{facts_block}

Pick the framework that fits this business type and stage, and explain why. Guidance:
- High-growth / not yet profitable (early SaaS, capital-intensive compute build-outs): EV/Sales, with growth durability and a credible path to margins. P/E is meaningless here.
- Banks / lenders: Price/Tangible Book Value and ROTCE; net interest margin and credit quality drive it.
- Mature, profitable, cash-generative: P/E and a DCF; FCF yield as a cross-check.
- Cyclicals: normalized/mid-cycle earnings, not peak or trough.
- Insurers: P/Book and combined ratio. REITs: P/FFO.

Write under 200 words:
1. Name the framework that suits this type of business and one sentence on why it fits.
2. The 2-3 assumptions that most drive that framework, and what makes each one hard to get right.
3. The most common way people fool themselves when applying this framework.

HARD LIMITS (compliance, not style):
- Never state or imply whether the stock is cheap, expensive, attractive, fairly valued, over- or under-valued, or whether the current valuation is justified.
- Never output a price target, fair value, valuation range, or any number you were not given, and never reference an analyst target.
- Never suggest buying, selling, holding, trimming, adding, or timing anything.
- You have not been given the current price or its multiples. Do not ask for them, guess them, or reason about where they sit. If the user asks whether it is cheap, say that is theirs to judge and point them back to the assumptions.
- Teach the method in general terms. The company is the occasion for the lesson, not the subject of a verdict.

Ground in the data above; never fabricate multiples, prices, or peers. Educational and non-directive, no disclaimers (the app shows that separately). Plain language. No markdown or formatting symbols: no asterisks or bold (never **like this**), no headers, no bullet-list formatting, no em-dashes. Separate distinct points with a line break, not symbols."""

    try:
        async with client.messages.stream(
            model="claude-sonnet-5",
            max_tokens=520,
            thinking={"type": "disabled"},  # preserve Sonnet 4.6 thinking-off behavior
            system=system,
            messages=[{"role": "user", "content": f"How should I value {ticker}?"}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        logger.error("Valuation coaching stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

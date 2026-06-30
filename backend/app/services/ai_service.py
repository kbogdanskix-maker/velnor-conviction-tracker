"""
AI service — Claude-powered features.
  - stream_financial_plan()   → personalised plan streamed as SSE
  - get_earnings_summary()    → cached AI briefing for a stock's earnings
  - get_earnings_raw_data()   → yfinance earnings data for AI context
"""
import asyncio
import json
import logging
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
    "REGULATORY GUARDRAIL — HIGHEST PRIORITY, overrides every other instruction here:\n"
    "You are an educational tool, not an investment adviser, and you never give investment advice on a specific instrument.\n"
    "- Never tell the user to buy, sell, hold, add, trim, exit, or rotate any specific security, and never imply it.\n"
    "- Never state or imply that one of their specific holdings is over- or under-valued, that they should worry about a position, "
    "that a thesis is 'broken', that they are over-concentrated, or that another instrument would better meet their goals. "
    "Those are implicit recommendations and are forbidden.\n"
    "- Never judge whether a specific instrument is suitable or unsuitable for this user.\n"
    "- Instead: explain general frameworks and trade-offs, surface and reflect the user's OWN stated reasoning back to them, "
    "give neutral balanced considerations grounded only in real data, and ask questions that help them reach their own conclusion.\n"
    "- If the user asks for a recommendation ('should I buy/sell X?', 'is X cheap?', 'should I trim?'), decline plainly: you cannot "
    "give personal investment advice, the decision is theirs, and for a personal recommendation they should speak to a licensed "
    "investment adviser. Then offer to help them reason it through.\n"
    "- The conclusion is always the user's to draw, never yours."
)

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
            beat = f" — beat by {pct:.1f}%" if pct > 0 else f" — missed by {abs(pct):.1f}%"
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
        metrics.append(f"Analyst price target: ${data['analyst_target']}")
    if data.get("recommendation"):
        metrics.append(f"Consensus: {data['recommendation'].replace('_', ' ').title()}")
    metrics_block = "\n".join(f"  • {m}" for m in metrics) or "  No metrics available."

    return f"""You are a concise equity analyst. Write a brief earnings intelligence briefing for {company} ({ticker}).

EPS History (actual vs estimate):
{eps_block}

Quarterly Financials ($M):
{qf_block}

Key Metrics:
{metrics_block}

Recent News:
{news_block}

Write 2–3 short paragraphs (under 220 words total):
1. Latest earnings result and headline takeaway
2. Business momentum and growth trends from the data
3. Key risks or what to watch next quarter

Be analytical, cite specific numbers, avoid generic statements. Write for an investor who already holds this stock."""


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

        complete = "".join(full_text)
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


def _build_plan_prompt(context: dict) -> str:
    nw = context.get("net_worth") or {}
    cf = context.get("cash_flow") or {}
    goals = context.get("goals") or []
    portfolio = context.get("portfolio") or {}
    profile = context.get("profile") or {}

    monthly_savings = (cf.get("total_income") or 0) - (cf.get("total_expenses") or 0)
    savings_rate = (monthly_savings / cf["total_income"] * 100) if cf.get("total_income") else 0

    # ── Investor profile ──────────────────────────────────────────────────────
    age = profile.get("age", 30)
    risk = profile.get("riskTolerance", "moderate")
    sophistication = profile.get("sophistication", "intermediate")
    objective = profile.get("primaryObjective", "target")
    horizon = profile.get("timeHorizon", "long")
    de_emphasize = profile.get("deEmphasize") or []
    philosophy = (profile.get("philosophy") or "").strip()

    objective_label = {
        "growth": "maximize growth", "income": "generate income",
        "preservation": "preserve capital", "target": "reach a target on a timeline",
        "learning": "learn and build conviction",
    }.get(objective, str(objective))
    horizon_label = {"short": "short (under 3 years)", "medium": "medium (3-10 years)", "long": "long (10+ years)"}.get(horizon, str(horizon))

    profile_block = (
        "Investor profile:\n"
        f"  • Age: {age}; Risk tolerance: {risk}; Sophistication: {sophistication}\n"
        f"  • Primary objective: {objective_label}; Time horizon: {horizon_label}"
    )
    if de_emphasize:
        _lbl = {"retirement": "retirement / FI framing", "income": "income & dividends", "tax": "tax optimization", "volatility": "short-term volatility"}
        profile_block += "\n  • Downplay: " + ", ".join(_lbl.get(d, d) for d in de_emphasize)
    if philosophy:
        profile_block += f'\n  • Their philosophy, in their words: "{philosophy}"'

    # ── Goals, segmented by time priority ──────────────────────────────────────
    if goals:
        lines = []
        for g in sorted(goals, key=_plan_years_out):
            yrs = _plan_years_out(g)
            band = "near-term" if yrs < 3 else ("medium-term" if yrs < 10 else "long-term")
            try:
                tgt = float(g["target_amount"])
                pct = (float(g["current_amount"]) / tgt * 100) if tgt else 0
            except Exception:
                tgt, pct = 0, 0
            yrs_txt = f"~{yrs:.0f}y" if yrs < 900 else "no date"
            lines.append(
                f"  • [{band}, {yrs_txt}] {g['name']}: target ${tgt:,.0f} by {g.get('target_date')}, "
                f"at ${float(g['current_amount']):,.0f} ({pct:.0f}%), contributing ${float(g.get('monthly_contribution') or 0):,.0f}/mo"
            )
        goals_block = "\n".join(lines)
    else:
        goals_block = "  No goals set yet."

    portfolio_block = ""
    if portfolio.get("total_value"):
        portfolio_block = f"""
Investment Portfolio:
  • Total value: ${float(portfolio['total_value']):,.0f}
  • Positions: {portfolio.get('holdings_count', 0)}"""
        if portfolio.get("unrealized_pnl") is not None:
            portfolio_block += f"\n  • Unrealized P&L: ${float(portfolio['unrealized_pnl']):+,.0f}"
        if portfolio.get("top_holdings"):
            portfolio_block += "\n  • Top positions: " + ", ".join(portfolio["top_holdings"][:5])

    return f"""You are a sharp personal financial advisor. A Vela user has asked for their personalised financial plan. Use ONLY the data provided below — do not invent numbers.

=== FINANCIAL SNAPSHOT ===

{profile_block}

Net Worth:
  • Assets: ${float(nw.get('total_assets') or 0):,.0f}
  • Liabilities: ${float(nw.get('total_liabilities') or 0):,.0f}
  • Net Worth: ${float(nw.get('net_worth') or 0):,.0f}

Monthly Cash Flow:
  • Income: ${float(cf.get('total_income') or 0):,.0f}
  • Expenses: ${float(cf.get('total_expenses') or 0):,.0f}
  • Savings: ${monthly_savings:,.0f} ({savings_rate:.0f}% savings rate)
{portfolio_block}

Goals (ordered by time priority — soonest first):
{goals_block}

=== HOW TO THINK ABOUT THIS PERSON ===
Anchor EVERY recommendation to their objective ({objective_label}), age ({age}), risk tolerance ({risk}), and time horizon ({horizon_label}). The plan must read as if written for them specifically, not a template.

Asset allocation must FOLLOW from that profile, never a generic default:
  - A young, aggressive, growth-focused investor with a long horizon should be heavily weighted to equities with little or no bonds. Do NOT recommend a balanced or bond-heavy mix for someone like that — it would be wrong for them.
  - A preservation-focused, near-term, or older investor warrants more stability and downside protection.
  - Match the mix to THIS person. If you suggest a bond or cash allocation, you must justify it from their actual age, objective, and horizon.

Segment by goal time priority: near-term goals need funding certainty and stability; long-term goals can take more risk to compound. Do not apply one allocation across goals with very different horizons. Respect their stated philosophy and anything they asked to downplay.

=== YOUR TASK ===

Write the user a financial plan that reads like a sharp advisor who actually looked at their numbers, not a generated report.

Cover these, in a natural flow:
  - Where they stand: their real position in a couple of sentences, naming one genuine strength and one thing to fix, with their actual figures.
  - What to do now: the specific moves that matter most, each tied to a real number (an amount, a date, a percentage). Lead with what matters most. No generic advice.
  - Their goals: address them in time-priority order; for each, are they on track and what single adjustment would close the gap.
  - How to invest from here: a concrete allocation that follows from their profile per the rules above. Justify it.
  - What to watch: a couple of real risks given their numbers, and why each matters to them specifically.

You may use a few short headers to keep it scannable, but write in plain prose, not bullet-point filler.

Voice:
  - Write like a person talking to one person. Use contractions. Address them directly as "you".
  - No emojis. Do not use em-dashes; use commas, periods, or separate sentences.
  - Vary your sentence length. Cut hedging and corporate filler. Be direct and specific, never preachy.
  - Every number you cite must come from the data above. Do not invent figures."""


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
        stats.append(f"52-week range: ${data.get('52w_low')}–${data['52w_high']}")

    stats_block = "\n".join(f"  • {s}" for s in stats) or "  (Limited data available)"

    holding_block = ""
    if holding:
        qty = holding.get("quantity", 0)
        cost = holding.get("avg_cost_basis", 0)
        val = holding.get("market_value") or 0
        pnl = holding.get("unrealized_pnl") or 0
        pnl_pct = holding.get("unrealized_pnl_pct") or 0
        holding_block = f"""
User's existing position in {ticker}:
  • Quantity: {qty} shares at avg ${cost:.2f}
  • Current market value: ${val:,.0f}
  • Unrealized P&L: ${pnl:+,.0f} ({pnl_pct:+.1f}%)
"""

    # Concept-specific instruction
    instructions = {
        "stock-analysis-framework": f"""Apply the 5-step stock analysis framework to {company} ({ticker}).
Cover: (1) business model clarity and competitive advantage, (2) financial quality using the data above, (3) valuation check using the P/E and growth data. Be direct. Note what's strong, what's a risk, and what you'd want to research further. Under 250 words.""",

        "earnings-reaction-playbook": f"""Apply the earnings reaction playbook to {company} ({ticker}).
Based on the financial data above, assess: the most recent earnings quality (beat/miss context), guidance trajectory implied by growth rates, and which playbook scenario (beat with raised guidance, miss with maintained guidance, etc.) best fits the current picture. Under 250 words.""",

        "when-to-sell": f"""Run the "when to sell" decision framework on {company} ({ticker}).
Evaluate each of the five sell conditions: (1) thesis validity given current financials, (2) valuation extremity using P/E vs growth, (3) whether a better opportunity exists, (4) concentration check, (5) time horizon relevance. Give a clear verdict for each condition. Under 250 words.""",

        "tax-loss-harvesting": f"""Apply the tax-loss harvesting framework to {company} ({ticker}).
Discuss: whether current price relative to 52-week range suggests a harvesting opportunity, what the wash sale window means for timing, and suggest 2-3 suitable replacement securities that maintain similar sector/factor exposure without triggering the wash sale rule. Under 250 words.""",

        "building-a-dcf": f"""Apply the DCF building framework to {company} ({ticker}).
Using the financial data above, estimate: (1) a reasonable FCF growth assumption for years 1-5 and why, (2) appropriate terminal growth rate, (3) suggested discount rate given the company's risk profile. Then describe what the current price implies about growth expectations. Under 250 words.""",

        "fcf-vs-earnings": f"""Apply the FCF vs earnings quality analysis to {company} ({ticker}).
Using the data above — particularly margins and growth rates — assess earnings quality. Identify whether the reported metrics suggest high or lower quality cash conversion, and flag any areas where you'd want to check the cash flow statement directly. Under 250 words.""",

        "pe-ratio-guide": f"""Apply the P/E ratio analysis framework to {company} ({ticker}).
Contextualize the trailing P/E of {data.get('pe_trailing', 'N/A')} and forward P/E of {data.get('pe_forward', 'N/A')} against the revenue growth rate, earnings growth, and sector norms. Is the multiple justified? Calculate the implied PEG ratio and what it suggests. Under 250 words.""",

        "compounding-math": f"""Apply the compounding math framework to {company} ({ticker}) as a long-term holding.
Model two scenarios: (1) holding $10,000 in {ticker} for 10 years at the current growth trajectory, (2) a more conservative scenario. Use the current revenue/earnings growth rates as a starting point. Address the key risk to the long-term compounding case. Under 250 words.""",

        "reading-earnings": f"""Apply the earnings report reading framework to {company} ({ticker}).
Using the available financial data, assess: gross and net margin trajectory, revenue growth rate trend, EPS quality, and what you'd specifically look for in the next quarterly report. Identify the one metric that would most change your view. Under 250 words.""",

        "margin-of-safety": f"""Apply the margin of safety framework to {company} ({ticker}).
Using the P/E, growth rate, and analyst target, estimate a rough intrinsic value range. At the current price of ${data.get('current_price', 'N/A')}, what margin of safety exists (if any)? How large should the required safety buffer be given the business's uncertainty level? Under 250 words.""",

        "yield-curve": f"""Apply the yield curve/macro risk framework to {company} ({ticker}).
Assess how the current macro environment affects this business: sector sensitivity to rate changes, debt profile implications, and what a credit tightening scenario would mean for earnings. Give a clear view on whether {ticker} is a macro headwind or tailwind story today. Under 250 words.""",

        "position-sizing": f"""Apply the position sizing framework to {company} ({ticker}).
Walk through the key sizing factors: volatility profile, beta implications for portfolio risk, sector concentration risk, and the appropriate position band for a high-conviction vs moderate-conviction thesis. Be specific with percentage ranges. Under 250 words.""",

        "managing-a-drawdown": f"""Apply the drawdown management framework to {company} ({ticker}).
Given the current price (${ data.get('current_price', 'N/A')}), the 52-week range, and growth data, assess: is this a company-specific or macro-driven issue? What would confirm or break a typical bull thesis? At what type of decline threshold would you revisit the position? Under 250 words.""",

        "correlation-diversification": f"""Apply the correlation and diversification framework to {company} ({ticker}).
Assess: what factor exposure does {ticker} represent (growth, cyclical, defensive, etc.), what other common holdings it likely correlates with in a market stress scenario, and whether adding this stock to a typical US equity portfolio adds genuine diversification. Under 250 words.""",

        "portfolio-concentration": f"""Apply the concentration risk framework to {company} ({ticker}).
Given the business quality indicators in the data, what maximum portfolio weight would you defend for this stock? Walk through the conviction level, downside scenario, and the math of what a 40% drawdown on this position would mean at various portfolio weights. Under 250 words.""",
    }

    instruction = instructions.get(
        concept_id,
        f"Analyze {company} ({ticker}) using the relevant framework. Be specific, cite the numbers above, and keep it under 250 words.",
    )

    return f"""You are a concise investment analyst on the Vela wealth platform. A user is reading a specific framework in the Learn section and wants it applied to a real stock.

Framework applied: {concept_id.replace("-", " ").title()}

{company} ({ticker}) — Key Metrics:
{stats_block}
{holding_block}
Task:
{instruction}

Write in plain prose, no markdown headers or bullet points. Reference specific numbers from the data above. Be direct and analytical."""


async def stream_financial_plan(context: dict) -> AsyncGenerator[str, None]:
    """Stream a personalised financial plan from Claude Sonnet."""
    prompt = _build_plan_prompt(context)
    client = _get_client()

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Financial plan generation failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


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
            "Intermediate level — briefly explain concepts when first used, "
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
        macro_lines.append(f"  • 10Y–2Y Spread: {float(spread):.2f}% ({'inverted' if float(spread) < 0 else 'normal'})")
    if fed_funds is not None:
        macro_lines.append(f"  • Fed Funds Target: {float(fed_funds):.2f}%")
    macro_block = "\n".join(macro_lines) if macro_lines else "  Macro data unavailable."

    # Build notes blocks
    flagged_block = "\n".join(f"  [STANDING CONVICTION] {n}" for n in quick_notes_flagged) if quick_notes_flagged else "  None."
    ephemeral_block = "\n".join(f"  • {n}" for n in quick_notes_ephemeral) if quick_notes_ephemeral else "  None."

    # Build thesis block
    thesis_lines = [
        f"  • {t['ticker']} ({t['stance']}): {t['title']} — {t['body'][:200]}"
        for t in thesis_notes
    ] if thesis_notes else ["  No thesis notes written."]
    thesis_block = "\n".join(thesis_lines)

    prompt = f"""{_NO_ADVICE_GUARDRAIL}

You are Vela's portfolio reflection assistant. Your role is to help the user think clearly about their portfolio — not to critique or grade them, but to observe, ask focused questions, and surface connections they may not have made.

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

User's standing convictions (flagged notes — always relevant):
{flagged_block}

User's recent working notes (ephemeral — current observations):
{ephemeral_block}

User's thesis notes:
{thesis_block}

Live macro context:
{macro_block}

Behavioural rules (follow these exactly):
  1. Ask one question at a time. Never ask two questions in one message.
  2. Keep responses under 120 words unless the user explicitly asks you to elaborate.
  3. Never scold or tell the user they made a mistake. Help them reason. When they want your view, give it honestly and without judgement.
  4. When the user asks you to make the call (buy/sell/hold, "should I"), do NOT make it. Decline plainly, hand the decision back to them and to a licensed adviser, then help them reason. Otherwise, do not pad every ordinary message with disclaimers.
  5. When the user's notes mention a market theme, actively connect it to their actual portfolio holdings.
  6. Reference specific tickers and real numbers from their portfolio. Never speak in generalities.
  7. Voice: write like a sharp person talking, not a financial report. Plain language, contractions, varied sentence length. No emojis. Do not use em-dashes; use commas, periods, or separate sentences. Cut filler and hedging.
  8. Macro timing: bring in rates, the yield curve, or the macro backdrop only when the user's own point connects to it, and prefer to do that later in the conversation. Never steer an early or cold exchange toward macro.
  9. Be Socratic by default — open by drawing out their thinking. When they ask a direct question ("is X cheap?", "should I go heavier on tech?"), do NOT hand down a buy/sell/hold call and do NOT declare their specific holding cheap, expensive, or their thesis broken. Give them the relevant facts, the framework, and the trade-offs to weigh, surface their own stated reasoning, and let them reach the conclusion. You may discuss general, instrument-agnostic principles, never a personal recommendation on their specific position.
  10. Never invent figures. Valuation multiples (P/E, P/B), growth rates, price targets, peer comparisons, and current prices must come from data you were actually given. If you do not have a number, say so plainly or reason qualitatively. Never fabricate a specific figure or imply you know a live price you were not provided.
  11. Drive toward conclusions. Reflection is not an endless interview. After two or three exchanges on a thread, synthesize: say what you have heard, give a clear takeaway or your honest view, and name one concrete next step. Do not end every message with a question, and never manufacture a question just to keep the conversation alive. When a thread has run its course, land it and close cleanly. Questions are a tool to reach a conclusion, not a way to avoid one."""

    if is_opening:
        prompt += """

OPENING MESSAGE INSTRUCTIONS:
Generate a single opening message. Use this priority order for signal selection:
  1. FIRST: The user's own thinking. Open by engaging with a standing conviction, a recent working note, or a thesis they actually wrote.
  2. SECOND: A concrete observation about their portfolio. A position that has moved, a concentration (e.g. weight > 30%), or a behavioural gap between their stated risk tolerance and what they actually hold.
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
            model="claude-sonnet-4-6",
            max_tokens=300,
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
        f"  • {t['ticker']} ({t.get('stance', 'note')}): {t.get('title', '')} — {(t.get('body') or '')[:220]}"
        for t in thesis_notes[:8]
    ) if thesis_notes else "  No thesis written yet."

    philosophy_block = f'\n- Their own investing philosophy: "{philosophy}". Honor it; align your framing to how they actually think.' if philosophy else ""

    savings_rate = cf.get("savings_rate")
    net_worth = nw.get("net_worth", 0)

    system = f"""{_NO_ADVICE_GUARDRAIL}

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
- Conversational, plain language, no bullet points, no em-dashes."""

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
- Plain language, no bullet-point lists in the output, no em-dashes."""

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=520,
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

    facts: list[str] = [f"Sector: {data.get('sector') or 'unknown'}", f"Industry: {data.get('industry') or 'unknown'}"]
    for label, key, suffix in [
        ("Revenue growth", "revenue_growth", "%"), ("Earnings growth", "earnings_growth", "%"),
        ("Profit margin", "profit_margin", "%"), ("Operating margin", "operating_margin", "%"),
        ("Trailing P/E", "pe_trailing", ""), ("Forward P/E", "pe_forward", ""),
        ("Current price", "current_price", ""), ("Analyst target", "analyst_target", ""),
    ]:
        v = data.get(key)
        if v is not None:
            facts.append(f"{label}: {v}{suffix}")
    facts_block = "\n".join(f"  • {f}" for f in facts)

    system = f"""{_NO_ADVICE_GUARDRAIL}

You are Velnor's valuation coach. The user wants to know HOW to value {company} ({ticker}): which framework fits this kind of business at its stage, and which assumptions actually drive the answer. You teach the approach; you do not output a price target or a buy/sell call.

What we know about {ticker} (use only this; do not invent other figures):
{facts_block}

Pick the framework that fits the business type and stage, and explain why. Guidance:
- High-growth / not yet profitable (e.g. neo-cloud like Nebius, early SaaS): EV/Sales, with growth durability and a credible path to margins. P/E is meaningless here.
- Banks / lenders: Price/Tangible Book Value and ROTCE; net interest margin and credit quality drive it.
- Mature, profitable, cash-generative: P/E and a DCF; FCF yield as a cross-check.
- Cyclicals: normalized/mid-cycle earnings, not peak or trough.
- Insurers: P/Book and combined ratio. REITs: P/FFO.

Write under 200 words:
1. Name the right primary framework for {ticker} and one sentence why it fits this business.
2. The 2-3 assumptions that matter most for that framework, given the data above.
3. One honest caveat or the easiest way to fool yourself valuing this name.

Rules: ground in the data above; never fabricate specific multiples, prices, peers, or a target you were not given. Educational and non-directive, no buy/sell call, no disclaimers (the app shows that separately). Plain language, no bullet-list formatting, no em-dashes."""

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=520,
            system=system,
            messages=[{"role": "user", "content": f"How should I value {ticker}?"}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        logger.error("Valuation coaching stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

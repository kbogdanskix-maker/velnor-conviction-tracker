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

def _build_plan_prompt(context: dict) -> str:
    nw = context.get("net_worth") or {}
    cf = context.get("cash_flow") or {}
    goals = context.get("goals") or []
    portfolio = context.get("portfolio") or {}

    monthly_savings = (cf.get("total_income") or 0) - (cf.get("total_expenses") or 0)
    savings_rate = (monthly_savings / cf["total_income"] * 100) if cf.get("total_income") else 0

    if goals:
        goals_block = "\n".join(
            f"  • {g['name']}: target ${float(g['target_amount']):,.0f} by {g['target_date']} — "
            f"at ${float(g['current_amount']):,.0f} ({float(g['current_amount']) / float(g['target_amount']) * 100:.0f}%), "
            f"contributing ${float(g['monthly_contribution']):,.0f}/mo"
            for g in goals
        )
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

    return f"""You are a thoughtful personal financial advisor. A Vela platform user has asked for their personalised financial plan. Use ONLY the data provided below — do not invent numbers.

=== FINANCIAL SNAPSHOT ===

Net Worth:
  • Assets: ${float(nw.get('total_assets') or 0):,.0f}
  • Liabilities: ${float(nw.get('total_liabilities') or 0):,.0f}
  • Net Worth: ${float(nw.get('net_worth') or 0):,.0f}

Monthly Cash Flow:
  • Income: ${float(cf.get('total_income') or 0):,.0f}
  • Expenses: ${float(cf.get('total_expenses') or 0):,.0f}
  • Savings: ${monthly_savings:,.0f} ({savings_rate:.0f}% savings rate)
{portfolio_block}

Goals:
{goals_block}

=== YOUR TASK ===

Write a personalised financial plan using these exact markdown sections:

## Financial Health Overview
2–3 sentences assessing their position. Name 1 clear strength and 1 area to improve, citing their numbers.

## Priority Actions
5 numbered, specific actions. Each must reference their actual data (amounts, dates, percentages). No generic advice.

## Goals Analysis
For each goal: are they on track? What adjustment (if any) would close the gap?

## Investment Strategy
Tailored to their portfolio size and savings rate. Be concrete.

## Risks to Watch
2–3 specific risks given their numbers. Why each matters.

Keep each section tight. Be direct, encouraging, and analytical. Every recommendation must be tied to their actual figures."""


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

    prompt = f"""You are Vela's portfolio reflection assistant. Your role is to help the user think clearly about their portfolio — not to critique or grade them, but to observe, ask focused questions, and surface connections they may not have made.

Investor profile:
  • Age: {age}, Risk tolerance: {risk}, Tax bracket: {tax}%
  • Sophistication: {sophistication}

Tone instruction: {tone_instruction}

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

Behavioural rules — follow these exactly:
  1. Ask one question at a time. Never ask two questions in one message.
  2. Keep responses under 120 words unless the user explicitly asks you to elaborate.
  3. Never tell the user they made a mistake. Ask questions that help them reach their own conclusions.
  4. Never add generic financial disclaimers, "consult a financial advisor", or boilerplate caveats.
  5. When the user's notes mention a market theme, actively connect it to their actual portfolio holdings.
  6. Reference specific tickers and real numbers from their portfolio — never speak in generalities."""

    if is_opening:
        prompt += """

OPENING MESSAGE INSTRUCTIONS:
Generate a single opening message. Use this priority order for signal selection:
  1. FIRST: Cross-reference the user's notes (flagged convictions + recent working notes) with live macro data. If any note connects to a current macro signal, open with that connection specifically.
  2. SECOND: If a position has moved significantly or crossed a notable threshold (e.g. weight > 30%), surface that.
  3. FALLBACK ONLY: If nothing notable in notes or market, surface the behavioural gap (stated risk tolerance vs. actual avg hold time implied by holdings duration).
Never open by simply listing the largest position — it is too static and will repeat every session.
Start with the observation. End with exactly one focused question. Max 80 words total."""

    return prompt


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

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=system_prompt,
            messages=convo,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Reflection stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

"""Deep Dive — an equity-research-style briefing on one ticker.

Borrows the STRUCTURE of a research note (sections, exhibits, key takeaways,
sourcing discipline) and none of its conclusions. A sell-side note ends in a
rating and a price target; under the no-advice guardrail this must not, so the
report carries sourced facts and a comparison against the user's own recorded
reasoning, and stops there.

Ordering is deliberate and load-bearing: the sourced record comes first, the
user's thesis is only compared against it at the end. Reading the facts before
the self-assessment is the point.

Cost shape: one Opus call with live web search, rate limited per user
(COOLDOWN_DAYS). The result is persisted as structured JSON so the page renders
from Postgres and later AI surfaces can cite an existing dive instead of
re-researching the same ground.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic

from app.config import settings
from app.services import market_data
from app.services.ai_service import _NO_ADVICE_GUARDRAIL, _OUTPUT_STYLE

logger = logging.getLogger(__name__)

MODEL = "claude-opus-4-8"
COOLDOWN_DAYS = 5
MAX_WEB_SEARCHES = 12
MAX_WEB_FETCHES = 12
MAX_TOOL_ITERATIONS = 24

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def load_guideline() -> str | None:
    """Operator-authored house style, if one has been dropped on disk.

    Lets the guideline be edited without a code change or redeploy. Read per
    run rather than cached, because runs are rare (one per user per cooldown)
    and an edit should take effect on the next dive. Resolved relative to the
    backend package root so it works regardless of the worker's CWD.

    Whatever it says, it is appended AFTER the guardrail and cannot relax it
    (see _build_system).
    """
    path = Path(settings.DEEP_DIVE_GUIDELINE_PATH)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    try:
        text = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None
    except OSError as e:
        logger.warning("Deep dive guideline at %s unreadable: %s", path, e)
        return None
    return text or None


# ── Report schema ─────────────────────────────────────────────────────────────
# Facts first, thesis comparison last. Every factual array carries a source_url
# so nothing in the rendered report is unattributable.

_CITED_POINT = {
    "type": "object",
    "properties": {
        "point": {"type": "string"},
        "source_url": {"type": "string"},
    },
    "required": ["point", "source_url"],
    "additionalProperties": False,
}

REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ticker": {"type": "string"},
        "company_name": {"type": "string"},
        "as_of": {"type": "string", "description": "ISO date the research was run"},
        "headline": {
            "type": "string",
            "description": "One neutral sentence stating what has happened since the last period. No judgement on the security.",
        },
        "key_takeaways": {
            "type": "array",
            "items": _CITED_POINT,
            "description": "3-5 sourced facts a holder would want to know. Facts, not conclusions.",
        },
        "business_snapshot": {
            "type": "string",
            "description": "What the company actually does and how it makes money. Plain language.",
        },
        "recent_developments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "headline": {"type": "string"},
                    "detail": {"type": "string"},
                    "why_it_connects": {
                        "type": "string",
                        "description": "How this ties to what the business does. Mechanism, not implication for the share price.",
                    },
                    "source_url": {"type": "string"},
                    "source_title": {"type": "string"},
                },
                "required": ["date", "headline", "detail", "why_it_connects", "source_url", "source_title"],
                "additionalProperties": False,
            },
        },
        "results_vs_expectations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "period": {"type": "string"},
                    "metric": {"type": "string"},
                    "reported": {"type": "string"},
                    "expected": {"type": "string", "description": "Consensus as reported by the source. Empty string if not sourced."},
                    "source_url": {"type": "string"},
                },
                "required": ["period", "metric", "reported", "expected", "source_url"],
                "additionalProperties": False,
            },
        },
        "upcoming_events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "event": {"type": "string"},
                    "detail": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["date", "event", "detail", "source_url"],
                "additionalProperties": False,
            },
            "description": "Earnings dates, conferences, investor days, regulatory decisions.",
        },
        "exhibits": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "kind": {"type": "string", "enum": ["bar", "line"]},
                    "unit": {"type": "string"},
                    "note": {"type": "string"},
                    "source_url": {"type": "string"},
                    "points": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "value": {"type": "number"},
                            },
                            "required": ["label", "value"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["title", "kind", "unit", "note", "source_url", "points"],
                "additionalProperties": False,
            },
            "description": "Charts built ONLY from figures actually retrieved. Never invent a data point to complete a series.",
        },
        "risks_flagged_by_sources": {
            "type": "array",
            "items": _CITED_POINT,
            "description": "Risks the SOURCES raise, attributed to them. Not your own risk assessment of the holding.",
        },
        # ── Comes last on purpose: the user reads the record before the mirror.
        "thesis_check": {
            "type": "object",
            "properties": {
                "has_thesis": {"type": "boolean"},
                "summary": {
                    "type": "string",
                    "description": "Neutral framing of what the user wrote and what the record shows. No verdict on the holding or the thesis.",
                },
                "observations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "you_wrote": {"type": "string", "description": "Quote or close paraphrase of the user's own words."},
                            "written_on": {"type": "string"},
                            "what_the_record_shows": {"type": "string", "description": "The sourced fact bearing on it."},
                            "source_url": {"type": "string"},
                            "relation": {
                                "type": "string",
                                "enum": ["consistent", "diverges", "not_yet_addressed"],
                                "description": "Relationship between the user's recorded reasoning and the sourced record. NOT a view on the security.",
                            },
                        },
                        "required": ["you_wrote", "written_on", "what_the_record_shows", "source_url", "relation"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["has_thesis", "summary", "observations"],
            "additionalProperties": False,
        },
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "url": {"type": "string"},
                    "publisher": {"type": "string"},
                },
                "required": ["title", "url", "publisher"],
                "additionalProperties": False,
            },
        },
        "limitations": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What could not be verified, what is stale, where sourcing was thin.",
        },
    },
    "required": [
        "ticker", "company_name", "as_of", "headline", "key_takeaways",
        "business_snapshot", "recent_developments", "results_vs_expectations",
        "upcoming_events", "exhibits", "risks_flagged_by_sources",
        "thesis_check", "sources", "limitations",
    ],
    "additionalProperties": False,
}


# ── Custom tools — our own market data, not a third-party MCP ─────────────────
# Routing through market_data keeps the Redis cache, the ~4 req/s Yahoo throttle
# and the empty-result guards. A direct-to-Yahoo MCP would bypass all three and
# reintroduce the 429 storm inside a paid Opus run.

CUSTOM_TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_company_fundamentals",
        "description": (
            "Current fundamentals for a ticker from the app's own cached market data: "
            "sector, industry, margins, growth, market cap, employees. Use this before "
            "searching the web for figures that may already be here."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_company_financials",
        "description": "Income statement, balance sheet and cash flow statement history for a ticker.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_company_news",
        "description": "Recent news headlines for a ticker, with URLs you can then fetch in full.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_price_history",
        "description": "Daily close history for a ticker. Use for exhibits that need a price series.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "period": {"type": "string", "description": "e.g. 1mo, 6mo, 1y, 2y, 5y"},
            },
            "required": ["ticker", "period"],
        },
    },
]


async def _run_custom_tool(name: str, args: dict[str, Any]) -> str:
    """Execute one custom tool against our own market-data layer."""
    ticker = (args.get("ticker") or "").upper().strip()
    try:
        if name == "get_company_fundamentals":
            return json.dumps(await market_data.get_ticker_info(ticker) or {})
        if name == "get_company_financials":
            return json.dumps(await market_data.get_financials(ticker) or {})
        if name == "get_company_news":
            return json.dumps(await market_data.get_ticker_news(ticker) or [])
        if name == "get_price_history":
            period = args.get("period") or "1y"
            return json.dumps(await market_data.get_historical_prices(ticker, period=period) or [])
    except Exception as e:  # a tool failure must not kill the run
        logger.warning("deep-dive tool %s failed for %s: %s", name, ticker, e)
        return json.dumps({"error": f"{name} unavailable: {e}"})
    return json.dumps({"error": f"unknown tool {name}"})


# ── Prompt ────────────────────────────────────────────────────────────────────

_RESEARCH_RULES = """\
You are producing a Deep Dive: a research briefing on one company for the person who owns or is tracking it.

Borrow the DISCIPLINE of equity research: organised sections, exhibits built from real figures, explicit sourcing, stated limitations. Do NOT borrow its conclusions. A sell-side note ends in a rating and a price target. This one must not.

HARD LIMITS (compliance, not style, these override any research convention you know):
- No rating, recommendation, or equivalent language. Not "Buy", "Hold", "Sell", "Overweight", "Accumulate", "constructive", "cautious", or any coded variant.
- No price target, fair value, valuation range, or implied upside/downside.
- No statement or implication that the stock is cheap, expensive, over- or under-valued, attractive, or fairly valued.
- No forecast of where the share price goes, and no "we expect the shares to...".
- No suggestion the user buy, sell, hold, add, trim, or wait, however soft or hypothetical.
- Risks belong to the sources that raised them. Attribute them ("Reuters notes...") rather than issuing your own risk verdict on the holding.

SOURCING:
- Every factual claim carries the URL it came from. If you cannot source it, leave it out.
- Never invent a number, a consensus estimate, a date, or a data point to round out an exhibit. A short exhibit is fine; a fabricated one is not.
- Prefer primary sources (filings, company IR, transcripts) over aggregators. Note when a figure is a source's estimate rather than a reported result.
- Say plainly in `limitations` what you could not verify or could not find.

ORDER OF WORK, this matters:
1. First establish the sourced record: what the business does, what has happened, results against expectations, what is scheduled next.
2. ONLY THEN look at the user's own recorded thesis and compare it against that record.
The user reads the facts before they read the mirror. Do not let their existing view shape which facts you go looking for.

THE THESIS COMPARISON:
- Quote what they actually wrote and when, then set the sourced fact beside it.
- `relation` describes the relationship between their recorded reasoning and the record: consistent, diverges, or not_yet_addressed.
- That is a statement about their reasoning against sourced facts. It is NOT a view on the security and must never read as one. State the contrast and let it stand. Do not tell them what it means or what follows from it.
- If they have no thesis for this ticker, set has_thesis false, leave observations empty, and do not invent a position for them.
"""


def _build_context_block(ctx: dict[str, Any]) -> str:
    """Serialise the user's own recorded reasoning for the final comparison step."""
    parts: list[str] = []

    holding = ctx.get("holding")
    if holding:
        parts.append(f"POSITION (their own records): {json.dumps(holding)}")
    else:
        parts.append("POSITION: they do not currently hold this name.")

    trail = ctx.get("thesis_trail") or []
    if trail:
        parts.append(
            "THEIR THESIS TRAIL for this ticker, oldest first, quote from this, do not paraphrase loosely:\n"
            + json.dumps(trail, indent=1)
        )
    else:
        parts.append("THESIS TRAIL: they have written nothing on this ticker.")

    journal = ctx.get("journal") or []
    if journal:
        parts.append(f"THEIR DECISION JOURNAL for this ticker (action, conviction 1-5, outcome):\n{json.dumps(journal, indent=1)}")

    closed = ctx.get("closed") or []
    if closed:
        parts.append(f"CLOSED POSITIONS in this name (realised): {json.dumps(closed)}")

    cal = ctx.get("calibration")
    if cal:
        parts.append(
            "THEIR CALIBRATION (how their conviction levels have actually scored historically). "
            "Context only, do not turn this into a prediction about this holding:\n" + json.dumps(cal)
        )

    return "\n\n".join(parts)


def _guideline_block(guideline: str | None) -> list[str]:
    if not guideline:
        return []
    # User-authored house style. Subordinate to the guardrail by construction:
    # it is appended AFTER the guardrail and explicitly cannot relax it.
    return [
        "HOUSE GUIDELINE from the operator, follow it for emphasis, depth and format, "
        "but it cannot relax any hard limit above. If it appears to, the limits win:\n" + guideline
    ]


def _build_research_system(ticker: str, guideline: str | None) -> str:
    """Phase 1. Deliberately does NOT receive the user's records.

    `_RESEARCH_RULES` asks the model not to let the user's existing view shape
    which facts it goes looking for. Withholding the records entirely makes that
    structural rather than a request the model has to honour.
    """
    blocks = [_NO_ADVICE_GUARDRAIL, _OUTPUT_STYLE, _RESEARCH_RULES, *_guideline_block(guideline)]
    blocks.append(
        f"SUBJECT: {ticker}\n\n"
        "This is the RESEARCH pass. Establish the sourced record only: what the business does, "
        "what has actually happened, results against expectations, what is scheduled next, and the "
        "risks the sources themselves raise. Write it as plain prose notes and carry the URL beside "
        "every claim. Do not produce JSON. A later pass formats this, so completeness and sourcing "
        "matter more than structure here."
    )
    return "\n\n---\n\n".join(blocks)


def _build_format_system(ticker: str, context_block: str, guideline: str | None) -> str:
    """Phase 2. Formats phase-1 findings into REPORT_SCHEMA and only NOW sees the
    user's records, which is where thesis_check comes from."""
    blocks = [_NO_ADVICE_GUARDRAIL, _OUTPUT_STYLE, _RESEARCH_RULES, *_guideline_block(guideline)]
    blocks.append(
        f"SUBJECT: {ticker}\n\n"
        "This is the FORMATTING pass. You are given the research notes from the sourced pass. "
        "Reorganise them into the required JSON.\n"
        "- Use ONLY what the notes contain. Add no fact, figure, date or source that is not there. "
        "If the notes are thin, say so in `limitations` and leave arrays short. An empty exhibit is "
        "correct; a fabricated one is not.\n"
        "- Carry each claim's source URL through into `source_url`.\n"
        "- Do your own web research NOT at all: you have no tools in this pass by design.\n\n"
        "THE USER'S OWN RECORDS, these arrive only now, and feed `thesis_check` alone. "
        "`thesis_check.relation` is a statement about THEIR REASONING against the sourced record "
        "(consistent / diverges / not_yet_addressed), never a judgement about the security:\n\n"
        + context_block
    )
    return "\n\n---\n\n".join(blocks)


# ── Runner ────────────────────────────────────────────────────────────────────

async def _research_phase(
    client: AsyncAnthropic,
    ticker: str,
    guideline: str | None,
    totals: dict[str, int],
) -> str:
    """Phase 1: gather the sourced record with tools. No output schema.

    Structured output and tool use cannot coexist (see generate_deep_dive), so
    this pass runs tools and returns free-text notes.
    """
    tools: list[dict[str, Any]] = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": MAX_WEB_SEARCHES},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": MAX_WEB_FETCHES},
        *CUSTOM_TOOLS,
    ]
    system = _build_research_system(ticker, guideline)
    messages: list[dict[str, Any]] = [{
        "role": "user",
        "content": (
            f"Research {ticker}. Establish the sourced record: business, recent developments, "
            "results against expectations, scheduled events, and the risks the sources raise. "
            "Carry a URL beside every claim."
        ),
    }]

    # Server tools (web_fetch in particular) can allocate a container. Once one
    # exists, every continuation has to name it or the API rejects the turn with
    # "container_id is required when there are pending tool uses".
    container: str | None = None

    for _ in range(MAX_TOOL_ITERATIONS):
        kwargs: dict[str, Any] = {
            "model": MODEL,
            "max_tokens": 16000,
            "thinking": {"type": "adaptive"},
            "system": system,
            "tools": tools,
            "messages": messages,
        }
        if container:
            kwargs["container"] = container

        async with client.messages.stream(**kwargs) as stream:
            msg = await stream.get_final_message()

        got = getattr(msg, "container", None)
        if got is not None:
            container = getattr(got, "id", got)

        totals["input_tokens"] += msg.usage.input_tokens or 0
        totals["output_tokens"] += msg.usage.output_tokens or 0
        totals["web_searches"] += sum(
            1 for b in msg.content if getattr(b, "type", None) == "server_tool_use"
        )

        # A server tool paused the turn — resend to let it continue.
        if msg.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": msg.content})
            continue

        if msg.stop_reason == "refusal":
            raise RuntimeError("Model declined to research this company.")

        tool_uses = [b for b in msg.content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            notes = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
            if not notes.strip():
                raise RuntimeError("Research pass returned no findings.")
            return notes

        messages.append({"role": "assistant", "content": msg.content})
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": await _run_custom_tool(tu.name, tu.input or {}),
                }
                for tu in tool_uses
            ],
        })

    raise RuntimeError("Deep dive exceeded its tool-iteration budget during research.")


async def _format_phase(
    client: AsyncAnthropic,
    ticker: str,
    notes: str,
    context: dict[str, Any],
    guideline: str | None,
    totals: dict[str, int],
) -> dict[str, Any]:
    """Phase 2: format the notes into REPORT_SCHEMA. Schema on, tools off."""
    system = _build_format_system(ticker, _build_context_block(context), guideline)

    async with client.messages.stream(
        model=MODEL,
        max_tokens=32000,
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": REPORT_SCHEMA}},
        system=system,
        messages=[{
            "role": "user",
            "content": (
                f"Research notes for {ticker} from the sourced pass:\n\n{notes}\n\n"
                "Format these into the required JSON, then compare my recorded thesis against them "
                "in thesis_check. Use only what the notes contain."
            ),
        }],
    ) as stream:
        msg = await stream.get_final_message()

    totals["input_tokens"] += msg.usage.input_tokens or 0
    totals["output_tokens"] += msg.usage.output_tokens or 0

    if msg.stop_reason == "refusal":
        raise RuntimeError("Model declined to produce this report.")

    text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    if not text.strip():
        raise RuntimeError("Model returned no report body.")
    return json.loads(text)


async def generate_deep_dive(
    ticker: str,
    context: dict[str, Any],
    guideline: str | None = None,
) -> dict[str, Any]:
    """Run one deep dive. Returns {report, usage}. Raises on unrecoverable failure.

    TWO PASSES, and it has to be two. Structured output (`output_config` with a
    json_schema) and tool use are mutually exclusive here: sending both returns
    400 "compiled grammar is too large" even with a single tool, so the schema
    cannot simply be trimmed. Verified by isolation: schema alone passes, all
    tools with no schema pass, schema plus any one tool fails.

    Splitting it also strengthens the ordering that `_RESEARCH_RULES` asks for.
    The research pass never receives the user's records, so their existing view
    cannot steer which facts get looked up; the records arrive only in the
    formatting pass, which is where `thesis_check` is written.
    """
    client = _get_client()
    guideline = guideline or load_guideline()
    totals = {"input_tokens": 0, "output_tokens": 0, "web_searches": 0}

    notes = await _research_phase(client, ticker, guideline, totals)
    report = await _format_phase(client, ticker, notes, context, guideline, totals)

    return {"report": report, "usage": totals}

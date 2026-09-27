"""The demo portfolio fixture.

Pure data: no ORM imports, no database, no clock beyond a fixed anchor. Kept
separate from `demo_seed.py` so its shape can be unit tested without a Postgres
instance (Docker is unavailable on the dev machine).

VOICE AND ATTRIBUTION — read before editing any prose here.
These notes are written as an explicitly fictional sample investor. They are
operator-authored content about real securities, so the AI no-advice guardrail
does NOT cover them; attribution to a labelled persona is what keeps them
demonstrably not the operator's own research. Keep every entry in first person
as this character, keep the UI marker "Sample portfolio - not investment
advice" in place, and never write anything that reads as a recommendation to a
reader: no price targets, no buy/sell language, no "you should".
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Dates are relative to a fixed anchor rather than `now()` so the fixture is
# deterministic and its tests cannot break on a particular day.
_ANCHOR = datetime(2026, 9, 1, 14, 30, tzinfo=timezone.utc)


def _months_ago(n: int) -> datetime:
    return _ANCHOR - timedelta(days=n * 30)


@dataclass(frozen=True)
class SeedTransaction:
    ticker: str
    transaction_type: str  # buy | sell
    quantity: Decimal
    price: Decimal
    executed_at: datetime
    notes: str = ""


@dataclass(frozen=True)
class SeedThesisEntry:
    body: str
    entry_type: str  # bull | bear | update | note
    created_at: datetime


@dataclass(frozen=True)
class SeedThesis:
    ticker: str
    title: str
    diverged: bool
    entries: list[SeedThesisEntry] = field(default_factory=list)


@dataclass(frozen=True)
class SeedJournalEntry:
    ticker: str
    action: str  # buy | sell | hold | trim | add | watch
    conviction: int  # 1-5
    rationale: str
    decided_at: datetime
    outcome: str | None = None


@dataclass(frozen=True)
class SeedWatchlistItem:
    ticker: str
    notes: str


# ── Transactions ──────────────────────────────────────────────────────────────
# Six open positions plus one fully closed (NKE), spanning ~20 months.

SEED_TRANSACTIONS: list[SeedTransaction] = [
    SeedTransaction("MSFT", "buy", Decimal("18"), Decimal("402.15"), _months_ago(20),
                    "Starter position. Azure margin story is the whole reason."),
    SeedTransaction("ASML", "buy", Decimal("9"), Decimal("712.40"), _months_ago(18),
                    "EUV monopoly. Sized small because the cyclicality scares me."),
    SeedTransaction("NKE", "buy", Decimal("60"), Decimal("98.20"), _months_ago(17),
                    "Brand turnaround bet."),
    SeedTransaction("COST", "buy", Decimal("11"), Decimal("735.60"), _months_ago(14),
                    "Membership renewal rates are the moat."),
    SeedTransaction("MSFT", "buy", Decimal("7"), Decimal("441.80"), _months_ago(11),
                    "Adding after the capex scare. Thesis unchanged."),
    SeedTransaction("NVDA", "buy", Decimal("14"), Decimal("118.90"), _months_ago(9),
                    "Late to this one and sizing accordingly."),
    SeedTransaction("NKE", "sell", Decimal("60"), Decimal("74.85"), _months_ago(7),
                    "Closing out. Four quarters of the turnaround not showing up."),
    SeedTransaction("ADBE", "buy", Decimal("12"), Decimal("512.30"), _months_ago(6),
                    "Assuming AI is additive to seats, not a substitute for them."),
    SeedTransaction("TSM", "buy", Decimal("22"), Decimal("172.45"), _months_ago(4),
                    "The whole industry rents its capacity."),
    SeedTransaction("COST", "buy", Decimal("4"), Decimal("881.20"), _months_ago(2),
                    "Topping up on no new information, which I should be honest about."),
]

# ── Theses ────────────────────────────────────────────────────────────────────
# ADBE is the deliberate divergence: the assumption is being contradicted and
# the entries say so, which is what makes the Journey map show amber/red.

SEED_THESES: list[SeedThesis] = [
    SeedThesis(
        ticker="MSFT",
        title="Azure margin expansion outlasts the capex cycle",
        diverged=False,
        entries=[
            SeedThesisEntry(
                "Core assumption: Azure gross margin keeps climbing even while capex "
                "runs hot, because the incremental workload mix is higher-margin than "
                "the base. If margin flattens for two consecutive quarters while capex "
                "stays elevated, I am wrong.",
                "bull", _months_ago(20),
            ),
            SeedThesisEntry(
                "Capex guide came in heavier than I modelled and the stock took it "
                "badly. Margin still expanded. This is the scenario I wrote down, so I "
                "added rather than trimmed.",
                "update", _months_ago(11),
            ),
            SeedThesisEntry(
                "Four quarters on, margin trend intact. Noting that I have not "
                "re-underwritten the assumption since I wrote it, only re-confirmed it, "
                "which is a different and weaker thing.",
                "note", _months_ago(3),
            ),
        ],
    ),
    SeedThesis(
        ticker="ADBE",
        title="Generative AI is additive to seat count, not a substitute",
        diverged=True,
        entries=[
            SeedThesisEntry(
                "Assumption: AI tooling pulls more people into Creative Cloud than it "
                "displaces, so net seats grow. Falsifier: two quarters of decelerating "
                "net-new subscriptions with AI features shipped.",
                "bull", _months_ago(6),
            ),
            SeedThesisEntry(
                "Net-new subscription growth decelerated again. That is the second "
                "quarter. By my own falsifier I am on the wrong side of this, and I am "
                "writing it down before I start explaining it away.",
                "bear", _months_ago(2),
            ),
            SeedThesisEntry(
                "Still holding, and I want to be honest that the reason is inertia "
                "rather than a revised thesis. Revisit with a decision next quarter.",
                "update", _months_ago(1),
            ),
        ],
    ),
    SeedThesis(
        ticker="NKE",
        title="Brand-led turnaround shows up in wholesale reorders",
        diverged=True,
        entries=[
            SeedThesisEntry(
                "Assumption: the direct-to-consumer reset is temporary and wholesale "
                "reorders recover within four quarters.",
                "bull", _months_ago(17),
            ),
            SeedThesisEntry(
                "Four quarters gone, reorders have not recovered. I set the window "
                "myself and it closed. Exiting.",
                "bear", _months_ago(7),
            ),
        ],
    ),
    SeedThesis(
        ticker="ASML",
        title="EUV monopoly survives the China restrictions",
        diverged=False,
        entries=[
            SeedThesisEntry(
                "Assumption: export restrictions dent the order book but not the "
                "monopoly, because there is no second supplier at this node.",
                "bull", _months_ago(18),
            ),
            SeedThesisEntry(
                "Order book lumpier than expected, monopoly unchallenged. Sizing stays "
                "small because I cannot time the cycle and have stopped pretending I "
                "can.",
                "update", _months_ago(5),
            ),
        ],
    ),
]

# ── Journal ───────────────────────────────────────────────────────────────────
# Conviction moves for MSFT (4 -> 3 -> 5) and ADBE (4 -> 2), which is what the
# Journey map's conviction trend reads.

SEED_JOURNAL: list[SeedJournalEntry] = [
    SeedJournalEntry("MSFT", "buy", 4,
                     "Opening at what I think is a fair price for a compounding margin story.",
                     _months_ago(20)),
    SeedJournalEntry("ASML", "buy", 3,
                     "High conviction in the moat, low conviction in my entry timing.",
                     _months_ago(18)),
    SeedJournalEntry("NKE", "buy", 4,
                     "Turnaround bet with a four-quarter window I have written down.",
                     _months_ago(17)),
    SeedJournalEntry("COST", "buy", 4,
                     "Paying up for predictability. Aware that is a choice.",
                     _months_ago(14)),
    SeedJournalEntry("MSFT", "hold", 3,
                     "Capex scare knocked my conviction even though the thesis held. "
                     "Recording the wobble rather than pretending it did not happen.",
                     _months_ago(12)),
    SeedJournalEntry("MSFT", "add", 5,
                     "Margin expanded through the capex cycle exactly as written. "
                     "Conviction is now higher than before the scare.",
                     _months_ago(11)),
    SeedJournalEntry("NVDA", "buy", 3,
                     "Buying something already well understood by everyone. Small size.",
                     _months_ago(9)),
    SeedJournalEntry("NKE", "sell", 2,
                     "My own window closed without the evidence arriving.",
                     _months_ago(7), outcome="loss"),
    SeedJournalEntry("ADBE", "buy", 4,
                     "Betting AI expands the seat base. Falsifier written into the thesis.",
                     _months_ago(6)),
    SeedJournalEntry("TSM", "buy", 4,
                     "The capacity everyone else depends on.",
                     _months_ago(4)),
    SeedJournalEntry("ADBE", "hold", 2,
                     "Falsifier hit. Conviction down hard and I have not acted yet, "
                     "which is itself the thing worth tracking.",
                     _months_ago(2)),
]

SEED_WATCHLIST: list[SeedWatchlistItem] = [
    SeedWatchlistItem("LVMH.PA", "Want to understand aspirational-spend cyclicality first."),
    SeedWatchlistItem("V", "Waiting to see whether stablecoin rails dent the take rate."),
    SeedWatchlistItem("SHOP", "Interested, but I do not have an edge on GMV durability."),
    SeedWatchlistItem("NVO", "Watching supply constraints ease before forming a view."),
]

DEMO_PORTFOLIO_NAME = "Sample Portfolio"

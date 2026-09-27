"""
Deep Dive background job — run a Deep Dive asynchronously.

An Opus run with live web search takes minutes, which is well past any request
timeout or spinner, so the HTTP layer only enqueues. The job owns the whole
lifecycle: mark running, research, persist the structured report, mark complete.
A failure is recorded on the row rather than swallowed, so the UI can show what
went wrong. (There is no cooldown refund on failure — see run_deep_dive_sync.)

Demo release: Deep Dive is now capped at one global run per day (see
app.core.ai_budget), which does not justify a dedicated always-on Celery
worker machine — that would roughly double the hosting bill to process at
most one job daily. The work now runs via FastAPI's BackgroundTasks instead.
`run_deep_dive_sync` below is the plain, `self`-free function the FastAPI
router hands to `BackgroundTasks.add_task`. The Celery task is kept as a thin
wrapper that delegates to it, so the Celery path still works if it's ever
restored — a Celery task declared with `bind=True` takes `self` as its first
argument, which `BackgroundTasks.add_task` has no way to supply, hence the
split.
"""
import asyncio
import logging
import uuid
from datetime import datetime

from celery import shared_task
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db import DeepDiveReport
from app.services import deep_dive

logger = logging.getLogger(__name__)

# Synchronous SQLAlchemy for Celery (not async), matching import_task.
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def run_deep_dive_sync(report_id: str, context: dict, guideline: str | None = None) -> None:
    """Research one ticker and persist the report.

    `context` is prepared by the router (the user's own thesis trail, journal,
    closed positions and calibration) so this job does no ORM traversal of its
    own beyond the report row.

    Plain, `self`-free function so it can be handed directly to FastAPI's
    `BackgroundTasks.add_task` (and, in the Celery path, called from a task
    body). FastAPI runs a sync background-task callable in a threadpool
    thread with no running event loop, so the `asyncio.run(...)` below and the
    synchronous SQLAlchemy `Session` are both safe here.

    No internal retries: each attempt is a paid Opus run with live search. A
    silent retry would double-charge for a request the user made once.
    """
    with Session(sync_engine) as db:
        row = db.get(DeepDiveReport, uuid.UUID(report_id))
        if row is None:
            logger.error("Deep dive %s not found", report_id)
            return

        row.status = "running"
        db.commit()

        try:
            result = asyncio.run(
                deep_dive.generate_deep_dive(row.ticker, context, guideline)
            )
        except Exception as e:
            logger.exception("Deep dive %s failed for %s", report_id, row.ticker)
            row.status = "failed"
            row.error = str(e)[:2000]
            row.completed_at = datetime.utcnow()
            db.commit()
            return

        usage = result.get("usage") or {}
        row.report = result["report"]
        row.status = "complete"
        row.model = deep_dive.MODEL
        row.input_tokens = usage.get("input_tokens")
        row.output_tokens = usage.get("output_tokens")
        row.web_searches = usage.get("web_searches")
        row.completed_at = datetime.utcnow()
        db.commit()

        logger.info(
            "Deep dive %s complete for %s (in=%s out=%s searches=%s)",
            report_id, row.ticker, row.input_tokens, row.output_tokens, row.web_searches,
        )


@shared_task(name="tasks.run_deep_dive", bind=True, max_retries=0)
def run_deep_dive(self, report_id: str, context: dict, guideline: str | None = None):
    """Celery entry point — kept in case the worker is ever restored.

    `bind=True` means Celery passes `self` as the first argument, which is
    why this can't be the function FastAPI's `BackgroundTasks.add_task` calls
    directly. All the actual logic lives in `run_deep_dive_sync`.
    """
    return run_deep_dive_sync(report_id, context, guideline)

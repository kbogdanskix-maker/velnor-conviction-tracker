"""
Celery task — run a Deep Dive asynchronously.

An Opus run with live web search takes minutes, which is well past any request
timeout or spinner, so the HTTP layer only enqueues. The task owns the whole
lifecycle: mark running, research, persist the structured report, mark complete.
A failure is recorded on the row rather than swallowed, so the UI can show what
went wrong and the cooldown can be refunded.
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


@shared_task(name="tasks.run_deep_dive", bind=True, max_retries=0)
def run_deep_dive(self, report_id: str, context: dict, guideline: str | None = None):
    """Research one ticker and persist the report.

    `context` is prepared by the router (the user's own thesis trail, journal,
    closed positions and calibration) so this task does no ORM traversal of its
    own beyond the report row.

    max_retries=0 on purpose: each attempt is a paid Opus run with live search.
    A silent retry would double-charge for a request the user made once.
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

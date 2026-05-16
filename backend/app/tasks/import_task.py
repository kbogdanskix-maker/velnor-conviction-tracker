"""
Celery task — process a broker import file asynchronously.
"""
import uuid
import logging
from datetime import datetime
from decimal import Decimal

from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db import ImportJob, Transaction, Portfolio
from app.services.import_parser import parse_broker_file
from app.services import storage as r2

logger = logging.getLogger(__name__)

# Synchronous SQLAlchemy for Celery (not async)
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


@shared_task(name="tasks.process_broker_import", bind=True, max_retries=3)
def process_broker_import(self, job_id: str):
    """
    1. Load the import job from DB
    2. Download the file from R2
    3. Parse it with import_parser
    4. Insert transactions (skip duplicates)
    5. Update job status
    """
    with Session(sync_engine) as db:
        job = db.get(ImportJob, uuid.UUID(job_id))
        if job is None:
            logger.error("Import job %s not found", job_id)
            return

        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()

        try:
            # Download file from R2 (sync)
            import asyncio
            file_bytes = asyncio.run(r2.download_from_r2(job.file_url))
            filename = job.filename or "upload.csv"

            # Parse
            result = parse_broker_file(file_bytes, filename)

            job.broker = result.get("broker", "unknown")
            job.rows_total = len(result["transactions"]) + len(result["skipped"]) + len(result["errors"])
            job.rows_skipped = len(result["skipped"])

            # If broker unknown and needs mapping, we can't proceed
            if result.get("needs_mapping"):
                job.status = "awaiting_mapping"
                job.error_detail = {
                    "needs_mapping": True,
                    "columns": result.get("columns", []),
                    "preview": result.get("preview", []),
                }
                db.commit()
                return

            # Insert transactions, skip duplicates
            imported = 0
            error_rows = result.get("errors", [])

            for tx_data in result["transactions"]:
                try:
                    # Deduplicate check
                    existing = db.execute(
                        select(Transaction).where(
                            Transaction.portfolio_id == job.portfolio_id,
                            Transaction.ticker == tx_data["ticker"],
                            Transaction.executed_at == datetime.fromisoformat(tx_data["executed_at"]),
                            Transaction.quantity == Decimal(str(tx_data["quantity"])),
                            Transaction.price == Decimal(str(tx_data["price"])),
                        )
                    ).scalar_one_or_none()

                    if existing:
                        job.rows_skipped += 1
                        continue

                    tx = Transaction(
                        portfolio_id=job.portfolio_id,
                        ticker=tx_data["ticker"],
                        asset_type=tx_data.get("asset_type", "stock"),
                        transaction_type=tx_data["transaction_type"],
                        quantity=Decimal(str(tx_data["quantity"])),
                        price=Decimal(str(tx_data["price"])),
                        fees=Decimal(str(tx_data.get("fees", 0))),
                        currency=tx_data.get("currency", "USD"),
                        fx_rate=Decimal(str(tx_data.get("fx_rate", 1))),
                        executed_at=datetime.fromisoformat(tx_data["executed_at"]),
                        source="import",
                        broker=tx_data.get("broker"),
                        raw_import_data=tx_data.get("raw_data"),
                    )
                    db.add(tx)
                    imported += 1
                except Exception as e:
                    error_rows.append({"error": str(e), "data": tx_data})

            db.flush()

            # Recompute holdings synchronously
            from app.services.portfolio_calc import recompute_holdings as _sync_recompute
            asyncio.run(_sync_recompute(job.portfolio_id, db))

            job.rows_imported = imported
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            if error_rows:
                job.error_detail = {"row_errors": error_rows[:50]}  # cap stored errors

            db.commit()
            logger.info("Import job %s completed: %d imported, %d skipped", job_id, imported, job.rows_skipped)

        except Exception as exc:
            logger.error("Import job %s failed: %s", job_id, exc, exc_info=True)
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_detail = {"error": str(exc)}
            db.commit()
            raise self.retry(exc=exc, countdown=30)

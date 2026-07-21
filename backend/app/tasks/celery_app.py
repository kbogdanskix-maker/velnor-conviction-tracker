"""Celery application configuration."""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "vela",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.import_task", "app.tasks.price_snapshot", "app.tasks.price_alerts", "app.tasks.deep_dive_task"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # Daily price snapshots at 18:00 UTC (after US market close)
        "daily-price-snapshots": {
            "task": "tasks.daily_price_snapshot",
            "schedule": "0 18 * * *",  # cron syntax
        },
        # Price alerts check — every 5 min
        "check-price-alerts": {
            "task": "tasks.check_price_alerts",
            "schedule": 300,  # every 300 seconds
        },
    },
)

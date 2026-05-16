"""
Broker import router — handles file uploads and tracks job status.
The actual parsing is done asynchronously by a Celery worker.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_current_user, get_db
from app.models.db import User, Portfolio, ImportJob
from app.models.schemas import ImportJobOut
from app.services import storage
from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/imports")


@router.post("/upload", response_model=ImportJobOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_broker_file(
    portfolio_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a CSV/XLSX file from any broker.
    1. Validates the target portfolio belongs to this user.
    2. Uploads the file to Cloudflare R2.
    3. Creates an ImportJob record (status=pending).
    4. Enqueues a Celery task to parse the file.
    5. Returns the job ID for polling.
    """
    # Validate portfolio ownership
    result = await db.execute(
        select(Portfolio).where(
            Portfolio.id == portfolio_id,
            Portfolio.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Validate file type
    allowed_extensions = {".csv", ".xlsx", ".xls"}
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=422,
            detail=f"File type not supported. Allowed: {', '.join(allowed_extensions)}",
        )

    # Upload to R2
    file_bytes = await file.read()
    file_key = f"imports/{user.id}/{uuid.uuid4()}{ext}"
    file_url = await storage.upload_to_r2(file_key, file_bytes, content_type=file.content_type or "application/octet-stream")

    # Create job record
    job = ImportJob(
        user_id=user.id,
        portfolio_id=portfolio_id,
        status="pending",
        filename=filename,
        file_url=file_url,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue Celery task
    celery_app.send_task(
        "tasks.process_broker_import",
        args=[str(job.id)],
        countdown=1,
    )

    return job


@router.get("/{job_id}", response_model=ImportJobOut)
async def get_import_status(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the status of an import job."""
    result = await db.execute(
        select(ImportJob).where(
            ImportJob.id == job_id,
            ImportJob.user_id == user.id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job


@router.get("", response_model=list[ImportJobOut])
async def list_import_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all import jobs for the current user."""
    result = await db.execute(
        select(ImportJob)
        .where(ImportJob.user_id == user.id)
        .order_by(ImportJob.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()

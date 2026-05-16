"""
KV Store — generic cloud-synced JSON storage.
Replaces localStorage for subscriptions, insurance, budget, etc.

Allowed keys are whitelisted to prevent abuse.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any

from app.dependencies import get_current_user, get_db
from app.models.db import User, UserKVStore

router = APIRouter(prefix="/kv")

ALLOWED_KEYS = {"subscriptions", "insurance", "budget", "theses", "nw_history"}


class KVPut(BaseModel):
    data: Any  # JSON-serializable list or dict


@router.get("/{key}")
async def get_kv(
    key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read a JSON blob by key for the current user."""
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid key: {key}")

    result = await db.execute(
        select(UserKVStore).where(
            UserKVStore.user_id == user.id,
            UserKVStore.key == key,
        )
    )
    row = result.scalar_one_or_none()
    return {"key": key, "data": row.data if row else []}


@router.put("/{key}")
async def put_kv(
    key: str,
    body: KVPut,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert a JSON blob by key for the current user."""
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid key: {key}")

    result = await db.execute(
        select(UserKVStore).where(
            UserKVStore.user_id == user.id,
            UserKVStore.key == key,
        )
    )
    row = result.scalar_one_or_none()

    if row:
        row.data = body.data
    else:
        row = UserKVStore(user_id=user.id, key=key, data=body.data)
        db.add(row)

    await db.commit()
    return {"key": key, "data": row.data}

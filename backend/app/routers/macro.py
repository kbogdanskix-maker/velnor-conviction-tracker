"""
Macro dashboard — FRED data: bond yields, inflation, Fed policy.
All data cached daily in macro_snapshots table.
"""
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models.db import User
from app.services import macro_service

router = APIRouter(prefix="/macro")


@router.get("/dashboard")
async def get_macro_dashboard(_: User = Depends(get_current_user)):
    """
    Returns bond yields, inflation metrics, and Fed data.
    Data sourced from FRED API, cached daily.
    """
    return await macro_service.get_macro_dashboard()


@router.get("/fed-minutes")
async def get_fed_minutes(_: User = Depends(get_current_user)):
    """Latest Fed minutes summary from federalreserve.gov RSS feed."""
    return await macro_service.get_fed_minutes()

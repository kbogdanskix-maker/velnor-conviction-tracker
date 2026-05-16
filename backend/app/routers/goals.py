"""
Goals — CRUD for financial goals / goal planner.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import uuid

from app.dependencies import get_current_user, get_db
from app.models.db import User, Goal
from app.models.schemas import GoalCreate, GoalUpdate, GoalOut

router = APIRouter(prefix="/goals")


@router.get("", response_model=list[GoalOut])
async def list_goals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal)
        .where(Goal.user_id == user.id)
        .order_by(Goal.target_date.asc())
    )
    return result.scalars().all()


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = Goal(user_id=user.id, **body.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)

    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Goal)
        .where(Goal.id == goal_id, Goal.user_id == user.id)
        .returning(Goal.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.commit()

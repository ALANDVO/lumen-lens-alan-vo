from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.api.auth import get_current_user, require_role, User
from app.models.session import (
    Session,
    SessionConfig,
    SessionStatus,
    StepRecord,
    StepStatus,
    TargetPlatform,
    EngineType,
    get_session_store,
)
from app.services.session_manager import get_session_manager

router = APIRouter()


class SessionCreate(BaseModel):
    config: SessionConfig


class SessionResponse(BaseModel):
    id: str
    status: str
    config: SessionConfig
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    error: Optional[str] = None
    step_count: int = 0

    @classmethod
    def from_session(cls, session: Session) -> "SessionResponse":
        return cls(
            id=session.id,
            status=session.status.value,
            config=session.config,
            created_at=session.created_at,
            updated_at=session.updated_at,
            closed_at=session.closed_at,
            error=session.error,
            step_count=len(session.steps),
        )


class StepCreate(BaseModel):
    action: str


class StepUpdate(BaseModel):
    status: StepStatus
    artifacts: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    user: User = Depends(require_role(["operator", "admin"])),
) -> SessionResponse:
    manager = get_session_manager()
    session = await manager.create_session(session_data.config)
    return SessionResponse.from_session(session)


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    user: User = Depends(require_role(["viewer", "operator", "admin"])),
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[SessionResponse]:
    store = get_session_store()

    status_enum = None
    if status_filter:
        try:
            status_enum = SessionStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status: {status_filter}")

    sessions = await store.list(status_filter=status_enum, limit=limit, offset=offset)
    return [SessionResponse.from_session(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    user: User = Depends(require_role(["viewer", "operator", "admin"])),
) -> SessionResponse:
    store = get_session_store()
    session = await store.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return SessionResponse.from_session(session)


@router.get("/{session_id}/steps", response_model=List[StepRecord])
async def get_session_steps(
    session_id: str,
    user: User = Depends(require_role(["viewer", "operator", "admin"])),
) -> List[StepRecord]:
    store = get_session_store()
    session = await store.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session.steps


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
async def close_session(
    session_id: str,
    user: User = Depends(require_role(["operator", "admin"])),
) -> dict:
    manager = get_session_manager()
    try:
        session = await manager.close_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return {"id": session_id, "status": session.status.value, "message": "Session closed successfully"}


@router.post("/{session_id}/steps", response_model=StepRecord, status_code=status.HTTP_201_CREATED)
async def add_step(
    session_id: str,
    step_data: StepCreate,
    user: User = Depends(require_role(["operator", "admin"])),
) -> StepRecord:
    manager = get_session_manager()
    try:
        step = await manager.add_step(session_id, step_data.action)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return step


@router.patch("/{session_id}/steps/{step_id}", response_model=StepRecord)
async def update_step(
    session_id: str,
    step_id: str,
    step_update: StepUpdate,
    user: User = Depends(require_role(["operator", "admin"])),
) -> StepRecord:
    manager = get_session_manager()
    try:
        step = await manager.update_step(
            session_id,
            step_id,
            step_update.status,
            step_update.artifacts,
            step_update.error,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return step


@router.get("/{session_id}/events")
async def session_events(
    session_id: str,
    user: User = Depends(require_role(["viewer", "operator", "admin"])),
):
    from fastapi.responses import StreamingResponse
    import json

    store = get_session_store()
    session = await store.get(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    queue = await store.subscribe(session_id)

    async def event_generator():
        try:
            # Send initial state
            yield f"data: {json.dumps({'type': 'state', 'session': SessionResponse.from_session(session).model_dump(mode='json')})}\n\n"

            while True:
                try:
                    updated_session = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps({'type': 'update', 'session': SessionResponse.from_session(updated_session).model_dump(mode='json')})}\n\n"

                    if updated_session.status in (SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CLOSED):
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            await store.unsubscribe(session_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


import asyncio
from datetime import timezone
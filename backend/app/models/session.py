from __future__ import annotations

import asyncio
import secrets
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

from pydantic import BaseModel, Field, HttpUrl

from app.core.config import settings


class SessionStatus(str, Enum):
    INITIALIZING = "initializing"
    PREPARING = "preparing"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CLOSING = "closing"
    CLOSED = "closed"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TargetPlatform(str, Enum):
    WEB = "web"
    ANDROID = "android"
    IOS = "ios"


class EngineType(str, Enum):
    PLAYWRIGHT = "playwright"
    APPIUM = "appium"


@dataclass
class SecretPattern:
    name: str
    pattern: str
    replacement: str = "[REDACTED]"


DEFAULT_SECRET_PATTERNS: List[SecretPattern] = [
    SecretPattern(name="api_key", pattern=r"(?i)(api[_-]?key|apikey)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_\-]{20,})"),
    SecretPattern(name="token", pattern=r"(?i)(token|access[_-]?token|bearer)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_\-\.=]{20,})"),
    SecretPattern(name="password", pattern=r"(?i)(password|passwd|pwd)['\"]?\s*[:=]\s*['\"]?([^\s'\"]{8,})"),
    SecretPattern(name="secret", pattern=r"(?i)(secret|client[_-]?secret)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_\-]{16,})"),
    SecretPattern(name="private_key", pattern=r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"),
    SecretPattern(name="aws_key", pattern=r"(?i)(aws[_-]?(access[_-]?key|secret[_-]?key))['\"]?\s*[:=]\s*['\"]?([A-Z0-9]{20,})"),
]


def redact_secrets(text: str, patterns: Optional[List[SecretPattern]] = None) -> str:
    import re

    if not text:
        return text

    patterns = patterns or DEFAULT_SECRET_PATTERNS
    result = text

    for pattern in patterns:
        if pattern.pattern.startswith("-----BEGIN"):
            if pattern.pattern in result:
                result = "[REDACTED PRIVATE KEY]"
        else:
            result = re.sub(pattern.pattern, f"\\1={pattern.replacement}", result)

    return result


class SessionConfig(BaseModel):
    cwd: str = Field(default=".", description="Working directory for the session")
    config_path: Optional[str] = Field(default=None, description="Path to e2e config file")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Inline E2EConfig object")
    target: TargetPlatform = Field(default=TargetPlatform.WEB, description="Target platform")
    on_step_webhook: Optional[HttpUrl] = Field(default=None, description="Webhook URL for step progress")
    engine: EngineType = Field(default=EngineType.PLAYWRIGHT, description="Engine to use")
    timeout_seconds: int = Field(default=300, description="Session timeout")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StepRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    step_number: int
    action: str
    status: StepStatus = StepStatus.PENDING
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    artifacts: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def mark_running(self) -> None:
        self.status = StepStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

    def mark_completed(self, artifacts: Optional[Dict[str, Any]] = None) -> None:
        self.status = StepStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        if artifacts:
            self.artifacts = {k: redact_secrets(str(v)) if isinstance(v, str) else v for k, v in artifacts.items()}

    def mark_failed(self, error: str) -> None:
        self.status = StepStatus.FAILED
        self.completed_at = datetime.now(timezone.utc)
        self.error = redact_secrets(error)


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: SessionStatus = SessionStatus.INITIALIZING
    config: SessionConfig
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None
    error: Optional[str] = None
    steps: List[StepRecord] = Field(default_factory=list)
    engine_process_id: Optional[int] = None
    lease_id: Optional[str] = None

    def add_step(self, action: str) -> StepRecord:
        step_number = len(self.steps) + 1
        step = StepRecord(session_id=self.id, step_number=step_number, action=action)
        self.steps.append(step)
        self.updated_at = datetime.now(timezone.utc)
        return step

    def get_step(self, step_id: str) -> Optional[StepRecord]:
        return next((s for s in self.steps if s.id == step_id), None)

    def mark_running(self) -> None:
        self.status = SessionStatus.RUNNING
        self.updated_at = datetime.now(timezone.utc)

    def mark_completed(self) -> None:
        self.status = SessionStatus.COMPLETED
        self.closed_at = datetime.now(timezone.utc)
        self.updated_at = self.closed_at

    def mark_failed(self, error: str) -> None:
        self.status = SessionStatus.FAILED
        self.error = redact_secrets(error)
        self.closed_at = datetime.now(timezone.utc)
        self.updated_at = self.closed_at

    def mark_closing(self) -> None:
        self.status = SessionStatus.CLOSING
        self.updated_at = datetime.now(timezone.utc)

    def mark_closed(self) -> None:
        self.status = SessionStatus.CLOSED
        self.closed_at = datetime.now(timezone.utc)
        self.updated_at = self.closed_at


class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._lock = asyncio.Lock()
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    async def create(self, config: SessionConfig) -> Session:
        async with self._lock:
            session = Session(config=config)
            self._sessions[session.id] = session
            self._subscribers[session.id] = set()
            return session

    async def get(self, session_id: str) -> Optional[Session]:
        async with self._lock:
            return self._sessions.get(session_id)

    async def list(
        self,
        status_filter: Optional[SessionStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Session]:
        async with self._lock:
            sessions = list(self._sessions.values())
            if status_filter:
                sessions = [s for s in sessions if s.status == status_filter]
            sessions.sort(key=lambda s: s.created_at, reverse=True)
            return sessions[offset : offset + limit]

    async def update(self, session: Session) -> Session:
        async with self._lock:
            session.updated_at = datetime.now(timezone.utc)
            self._sessions[session.id] = session
            await self._notify_subscribers(session.id, session)
            return session

    async def delete(self, session_id: str) -> bool:
        async with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                if session_id in self._subscribers:
                    del self._subscribers[session_id]
                return True
            return False

    async def subscribe(self, session_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            if session_id not in self._subscribers:
                self._subscribers[session_id] = set()
            self._subscribers[session_id].add(queue)
        return queue

    async def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            if session_id in self._subscribers:
                self._subscribers[session_id].discard(queue)

    async def _notify_subscribers(self, session_id: str, session: Session) -> None:
        if session_id in self._subscribers:
            for queue in self._subscribers[session_id].copy():
                try:
                    queue.put_nowait(session)
                except asyncio.QueueFull:
                    pass


_session_store: Optional[SessionStore] = None


def get_session_store() -> SessionStore:
    global _session_store
    if _session_store is None:
        _session_store = SessionStore()
    return _session_store


@asynccontextmanager
async def session_context(config: SessionConfig) -> AsyncGenerator[Session, None]:
    store = get_session_store()
    session = await store.create(config)
    try:
        session.mark_running()
        await store.update(session)
        yield session
        if session.status == SessionStatus.RUNNING:
            session.mark_completed()
            await store.update(session)
    except Exception as e:
        session.mark_failed(str(e))
        await store.update(session)
        raise
    finally:
        if session.status not in (SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CLOSED):
            session.mark_closing()
            await store.update(session)
            session.mark_closed()
            await store.update(session)
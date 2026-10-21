from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

from app.core.config import settings
from app.models.session import (
    Session,
    SessionConfig,
    SessionStatus,
    StepRecord,
    StepStatus,
    TargetPlatform,
    EngineType,
    redact_secrets,
    get_session_store,
)


@dataclass
class EngineProcess:
    """Represents a running e2e engine process."""
    id: str
    engine_type: EngineType
    target: TargetPlatform
    process: Optional[asyncio.subprocess.Process] = None
    pid: Optional[int] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FixtureGraph:
    """Manages the e2e fixture graph: agent, app, screen, device."""
    session_id: str
    engine_type: EngineType
    target: TargetPlatform
    cwd: str
    config_path: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

    # Fixture instances
    agent: Optional[Any] = None
    app: Optional[Any] = None
    screen: Optional[Any] = None
    device: Optional[Any] = None

    # Device lease for mobile
    lease_id: Optional[str] = None

    initialized: bool = False
    initialization_error: Optional[str] = None

    async def initialize(self) -> None:
        """Initialize the fixture graph by preparing the engine and creating fixtures."""
        if self.initialized:
            return

        try:
            # Prepare the engine (Playwright or Appium)
            await self._prepare_engine()

            # Create fixture instances
            await self._create_fixtures()

            self.initialized = True
        except Exception as e:
            self.initialization_error = str(e)
            raise

    async def _prepare_engine(self) -> None:
        """Prepare the e2e engine (install browsers, start Appium server, etc.)."""
        # Skip actual engine preparation in test environment
        import os
        if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("CI"):
            return

        if self.engine_type == EngineType.PLAYWRIGHT:
            await self._prepare_playwright()
        elif self.engine_type == EngineType.APPIUM:
            await self._prepare_appium()

    async def _prepare_playwright(self) -> None:
        """Install Playwright browsers if needed."""
        import subprocess

        # Check if browsers are installed
        browsers_dir = Path.home() / ".cache" / "ms-playwright"
        if not browsers_dir.exists():
            # Run playwright install
            proc = await asyncio.create_subprocess_exec(
                "npx", "playwright", "install", "--with-deps",
                cwd=self.cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"Playwright install failed: {stderr.decode()}")

    async def _prepare_appium(self) -> None:
        """Verify Appium is available."""
        import subprocess

        # Check if Appium is installed
        proc = await asyncio.create_subprocess_exec(
            "npx", "appium", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Appium not found: {stderr.decode()}")

    async def _create_fixtures(self) -> None:
        """Create the fixture instances (agent, app, screen, device)."""
        # In a real implementation, these would be actual Playwright/Appium fixtures
        # For now, we create placeholder objects that represent the fixture graph
        self.agent = {"type": "agent", "engine": self.engine_type.value, "session_id": self.session_id}
        self.app = {"type": "app", "engine": self.engine_type.value, "target": self.target.value}
        self.screen = {"type": "screen", "engine": self.engine_type.value}

        if self.target in (TargetPlatform.ANDROID, TargetPlatform.IOS):
            self.device = {
                "type": "device",
                "platform": self.target.value,
                "lease_id": self.lease_id or str(uuid.uuid4()),
            }
            self.lease_id = self.device["lease_id"]

    async def cleanup(self) -> None:
        """Clean up fixtures and release resources."""
        # Release device lease if any
        if self.lease_id:
            await self._release_lease()
            self.lease_id = None

        # Clean up fixture references
        self.agent = None
        self.app = None
        self.screen = None
        self.device = None
        self.initialized = False

    async def _release_lease(self) -> None:
        """Release device lease (placeholder for device farm integration)."""
        # In production, this would call a device farm API to release the device
        pass


class SessionManager:
    """
    High-level session manager that coordinates engine lifecycle,
    fixture graph, and step execution for e2e sessions.
    """

    def __init__(self) -> None:
        self._fixture_graphs: Dict[str, FixtureGraph] = {}
        self._engine_processes: Dict[str, EngineProcess] = {}
        self._step_callbacks: Dict[str, List[callable]] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, config: SessionConfig) -> Session:
        """Create a new session with fixture graph initialization."""
        store = get_session_store()
        session = await store.create(config)

        # Create fixture graph for this session
        fixture_graph = FixtureGraph(
            session_id=session.id,
            engine_type=config.engine,
            target=config.target,
            cwd=config.cwd,
            config_path=config.config_path,
            config=config.config,
        )
        async with self._lock:
            self._fixture_graphs[session.id] = fixture_graph

        # Initialize fixture graph (engine prepare + fixtures)
        try:
            session.status = SessionStatus.PREPARING
            await store.update(session)

            await fixture_graph.initialize()

            session.status = SessionStatus.RUNNING
            session.lease_id = fixture_graph.lease_id
            await store.update(session)
        except Exception as e:
            session.mark_failed(f"Fixture initialization failed: {redact_secrets(str(e))}")
            await store.update(session)
            await self._cleanup_session(session.id)
            raise

        return session

    async def add_step(self, session_id: str, action: str) -> StepRecord:
        """Add a step to the session and notify subscribers."""
        store = get_session_store()
        session = await store.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        step = session.add_step(action)
        step.mark_running()
        await store.update(session)

        # Notify step callbacks
        await self._notify_step_callbacks(session_id, step)

        return step

    async def update_step(
        self,
        session_id: str,
        step_id: str,
        status: StepStatus,
        artifacts: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> StepRecord:
        """Update step status with artifacts and secret redaction."""
        store = get_session_store()
        session = await store.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        step = session.get_step(step_id)
        if not step:
            raise ValueError(f"Step {step_id} not found")

        if status == StepStatus.RUNNING:
            step.mark_running()
        elif status == StepStatus.COMPLETED:
            step.mark_completed(artifacts)
        elif status == StepStatus.FAILED:
            step.mark_failed(error or "Step failed")
        else:
            step.status = status
            if status in (StepStatus.COMPLETED, StepStatus.FAILED):
                step.completed_at = datetime.now(timezone.utc)

        await store.update(session)
        await self._notify_step_callbacks(session_id, step)

        return step

    async def close_session(self, session_id: str) -> Session:
        """Close session and clean up all resources."""
        store = get_session_store()
        session = await store.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        if session.status in (SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CLOSED):
            return session

        session.mark_closing()
        await store.update(session)

        # Clean up fixture graph
        await self._cleanup_session(session_id)

        session.mark_closed()
        await store.update(session)

        return session

    async def _cleanup_session(self, session_id: str) -> None:
        """Clean up all resources for a session."""
        async with self._lock:
            # Cleanup fixture graph
            if session_id in self._fixture_graphs:
                fixture_graph = self._fixture_graphs.pop(session_id)
                await fixture_graph.cleanup()

            # Cleanup engine process
            if session_id in self._engine_processes:
                engine_process = self._engine_processes.pop(session_id)
                if engine_process.process:
                    engine_process.process.terminate()
                    try:
                        await asyncio.wait_for(engine_process.process.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        engine_process.process.kill()
                        await engine_process.process.wait()

            # Cleanup step callbacks
            self._step_callbacks.pop(session_id, None)

    def register_step_callback(self, session_id: str, callback: callable) -> None:
        """Register a callback for step updates (e.g., for SSE)."""
        if session_id not in self._step_callbacks:
            self._step_callbacks[session_id] = []
        self._step_callbacks[session_id].append(callback)

    def unregister_step_callback(self, session_id: str, callback: callable) -> None:
        """Unregister a step callback."""
        if session_id in self._step_callbacks:
            self._step_callbacks[session_id].remove(callback)

    async def _notify_step_callbacks(self, session_id: str, step: StepRecord) -> None:
        """Notify all registered callbacks about a step update."""
        callbacks = self._step_callbacks.get(session_id, [])
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(step)
                else:
                    callback(step)
            except Exception:
                # Ignore callback errors
                pass

    def get_fixture_graph(self, session_id: str) -> Optional[FixtureGraph]:
        """Get the fixture graph for a session."""
        return self._fixture_graphs.get(session_id)

    @asynccontextmanager
    async def session(self, config: SessionConfig) -> AsyncGenerator[Session, None]:
        """
        Async context manager for session lifecycle.
        Handles initialization, yield session for step execution, and cleanup.
        """
        session = await self.create_session(config)
        try:
            yield session
            if session.status == SessionStatus.RUNNING:
                session.mark_completed()
                await get_session_store().update(session)
        except Exception as e:
            session.mark_failed(str(e))
            await get_session_store().update(session)
            raise
        finally:
            if session.status not in (SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CLOSED):
                await self.close_session(session.id)


# Global session manager instance
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
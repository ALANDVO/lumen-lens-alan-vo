# Changelog

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

### Fixed
- Fixed error-swallowing bug in frontend `fetchSessions`: errors were silently discarded on first load when no prior error existed (`if (error)` guard removed)
- Fixed stale `error` dependency in `fetchSessions` `useCallback` causing unnecessary re-renders

## 1.1.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### Added
- FastAPI backend with health/version endpoints
- React + TypeScript + Vite frontend with session dashboard
- Session management API (create, list, get, close, steps)
- Role-based access control (viewer, operator, admin)
- Keycloak OIDC integration with realm export
- Docker Compose stack (backend, frontend, PostgreSQL, Keycloak)
- CI/CD pipeline (GitHub Actions: backend tests, frontend build/test, Docker builds)
- Structured logging with structlog
- Secret redaction framework
- LLM provider abstraction (OpenAI-compatible, Anthropic, Gemini, Ollama)
- Demo mode for local development

### Security
- HttpOnly SameSite cookies with CSRF protection (planned)
- JWT validation with JWKS caching
- Non-root Docker containers
- Environment-based secret management

---

## [1.0.1] - 2024-10-21

### Added
- SessionManager service with engine lifecycle management
- Fixture graph initialization (agent, app, screen, device)
- Async context manager pattern for session lifecycle (`async with session_manager.session(config)`)
- Engine preparation for Playwright and Appium (skipped in test/CI environments)
- Device lease management for mobile targets (Android/iOS)
- Step callback registration for real-time SSE updates
- Comprehensive test coverage: 31 backend tests (12 existing + 19 new)
- Secret redaction for API keys, bearer tokens, passwords, private keys, AWS keys

### Changed
- Session API endpoints now use SessionManager for engine/fixture coordination
- Session creation initializes fixture graph with engine-specific setup
- Session close cleans up all engine processes, fixture graphs, and leases

### Fixed
- Secret redaction now handles Authorization: Bearer tokens and generic PRIVATE KEY blocks

---

## [Unreleased]

### Planned
- SQLite/SQLAlchemy persistence layer for sessions and steps
- Server-Sent Events for real-time step updates (frontend integration)
- Artifact storage (screenshots, videos, DOM snapshots)
- Engine integration (Playwright, Appium) for actual test execution
- OpenSession API on e2e/runner subpath
- Frontend Session Dashboard with real-time step feed and artifact viewer
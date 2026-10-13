# Changelog

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

## [Unreleased]

### Planned
- SQLite/SQLAlchemy persistence layer for sessions and steps
- Server-Sent Events for real-time step updates
- Artifact storage (screenshots, videos, DOM snapshots)
- Engine integration (Playwright, Appium)
- Fixture graph (agent, app, screen, device)
- OpenSession API on e2e/runner subpath
- Comprehensive test coverage (12+ backend, 3+ frontend tests)
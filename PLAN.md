# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

session-management-api

## Roadmap

### project-skeleton — Project Skeleton with FastAPI Backend and React Frontend

Status: done

Acceptance:
- FastAPI backend with health endpoint runs on port 8000
- React+TypeScript+Vite frontend builds and serves on port 5173
- Docker Compose spins up both services with Keycloak
- Backend tests pass with pytest
- Frontend typechecks and builds with npm run build
- CI workflow runs backend tests, frontend build/test, and Docker builds

Implementation: `backend/app/main.py`, `backend/requirements.txt`, `backend/Dockerfile`, `backend/tests/test_health.py`, `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/Dockerfile`, `compose.yaml`, `.github/workflows/ci.yml`, `pyproject.toml`, `README.md`, `LICENSE`, `CHANGELOG.md`, `.gitignore`, `.env.example`, `portfolio.json`

Tests: `backend/tests/test_health.py`, `frontend/src/App.test.tsx`

### session-management-api — E2E Session Management API (openSession/close/steps)

Status: done

Acceptance:
- POST /api/v1/sessions creates a new e2e session with config, target, onStep callback
- GET /api/v1/sessions/{id}/steps returns step records with artifacts
- DELETE /api/v1/sessions/{id} closes session idempotently
- Session manages engine prepare, fixture graph (agent, app, screen, device), secret redaction
- Async context manager pattern supported via async with

Implementation: `backend/app/api/sessions.py`, `backend/app/services/session_manager.py`, `backend/app/models/session.py`, `backend/app/core/config.py`, `backend/tests/test_sessions.py`

Tests: `backend/tests/test_sessions.py`

### frontend-session-ui — Frontend Session Dashboard

Status: planned

Acceptance:
- Dashboard lists active sessions with status
- Create session form with config/target fields
- Session detail view shows step progress feed and artifacts
- Real-time step updates via Server-Sent Events or polling
- Export session steps as JSON

Implementation: `frontend/src/api/client.ts`, `frontend/src/components/SessionList.tsx`, `frontend/src/components/SessionDetail.tsx`, `frontend/src/components/CreateSessionForm.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/tests/Dashboard.test.tsx`

Tests: `frontend/tests/Dashboard.test.tsx`

### auth-oidc-keycloak — OIDC Authentication with Keycloak

Status: planned

Acceptance:
- Keycloak realm import with roles: viewer, operator, admin
- Backend validates JWT with signature/issuer/audience
- HttpOnly SameSite cookies with CSRF protection for backend session auth
- Protected API endpoints require valid token with correct role
- Login/logout flows work end-to-end
- Tests cover unauthenticated rejection and role denial

Implementation: `backend/app/core/auth.py`, `backend/app/api/auth.py`, `backend/tests/test_auth.py`, `keycloak/realm-export.json`, `compose.yaml (Keycloak service)`

Tests: `backend/tests/test_auth.py`

### llm-adapters — LLM Provider Adapters (OpenAI-compatible, Anthropic, Gemini, Ollama)

Status: planned

Acceptance:
- Configurable LLM_PROVIDER, LLM_MODEL, LLM_BASE_URL, LLM_API_KEY
- Adapters for OpenAI-compatible, Anthropic messages, Gemini generateContent, Ollama
- Bounded timeouts, redacted errors, keys only server-side
- Opt-in advisory explanations grounded in actual records

Implementation: `backend/app/services/llm_adapters.py`, `backend/app/core/llm_config.py`, `backend/tests/test_llm_adapters.py`

Tests: `backend/tests/test_llm_adapters.py`

### documentation-polish — Documentation, README, Changelog, Portfolio.json

Status: planned

Acceptance:
- README with install/run/test steps, Mermaid architecture diagram, API reference
- CHANGELOG.md with actual changes
- portfolio.json with schema_version, name, owner, email, domain, workflows, auth, llm_providers
- docs/ with API/architecture/deployment documentation
- LICENSE MIT with copyright Alan Vo <alanvo@gmail.com>

Implementation: `README.md`, `CHANGELOG.md`, `portfolio.json`, `docs/api.md`, `docs/architecture.md`, `docs/deployment.md`

